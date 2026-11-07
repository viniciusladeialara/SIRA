import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowService } from '../../apps/api/src/modules/workflow/workflow.service.js';

describe('WorkflowService (Unit)', () => {
  let service: WorkflowService;
  let mockPrisma: any;
  let mockEventStore: any;

  beforeEach(() => {
    mockPrisma = {
      fluxos: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      etapas: {
        create: vi.fn(),
      },
      solicitacoes: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      historicos: {
        create: vi.fn(),
      },
      aprovacoes: {
        create: vi.fn(),
      },
      assinaturas: {
        create: vi.fn(),
      },
    };

    mockEventStore = {
      recordEvent: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    service = new WorkflowService(mockPrisma as any, mockEventStore as any);
  });

  it('deve abrir uma solicitação de workflow e emitir evento imutável', async () => {
    vi.spyOn(service, 'ensureDefaultFlows').mockResolvedValue(undefined as any);

    mockPrisma.fluxos.findUnique.mockResolvedValueOnce({
      id: 'fluxo-1',
      codigo: 'TROCA_DOCENTE',
      etapas: [{ id: 'etapa-1', ordem: 1, nome: 'Parecer Coordenação' }],
    });

    mockPrisma.solicitacoes.create.mockResolvedValueOnce({
      id: 'sol-123',
      fluxo_id: 'fluxo-1',
      solicitante_id: 'user-1',
      status: 'pendente',
    });

    const result = await service.openRequest({
      fluxoCodigo: 'TROCA_DOCENTE',
      solicitanteId: 'user-1',
      tipo: 'SUBSTITUICAO',
      dados: { motivo: 'Licença médica' },
    });

    expect(result.id).toBe('sol-123');
    expect(mockPrisma.historicos.create).toHaveBeenCalled();
    expect(mockEventStore.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'SOLICITACAO_WORKFLOW_ABERTA',
        entidade: 'solicitacoes',
        entidade_id: 'sol-123',
      }),
    );
  });
});
