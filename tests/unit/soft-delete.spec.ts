import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmbientesService } from '../../apps/api/src/modules/ambientes/ambientes.service.js';

describe('Soft Delete Global Pattern (Unit)', () => {
  let service: AmbientesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      ambientes: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new AmbientesService(mockPrisma as any);
  });

  it('deve realizar exclusão lógica sem invocar deleção física no PostgreSQL', async () => {
    mockPrisma.ambientes.findFirst.mockResolvedValueOnce({
      id: 'amb-1',
      nome: 'Laboratório de Automação',
      ativo: true,
      excluido_em: null,
    });

    mockPrisma.ambientes.update.mockResolvedValueOnce({
      id: 'amb-1',
      nome: 'Laboratório de Automação',
      ativo: false,
      excluido_em: new Date(),
      excluido_por: 'user-admin-1',
    });

    const result = await service.remove('amb-1', 'user-admin-1');

    // Valida que o update com soft-delete foi executado
    expect(mockPrisma.ambientes.update).toHaveBeenCalledWith({
      where: { id: 'amb-1' },
      data: expect.objectContaining({
        ativo: false,
        excluido_por: 'user-admin-1',
        excluido_em: expect.any(Date),
      }),
    });

    // Garante com 100% de rigor que NENHUMA exclusão física foi chamada
    expect(mockPrisma.ambientes.delete).not.toHaveBeenCalled();
    expect(result.ativo).toBe(false);
  });

  it('deve filtrar registros já excluídos nas listagens padrão', async () => {
    mockPrisma.ambientes.findMany.mockResolvedValueOnce([
      { id: 'amb-2', nome: 'Sala 101', ativo: true, excluido_em: null },
    ]);

    await service.findAll('unidade-1');

    expect(mockPrisma.ambientes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          excluido_em: null,
        }),
      }),
    );
  });
});
