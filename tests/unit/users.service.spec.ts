import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../../apps/api/src/modules/users/users.service.js';

describe('UsersService Soft Delete & Event Store (Unit)', () => {
  let service: UsersService;
  let mockPrisma: any;
  let mockRbacService: any;
  let mockEventStore: any;

  beforeEach(() => {
    mockPrisma = {
      usuarios: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      usuario_perfis: {
        create: vi.fn(),
      },
    };

    mockRbacService = {
      invalidateUserPermissions: vi.fn().mockResolvedValue(undefined),
    };

    mockEventStore = {
      recordEvent: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    service = new UsersService(mockPrisma as any, mockRbacService as any, mockEventStore as any);
  });

  it('deve realizar exclusão lógica preservando integridade física', async () => {
    mockPrisma.usuarios.findUnique.mockResolvedValueOnce({
      id: 'usr-10',
      nome: 'Carlos',
      ativo: true,
      excluido_em: null,
      usuario_perfis: [],
    });

    mockPrisma.usuarios.update.mockResolvedValueOnce({
      id: 'usr-10',
      ativo: false,
      excluido_em: new Date(),
      excluido_por: 'admin-1',
    });

    const res = await service.remove('usr-10', 'admin-1');

    expect(res.message).toContain('desativado com sucesso');
    expect(mockPrisma.usuarios.delete).not.toHaveBeenCalled();
    expect(mockPrisma.usuarios.update).toHaveBeenCalledWith({
      where: { id: 'usr-10' },
      data: expect.objectContaining({
        ativo: false,
        excluido_por: 'admin-1',
      }),
    });
    expect(mockRbacService.invalidateUserPermissions).toHaveBeenCalledWith('usr-10');
  });

  it('deve filtrar usuários ativos e não excluídos por padrão', async () => {
    mockPrisma.usuarios.findMany.mockResolvedValueOnce([
      { id: 'usr-1', nome: 'Ana', ativo: true, excluido_em: null },
    ]);

    const users = await service.findAll();

    expect(users).toHaveLength(1);
    expect(mockPrisma.usuarios.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          excluido_em: null,
        }),
      }),
    );
  });
});
