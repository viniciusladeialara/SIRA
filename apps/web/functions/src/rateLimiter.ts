/**
 * @file rateLimiter.ts
 * @description Simple in-memory rate limiter para Cloud Functions
 * (sem necessidade de dependências externas)
 */

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

let lastCleanup = Date.now();

/**
 * Rate limiter simples em memória com limpeza sob demanda
 * @param windowMs - Janela de tempo em milissegundos (ex: 60000 = 1 minuto)
 * @param maxRequests - Máximo de requisições por janela
 * @param keyGenerator - Função para gerar chave (ex: IP, user ID)
 * @returns boolean - true se permitido, false se excedeu limite
 */
export function isRateLimited(
  keyGenerator: string,
  windowMs: number = 60000,
  maxRequests: number = 10
): boolean {
  const now = Date.now();
  const key = keyGenerator;

  // Limpeza preguiçosa a cada 5 minutos sem segurar timer no root
  if (now - lastCleanup > 5 * 60 * 1000) {
    for (const k in store) {
      if (store[k].resetTime < now) {
        delete store[k];
      }
    }
    lastCleanup = now;
  }

  if (!store[key]) {
    store[key] = { count: 1, resetTime: now + windowMs };
    return false; // Primeira requisição, sempre permitida
  }

  const record = store[key];

  // Se a janela expirou, resetar
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return false; // Permitido
  }

  // Dentro da janela
  if (record.count >= maxRequests) {
    return true; // Bloqueado
  }

  record.count++;
  return false; // Permitido
}

export default isRateLimited;
