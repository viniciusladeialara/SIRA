import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgendamentosService } from '../../apps/api/src/modules/agendamentos/agendamentos.service.js';
import { ConflictException } from '@nestjs/common';

describe('Academic Lifecycle & Scheduling Conflict Engine (Integration)', () => {
  let agendamentosService: AgendamentosService;
  let mockPrisma: any;
  let mockEventStore: any;

  beforeEach(() => {
    mockPrisma = {
      agendamentos: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      ambientes: {
        findUnique: vi.fn(),
      },
      docentes: {
        findUnique: vi.fn(),
      },
      turmas: {
        findUnique: vi.fn(),
      },
      feriados: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    mockEventStore = {
      recordEvent: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      emit: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    agendamentosService = new AgendamentosService(mockPrisma as any, mockEventStore as any);
  });

  it('deve bloquear criação de agendamento com conflito de horário no mesmo ambiente', async () => {
    const dataInicio = new Date('2026-03-01T08:00:00Z');
    const dataFim = new Date('2026-03-01T12:00:00Z');

    // Simula ambiente já ocupado
    mockPrisma.agendamentos.findFirst.mockResolvedValueOnce({
      id: 'ag-existente',
      ambiente_id: 'amb-1',
      data_inicio: dataInicio,
      data_fim: dataFim,
      status: 'CONFIRMADO',
      ambientes: { nome: 'Laboratório de Automação' },
      turmas: { nome: 'Mecatrônica 2026' },
    });

    await expect(
      agendamentosService.create({
        unidade_id: 'unit-1',
        turma_id: 'turma-1',
        ambiente_id: 'amb-1',
        docente_id: 'docente-1',
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('deve permitir agendamento em horário livre e emitir evento AGENDAMENTO_CRIADO', async () => {
    const dataInicio = new Date('2026-03-01T14:00:00Z');
    const dataFim = new Date('2026-03-01T18:00:00Z');

    mockPrisma.agendamentos.findFirst.mockResolvedValue(null);
    mockPrisma.agendamentos.create.mockResolvedValueOnce({
      id: 'ag-novo',
      unidade_id: 'unit-1',
      turma_id: 'turma-1',
      ambiente_id: 'amb-1',
      docente_id: 'docente-1',
      data_inicio: dataInicio,
      data_fim: dataFim,
      status: 'CONFIRMADO',
    });

    const ag = await agendamentosService.create({
      unidade_id: 'unit-1',
      turma_id: 'turma-1',
      ambiente_id: 'amb-1',
      docente_id: 'docente-1',
      data_inicio: dataInicio.toISOString(),
      data_fim: dataFim.toISOString(),
    } as any);

    expect(ag.id).toBe('ag-novo');
    expect(mockEventStore.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'AGENDAMENTO_CRIADO',
        entidade: 'agendamentos',
        entidade_id: 'ag-novo',
      }),
    );
  });
});
