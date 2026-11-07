import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RbacService } from '../../apps/api/src/modules/rbac/rbac.service.js';

describe('RbacService (Unit)', () => {
  let service: RbacService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      usuarios: {
        findUnique: vi.fn(),
      },
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    service = new RbacService(mockPrisma as any, mockCache as any);
  });

  it('deve retornar true caso usuário seja administrador sem checar permissão individual', async () => {
    const hasPerm = await service.hasPermission('usr-admin', 'qualquer:permissao', ['administrador']);
    expect(hasPerm).toBe(true);
  });

  it('deve obter permissões do cache Redis se disponível', async () => {
    mockCache.get.mockResolvedValueOnce(['usuarios:ler', 'agendamentos:criar']);

    const perms = await service.getUserPermissions('usr-1');

    expect(perms).toEqual(['usuarios:ler', 'agendamentos:criar']);
    expect(mockCache.get).toHaveBeenCalledWith('sira:perms:usr-1');
  });

  it('deve buscar no banco e atualizar cache em caso de cache miss', async () => {
    mockCache.get.mockResolvedValueOnce(null);
    mockPrisma.usuarios.findUnique.mockResolvedValueOnce({
      usuario_perfis: [
        {
          perfis: {
            slug: 'coordenador',
            ativo: true,
            perfil_permissoes: [
              { permissoes: { chave: 'docentes:gerenciar' } },
            ],
          },
        },
      ],
    });

    const perms = await service.getUserPermissions('usr-2');

    expect(perms).toContain('docentes:gerenciar');
    expect(mockCache.set).toHaveBeenCalledWith('sira:perms:usr-2', ['docentes:gerenciar'], 1800);
  });
});
