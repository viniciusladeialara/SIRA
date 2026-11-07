import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CursosService } from '../../apps/api/src/modules/cursos/cursos.service.js';

describe('CursosService Soft Delete (Unit)', () => {
  let service: CursosService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      cursos: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new CursosService(mockPrisma as any);
  });

  it('deve listar cursos ativos omitindo registros excluídos', async () => {
    mockPrisma.cursos.findMany.mockResolvedValueOnce([
      { id: 'c-1', nome: 'Técnico em Eletrotécnica', ativo: true },
    ]);

    const cursos = await service.findAll('unit-1');

    expect(cursos).toHaveLength(1);
    expect(mockPrisma.cursos.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          excluido_em: null,
        }),
      }),
    );
  });

  it('deve desativar curso via soft delete', async () => {
    mockPrisma.cursos.findFirst.mockResolvedValueOnce({
      id: 'c-1',
      nome: 'Técnico em Eletrotécnica',
      ativo: true,
      excluido_em: null,
    });

    mockPrisma.cursos.update.mockResolvedValueOnce({
      id: 'c-1',
      ativo: false,
      excluido_em: new Date(),
      excluido_por: 'admin-1',
    });

    const res = await service.delete('c-1', 'admin-1');

    expect(res.ativo).toBe(false);
    expect(mockPrisma.cursos.delete).not.toHaveBeenCalled();
  });
});
