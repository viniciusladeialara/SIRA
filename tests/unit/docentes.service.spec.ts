import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocentesService } from '../../apps/api/src/modules/docentes/docentes.service.js';

describe('DocentesService Soft Delete & Event Store (Unit)', () => {
  let service: DocentesService;
  let mockPrisma: any;
  let mockEventStore: any;

  beforeEach(() => {
    mockPrisma = {
      docentes: {
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

    service = new DocentesService(mockPrisma as any, mockEventStore as any);
  });

  it('deve cadastrar docente e emitir evento DOCENTE_CRIADO', async () => {
    mockPrisma.docentes.create.mockResolvedValueOnce({
      id: 'doc-1',
      nome: 'Prof. Lucas',
      unidade_id: 'unit-1',
      carga_horaria_max: 40,
      ativo: true,
    });

    const doc = await service.create({
      nome: 'Prof. Lucas',
      unidade_id: 'unit-1',
      matricula: 'DOC-123',
    });

    expect(doc.id).toBe('doc-1');
    expect(mockEventStore.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'DOCENTE_CRIADO',
        entidade: 'docentes',
        entidade_id: 'doc-1',
      }),
    );
  });

  it('deve realizar soft delete do docente', async () => {
    mockPrisma.docentes.findFirst.mockResolvedValueOnce({
      id: 'doc-1',
      nome: 'Prof. Lucas',
      ativo: true,
      excluido_em: null,
    });

    mockPrisma.docentes.update.mockResolvedValueOnce({
      id: 'doc-1',
      ativo: false,
      excluido_em: new Date(),
      excluido_por: 'admin-1',
    });

    const res = await service.delete('doc-1', 'admin-1');

    expect(res.ativo).toBe(false);
    expect(mockPrisma.docentes.delete).not.toHaveBeenCalled();
  });
});
