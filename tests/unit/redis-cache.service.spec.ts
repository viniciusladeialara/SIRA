import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisCacheService } from '../../apps/api/src/infrastructure/redis/redis-cache.service.js';

describe('RedisCacheService (Unit)', () => {
  let service: RedisCacheService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      scan: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      sadd: vi.fn().mockResolvedValue(1),
      srem: vi.fn().mockResolvedValue(1),
      smembers: vi.fn().mockResolvedValue(['token-1', 'token-2']),
    };

    service = new RedisCacheService(mockRedis as any);
  });

  it('deve obter e deserializar valores do Redis', async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ chave: 'valor' }));
    const data = await service.get('teste');
    expect(data).toEqual({ chave: 'valor' });
  });

  it('deve serializar e gravar valores no Redis com TTL', async () => {
    await service.set('teste', { x: 1 }, 120);
    expect(mockRedis.set).toHaveBeenCalledWith('teste', JSON.stringify({ x: 1 }), 'EX', 120);
  });

  it('deve executar ping e retornar latência', async () => {
    const lat = await service.ping();
    expect(typeof lat).toBe('number');
    expect(mockRedis.ping).toHaveBeenCalled();
  });

  it('deve verificar rate limit e retornar remaining', async () => {
    mockRedis.incr.mockResolvedValueOnce(3);
    const res = await service.checkRateLimit('ip-test', 5, 60);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(2);
  });

  it('deve rastrear e revogar sessões de usuário globalmente', async () => {
    await service.trackUserSession('usr-1', 'token-1', 3600);
    expect(mockRedis.sadd).toHaveBeenCalledWith('sira:user_sessions:usr-1', 'token-1');

    mockRedis.scan.mockResolvedValueOnce(['0', []]);
    const revoked = await service.revokeAllUserSessions('usr-1');
    expect(revoked).toBe(2);
    expect(mockRedis.del).toHaveBeenCalledWith('sira:refresh:token-1');
    expect(mockRedis.del).toHaveBeenCalledWith('sira:refresh:token-2');
  });
});
