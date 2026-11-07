import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TurmasService } from '../../apps/api/src/modules/turmas/turmas.service.js';

describe('TurmasService Soft Delete & Event Store (Unit)', () => {
  let service: TurmasService;
  let mockPrisma: any;
  let mockEventStore: any;

  beforeEach(() => {
    mockPrisma = {
      turmas: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockEventStore = {
      recordEvent: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    service = new TurmasService(mockPrisma as any, mockEventStore as any);
  });

  it('deve cadastrar turma e registrar evento TURMA_CRIADA no Event Store', async () => {
    mockPrisma.turmas.create.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Desenvolvimento Web 2026',
      codigo: 'DEV-2026',
      unidade_id: 'unit-1',
      curso_id: 'curso-1',
      ativo: true,
    });

    const turma = await service.create({
      nome: 'Desenvolvimento Web 2026',
      codigo: 'DEV-2026',
      unidade_id: 'unit-1',
      curso_id: 'curso-1',
      turno: 'Noturno',
      data_inicio: new Date('2026-02-01'),
      data_fim: new Date('2026-12-01'),
    } as any);

    expect(turma.id).toBe('turma-1');
    expect(mockEventStore.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'TURMA_CRIADA',
        entidade: 'turmas',
        entidade_id: 'turma-1',
      }),
    );
  });

  it('deve executar soft delete na turma', async () => {
    mockPrisma.turmas.findFirst.mockResolvedValueOnce({
      id: 'turma-1',
      nome: 'Desenvolvimento Web 2026',
      ativo: true,
      excluido_em: null,
    });

    mockPrisma.turmas.update.mockResolvedValueOnce({
      id: 'turma-1',
      ativo: false,
      excluido_em: new Date(),
      excluido_por: 'admin-1',
    });

    const res = await service.delete('turma-1', 'admin-1');

    expect(res.ativo).toBe(false);
    expect(mockPrisma.turmas.delete).not.toHaveBeenCalled();
  });
});
