/**
 * @file cache.ts
 * @description Sistema de cache para otimizar consultas frequentes do Firestore e motor unificado de detecção de colisões.
 */

import admin from "firebase-admin";
import { db } from './db.js';

// Interface para o cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live em milissegundos
}

// Cache em memória (para Cloud Functions, isso é efetivo pois as instâncias são reutilizadas)
class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Verificar se expirou
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Limpar entradas expiradas
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Instância global do cache
const cache = new MemoryCache();

/**
 * Cache para consultas de agendamentos por professor
 * Retorna TODOS os agendamentos sobrepostos no intervalo (sem truncamento com slice)
 */
export async function getCachedSchedulesByTeacher(
  teacherId: string,
  startTime: Date,
  endTime: Date
): Promise<any[]> {
  if (!teacherId) return [];
  const cacheKey = `schedules_teacher_${teacherId}_${startTime.getTime()}_${endTime.getTime()}`;

  // Tentar buscar no cache primeiro
  const cached = cache.get<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Se não estiver no cache, buscar no Firestore com limite inferior seguro (24h antes)
  const minQueryStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
  const schedulesCollection = db.collection("schedules");

  const query = await schedulesCollection
    .where("teacherId", "==", teacherId)
    .where("startTime", ">=", admin.firestore.Timestamp.fromDate(minQueryStart))
    .where("startTime", "<", admin.firestore.Timestamp.fromDate(endTime))
    .get();

  const results = query.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .filter((s: any) => {
      const sStart = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
      const sEnd = s.endTime?.toDate ? s.endTime.toDate() : new Date(s.endTime);
      return sStart < endTime && sEnd > startTime;
    });

  // Armazenar no cache por 1 minuto
  cache.set(cacheKey, results, 60 * 1000);

  return results;
}

/**
 * Cache para consultas de agendamentos por sala
 * Retorna TODOS os agendamentos sobrepostos no intervalo
 */
export async function getCachedSchedulesByRoom(
  roomId: string,
  startTime: Date,
  endTime: Date
): Promise<any[]> {
  if (!roomId) return [];
  const cacheKey = `schedules_room_${roomId}_${startTime.getTime()}_${endTime.getTime()}`;

  const cached = cache.get<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const minQueryStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
  const schedulesCollection = db.collection("schedules");

  const query = await schedulesCollection
    .where("roomId", "==", roomId)
    .where("startTime", ">=", admin.firestore.Timestamp.fromDate(minQueryStart))
    .where("startTime", "<", admin.firestore.Timestamp.fromDate(endTime))
    .get();

  const results = query.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .filter((s: any) => {
      const sStart = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
      const sEnd = s.endTime?.toDate ? s.endTime.toDate() : new Date(s.endTime);
      return sStart < endTime && sEnd > startTime;
    });

  cache.set(cacheKey, results, 60 * 1000);

  return results;
}

/**
 * Cache para consultas de agendamentos por turma
 * Retorna TODOS os agendamentos sobrepostos no intervalo
 */
export async function getCachedSchedulesByClass(
  classId: string,
  startTime: Date,
  endTime: Date
): Promise<any[]> {
  if (!classId) return [];
  const cacheKey = `schedules_class_${classId}_${startTime.getTime()}_${endTime.getTime()}`;

  const cached = cache.get<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const minQueryStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
  const schedulesCollection = db.collection("schedules");

  const query = await schedulesCollection
    .where("classId", "==", classId)
    .where("startTime", ">=", admin.firestore.Timestamp.fromDate(minQueryStart))
    .where("startTime", "<", admin.firestore.Timestamp.fromDate(endTime))
    .get();

  const results = query.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .filter((s: any) => {
      const sStart = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
      const sEnd = s.endTime?.toDate ? s.endTime.toDate() : new Date(s.endTime);
      return sStart < endTime && sEnd > startTime;
    });

  cache.set(cacheKey, results, 60 * 1000);

  return results;
}

export interface CollisionDetails {
  hasCollision: boolean;
  teacherCollisions: any[];
  roomCollisions: any[];
  classCollisions: any[];
  allCollisions: any[];
  description: string;
}

/**
 * Motor Unificado para encontrar todas as colisões de um horário
 */
export async function findScheduleCollisions(params: {
  teacherId?: string;
  roomId?: string;
  classId?: string;
  startTime: Date;
  endTime: Date;
  excludeScheduleId?: string;
}): Promise<CollisionDetails> {
  const { teacherId, roomId, classId, startTime, endTime, excludeScheduleId } = params;

  const [tC, rC, cC] = await Promise.all([
    (teacherId && teacherId !== "direct_booking") 
      ? getCachedSchedulesByTeacher(teacherId, startTime, endTime) 
      : Promise.resolve([]),
    roomId 
      ? getCachedSchedulesByRoom(roomId, startTime, endTime) 
      : Promise.resolve([]),
    (classId && classId !== "direct_booking") 
      ? getCachedSchedulesByClass(classId, startTime, endTime) 
      : Promise.resolve([])
  ]);

  const filterOut = (list: any[]) => excludeScheduleId ? list.filter(s => s.id !== excludeScheduleId) : list;
  const teacherCollisions = filterOut(tC);
  const roomCollisions = filterOut(rC);
  const classCollisions = filterOut(cC);

  const allMap = new Map<string, any>();
  [...teacherCollisions, ...roomCollisions, ...classCollisions].forEach(s => {
    if (s.id) allMap.set(s.id, s);
  });
  const allCollisions = Array.from(allMap.values());

  const descriptions: string[] = [];
  if (roomCollisions.length > 0) {
    const names = roomCollisions.map(s => s.className || s.roomName || 'Reserva').join(', ');
    descriptions.push(`Ambiente ocupado por: ${names}`);
  }
  if (teacherCollisions.length > 0) {
    const names = teacherCollisions.map(s => `${s.teacherName || 'Docente'} (${s.className || 'Outra aula'})`).join(', ');
    descriptions.push(`Professor com aula: ${names}`);
  }
  if (classCollisions.length > 0) {
    const names = classCollisions.map(s => s.className || 'Turma').join(', ');
    descriptions.push(`Turma com aula: ${names}`);
  }

  return {
    hasCollision: allCollisions.length > 0,
    teacherCollisions,
    roomCollisions,
    classCollisions,
    allCollisions,
    description: descriptions.join(' | ')
  };
}

/**
 * Cache para listagem de usuários (usado frequentemente)
 */
export async function getCachedUsers(): Promise<any[]> {
  const cacheKey = 'users_list';

  const cached = cache.get<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const usersCollection = db.collection("users");
  const query = await usersCollection
    .orderBy("createdAt", "desc")
    .get();

  const results = query.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  cache.set(cacheKey, results, 5 * 60 * 1000);

  return results;
}

/**
 * Cache para listagem de cursos (usado frequentemente)
 */
export async function getCachedCourses(): Promise<any[]> {
  const cacheKey = 'courses_list';

  const cached = cache.get<any[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const coursesCollection = db.collection("courses");
  const query = await coursesCollection
    .orderBy("createdAt", "desc")
    .get();

  const results = query.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  cache.set(cacheKey, results, 10 * 60 * 1000);

  return results;
}

/**
 * Invalidar cache quando dados são modificados
 */
export function invalidateCache(pattern?: string): void {
  const stats = cache.getStats() as any;
  if (pattern) {
    for (const key of stats.keys) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

/**
 * Estatísticas do cache
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache['cache'].size,
    keys: Array.from(cache['cache'].keys())
  };
}
