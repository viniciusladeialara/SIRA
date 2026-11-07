import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Obtém um valor do cache desserializado a partir de JSON
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(`Erro ao obter chave [${key}] do Redis:`, error);
      return null;
    }
  }

  /**
   * Grava um valor no cache serializado em JSON com TTL opcional em segundos
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.error(`Erro ao gravar chave [${key}] no Redis:`, error);
    }
  }

  /**
   * Remove uma chave do cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Erro ao remover chave [${key}] do Redis:`, error);
    }
  }

  /**
   * Remove chaves correspondentes a um padrão utilizando SCAN sem bloquear o Redis
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      let cursor = '0';
      let deletedCount = 0;
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          deletedCount += await this.redis.del(...keys);
        }
      } while (cursor !== '0');
      return deletedCount;
    } catch (error) {
      this.logger.error(`Erro ao remover padrão [${pattern}] do Redis:`, error);
      return 0;
    }
  }

  /**
   * Adiciona um token JWT revogado à Denylist do Redis com expiração automática
   */
  async addToDenylist(token: string, ttlSeconds: number): Promise<void> {
    const key = `sira:denylist:${token}`;
    await this.set(key, { revokedAt: new Date().toISOString() }, ttlSeconds);
  }

  /**
   * Verifica se um token JWT está presente na Denylist (foi revogado)
   */
  async isTokenDenylisted(token: string): Promise<boolean> {
    const key = `sira:denylist:${token}`;
    const entry = await this.get(key);
    return entry !== null;
  }

  /**
   * Executa ping no Redis e retorna a latência em milissegundos
   */
  async ping(): Promise<number> {
    const start = Date.now();
    await this.redis.ping();
    return Date.now() - start;
  }

  /**
   * Controle de Rate Limiting por IP ou identificador com janela de tempo deslizante
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; current: number; remaining: number }> {
    try {
      const fullKey = `sira:ratelimit:${key}`;
      const current = await this.redis.incr(fullKey);
      if (current === 1) {
        await this.redis.expire(fullKey, windowSeconds);
      }
      const allowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      return { allowed, current, remaining };
    } catch (error) {
      this.logger.error(`Erro no rate limiter para chave [${key}]:`, error);
      // Fallback permissivo em caso de indisponibilidade momentânea do Redis
      return { allowed: true, current: 0, remaining: limit };
    }
  }

  /**
   * Adiciona rastreamento de sessão/refresh token para um usuário
   */
  async trackUserSession(userId: string, refreshToken: string, ttlSeconds: number): Promise<void> {
    try {
      const setKey = `sira:user_sessions:${userId}`;
      await this.redis.sadd(setKey, refreshToken);
      await this.redis.expire(setKey, ttlSeconds);
    } catch (error) {
      this.logger.error(`Erro ao rastrear sessão de usuário [${userId}]:`, error);
    }
  }

  /**
   * Remove um refresh token das sessões rastreadas do usuário
   */
  async removeUserSessionToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const setKey = `sira:user_sessions:${userId}`;
      await this.redis.srem(setKey, refreshToken);
    } catch (error) {
      this.logger.error(`Erro ao remover sessão rastreada de usuário [${userId}]:`, error);
    }
  }

  /**
   * Revoga todas as sessões ativas de um usuário globalmente (Global Revoke)
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    try {
      const setKey = `sira:user_sessions:${userId}`;
      const tokens = await this.redis.smembers(setKey);
      let count = 0;
      for (const token of tokens) {
        await this.del(`sira:refresh:${token}`);
        count++;
      }
      await this.del(setKey);

      // Também remove qualquer outro padrão remanescente
      const patternCount = await this.delPattern(`sira:refresh:*${userId}*`);
      this.logger.log(`[GlobalRevoke] Revogadas ${count + patternCount} sessões para o usuário ${userId}`);
      return count + patternCount;
    } catch (error) {
      this.logger.error(`Erro no Global Revoke para o usuário [${userId}]:`, error);
      return 0;
    }
  }
}
