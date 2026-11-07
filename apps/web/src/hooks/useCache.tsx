/**
 * @file useCache.tsx
 * @description Hook personalizado para cache no frontend
 */

import { useState, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em milissegundos
}

interface CacheOptions {
  ttl?: number; // Tempo de vida padrão em milissegundos
  maxSize?: number; // Tamanho máximo do cache
}

/**
 * Hook para gerenciar cache no frontend
 * Otimiza consultas ao Firestore reduzindo custos
 */
export function useCache<T = any>(options: CacheOptions = {}) {
  const { ttl = 5 * 60 * 1000, maxSize = 100 } = options; // 5 minutos padrão, 100 itens máximo
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const [stats, setStats] = useState({
    hits: 0,
    misses: 0,
    size: 0
  });

  // Função para limpar entradas expiradas
  const cleanup = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;

    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        cache.delete(key);
      }
    }

    setStats(prev => ({ ...prev, size: cache.size }));
  }, []);

  // Função para obter dados do cache
  const get = useCallback((key: string): T | null => {
    const cache = cacheRef.current;
    const entry = cache.get(key);

    if (!entry) {
      setStats(prev => ({ ...prev, misses: prev.misses + 1 }));
      return null;
    }

    // Verificar se expirou
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key);
      setStats(prev => ({ ...prev, misses: prev.misses + 1, size: cache.size }));
      return null;
    }

    setStats(prev => ({ ...prev, hits: prev.hits + 1 }));
    return entry.data;
  }, []);

  // Função para armazenar dados no cache
  const set = useCallback((key: string, data: T, customTtl?: number): void => {
    const cache = cacheRef.current;

    // Limpar cache se exceder o tamanho máximo
    if (cache.size >= maxSize) {
      // Remover a entrada mais antiga
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl || ttl
    });

    setStats(prev => ({ ...prev, size: cache.size }));
  }, [ttl, maxSize]);

  // Função para remover entrada específica
  const remove = useCallback((key: string): void => {
    const cache = cacheRef.current;
    cache.delete(key);
    setStats(prev => ({ ...prev, size: cache.size }));
  }, []);

  // Função para limpar todo o cache
  const clear = useCallback((): void => {
    cacheRef.current.clear();
    setStats(prev => ({ ...prev, size: 0 }));
  }, []);

  // Função para obter estatísticas
  const getStats = useCallback(() => {
    const cache = cacheRef.current;
    const hitRate = stats.hits + stats.misses > 0
      ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)
      : '0.0';

    return {
      ...stats,
      hitRate: `${hitRate}%`,
      entries: Array.from(cache.keys())
    };
  }, [stats]);

  // Função para invalidar cache por padrão
  const invalidate = useCallback((pattern?: string): void => {
    const cache = cacheRef.current;

    if (!pattern) {
      cache.clear();
    } else {
      const regex = new RegExp(pattern);
      for (const key of cache.keys()) {
        if (regex.test(key)) {
          cache.delete(key);
        }
      }
    }

    setStats(prev => ({ ...prev, size: cache.size }));
  }, []);

  // Função para obter ou buscar dados (padrão comum)
  const getOrFetch = useCallback(async (
    key: string,
    fetchFn: () => Promise<T>,
    customTtl?: number
  ): Promise<T> => {
    // Tentar obter do cache primeiro
    const cached = get(key);
    if (cached !== null) {
      // console.log(`📦 Cache hit para ${key}`);
      return cached;
    }

    // Se não estiver no cache, buscar e armazenar
    // console.log(`🔄 Cache miss - buscando ${key}`);
    try {
      const data = await fetchFn();
      set(key, data, customTtl);
      return data;
    } catch (error) {
      console.warn(`Aviso ao buscar ${key}, retornando lista vazia:`, error);
      return [] as any as T;
    }
  }, [get, set]);

  return {
    get,
    set,
    remove,
    clear,
    invalidate,
    getOrFetch,
    getStats,
    cleanup
  };
}

/**
 * Hook especializado para cache de dados do Firestore
 */
export function useFirestoreCache<T = any>(options: CacheOptions = {}) {
  const { ttl, maxSize } = options;
  // Use useMemo to stabilize the options passed to useCache if needed, but primitive destructuring works best
  const cacheOptions = useRef({ ttl: ttl || 3 * 60 * 1000, maxSize }).current;
  const cache = useCache<T>(cacheOptions);

  // Função para gerar chave de cache baseada em coleção e filtros
  const generateKey = useCallback((
    collection: string,
    filters?: Record<string, any>
  ): string => {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${collection}_${btoa(filterStr)}`;
  }, []);

  const { getOrFetch } = cache;

  // Função para cache de consultas do Firestore
  const cacheQuery = useCallback(async (
    collection: string,
    fetchFn: () => Promise<T>,
    filters?: Record<string, any>,
    customTtl?: number
  ): Promise<T> => {
    const key = generateKey(collection, filters);
    return getOrFetch(key, fetchFn, customTtl);
  }, [getOrFetch, generateKey]);

  return {
    ...cache,
    cacheQuery,
    generateKey
  };
}
