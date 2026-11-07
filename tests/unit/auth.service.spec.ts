import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../apps/api/src/modules/auth/auth.service.js';
import * as bcrypt from 'bcrypt';

describe('AuthService & Security Evolution (Unit)', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockRedisCache: any;

  beforeEach(() => {
    mockPrisma = {
      usuarios: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      logs: {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mocked-access-token'),
      decode: vi.fn(),
    };

    mockRedisCache = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      trackUserSession: vi.fn(),
      removeUserSessionToken: vi.fn(),
      revokeAllUserSessions: vi.fn().mockResolvedValue(3),
    };

    service = new AuthService(mockPrisma as any, mockJwtService as any, mockRedisCache as any);
  });

  it('deve realizar login com sucesso, gerar tokens e registrar device tracking', async () => {
    const hashed = await bcrypt.hash('Sira@2026', 10);
    mockPrisma.usuarios.findFirst.mockResolvedValueOnce({
      id: 'usr-1',
      nome: 'Administrador SIRA',
      email: 'admin@sira.com',
      senha_hash: hashed,
      ativo: true,
      unidade_id: 'unit-cuiaba',
      usuario_perfis: [{ perfis: { slug: 'administrador' } }],
      unidades: { id: 'unit-cuiaba', nome: 'Cuiabá', sigla: 'CBA' },
    });

    const response = await service.login(
      { email: 'admin@sira.com', password: 'Sira@2026', deviceId: 'device-test-123' },
      '192.168.1.50',
      'Mozilla/5.0 Test',
    );

    expect(response.access_token).toBe('mocked-access-token');
    expect(response.refresh_token).toBeDefined();
    expect(mockRedisCache.trackUserSession).toHaveBeenCalledWith(
      'usr-1',
      response.refresh_token,
      expect.any(Number),
    );
    expect(mockPrisma.logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          usuario_id: 'usr-1',
          acao: 'LOGIN',
        }),
      }),
    );
  });

  it('deve executar a rotação do refresh token descartando o token antigo', async () => {
    mockRedisCache.get.mockResolvedValueOnce({
      userId: 'usr-1',
      email: 'admin@sira.com',
      deviceId: 'device-test-123',
    });

    mockPrisma.usuarios.findUnique.mockResolvedValueOnce({
      id: 'usr-1',
      nome: 'Administrador SIRA',
      email: 'admin@sira.com',
      ativo: true,
      unidade_id: 'unit-cuiaba',
      usuario_perfis: [{ perfis: { slug: 'administrador' } }],
    });

    const result = await service.refreshTokens({
      refreshToken: 'old-refresh-token',
    });

    // Garante que o token antigo foi invalidado e novo gerado
    expect(mockRedisCache.del).toHaveBeenCalledWith('sira:refresh:old-refresh-token');
    expect(mockRedisCache.removeUserSessionToken).toHaveBeenCalledWith('usr-1', 'old-refresh-token');
    expect(result.access_token).toBe('mocked-access-token');
    expect(result.refresh_token).toBeDefined();
  });

  it('deve revogar globalmente todas as sessões de um usuário', async () => {
    const result = await service.revokeAll('usr-1', 'admin@sira.com');

    expect(mockRedisCache.revokeAllUserSessions).toHaveBeenCalledWith('usr-1');
    expect(result.status).toBe('SUCESSO');
    expect(result.mensagem).toContain('3');
  });
});
