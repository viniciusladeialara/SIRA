import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubstituicoesService } from '../../apps/api/src/modules/substituicoes/substituicoes.service.js';

describe('SubstituicoesService & Event Store (Unit)', () => {
  let service: SubstituicoesService;
  let mockPrisma: any;
  let mockEventStore: any;

  beforeEach(() => {
    mockPrisma = {
      substituicoes: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      agendamentos: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    mockEventStore = {
      recordEvent: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    service = new SubstituicoesService(mockPrisma as any, mockEventStore as any);
  });

  it('deve aprovar substituição, atualizar agendamento e emitir evento SWAP_APROVADO', async () => {
    mockPrisma.substituicoes.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      agendamento_id: 'ag-1',
      docente_original_id: 'doc-orig',
      docente_substituto_id: 'doc-sub',
      status: 'pendente',
    });

    mockPrisma.substituicoes.update.mockResolvedValueOnce({
      id: 'sub-1',
      status: 'aprovado',
      aprovado_por: 'admin-1',
      aprovado_em: new Date(),
    });

    const res = await service.updateStatus('sub-1', 'aprovado', 'admin-1');

    expect(res.status).toBe('aprovado');
    expect(mockPrisma.agendamentos.update).toHaveBeenCalledWith({
      where: { id: 'ag-1' },
      data: { docente_id: 'doc-sub' },
    });
    expect(mockEventStore.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'SWAP_APROVADO',
        entidade: 'substituicoes',
        entidade_id: 'sub-1',
      }),
    );
  });
});
