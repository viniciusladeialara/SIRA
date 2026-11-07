import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventStoreService } from '../../apps/api/src/modules/event-store/event-store.service.js';

describe('EventStoreService (Unit)', () => {
  let service: EventStoreService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      eventos: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new EventStoreService(mockPrisma as any);
  });

  it('deve persistir um evento de domínio imutável no banco', async () => {
    mockPrisma.eventos.create.mockResolvedValueOnce({
      id: 'evt-1',
      tipo: 'USUARIO_CRIADO',
      entidade: 'usuarios',
      entidade_id: 'usr-1',
      payload_jsonb: { nome: 'João' },
      criado_em: new Date(),
    });

    const evt = await service.recordEvent({
      tipo: 'USUARIO_CRIADO',
      entidade: 'usuarios',
      entidade_id: 'usr-1',
      payload: { nome: 'João' },
      usuario_id: 'admin-1',
      unidade_id: 'unit-cuiaba',
    });

    expect(evt).toBeDefined();
    expect(evt?.id).toBe('evt-1');
    expect(mockPrisma.eventos.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'USUARIO_CRIADO',
        entidade: 'usuarios',
        entidade_id: 'usr-1',
      }),
    });
  });

  it('deve consultar eventos por entidade e retornar ordenado cronologicamente', async () => {
    mockPrisma.eventos.findMany.mockResolvedValueOnce([
      { id: 'evt-1', tipo: 'DOCENTE_CRIADO', entidade: 'docentes', entidade_id: 'doc-1' },
    ]);

    const events = await service.getEventsByEntity('docentes', 'doc-1');

    expect(events).toHaveLength(1);
    expect(mockPrisma.eventos.findMany).toHaveBeenCalledWith({
      where: { entidade: 'docentes', entidade_id: 'doc-1' },
      orderBy: { criado_em: 'desc' },
    });
  });

  it('deve consultar eventos por tipo canônico', async () => {
    mockPrisma.eventos.findMany.mockResolvedValueOnce([
      { id: 'evt-2', tipo: 'SWAP_APROVADO' },
    ]);

    const events = await service.getEventsByType('SWAP_APROVADO');

    expect(events).toHaveLength(1);
    expect(mockPrisma.eventos.findMany).toHaveBeenCalledWith({
      where: { tipo: 'SWAP_APROVADO' },
      orderBy: { criado_em: 'desc' },
      take: 100,
    });
  });
});
