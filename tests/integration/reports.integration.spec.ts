import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportsService } from '../../apps/api/src/modules/reports/reports.service.js';
import { ExportService } from '../../apps/api/src/modules/reports/export.service.js';

describe('Reports & Materialized Views Integration (Integration)', () => {
  let reportsService: ReportsService;
  let exportService: ExportService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRawUnsafe: vi.fn(),
    };

    exportService = new ExportService();
    reportsService = new ReportsService(mockPrisma as any, exportService);
  });

  it('deve executar o refresh concorrente de todas as Materialized Views', async () => {
    const res = await reportsService.refreshAllReports();

    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'SELECT relatorios.refresh_all_reports();',
    );
    expect(res.status).toBe('SUCESSO');
  });

  it('deve consultar ocupação de ambientes com filtro de tenant', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      {
        ambiente_id: 'amb-1',
        ambiente_nome: 'Lab Redes',
        unidade_id: 'unit-1',
        taxa_ocupacao_estimada_pct: 75.0,
      },
    ]);

    const res = await reportsService.getOcupacaoAmbientes('unit-1');

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM relatorios.vw_ocupacao_ambientes WHERE unidade_id = $1::uuid'),
      'unit-1',
    );
    expect(res).toHaveLength(1);
    expect(res[0].ambiente_nome).toBe('Lab Redes');
  });

  it('deve gerar exportação integrada nos formatos CSV, XLSX e PDF', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        ambiente_id: 'amb-1',
        ambiente_nome: 'Lab TI',
        unidade_id: 'unit-1',
        taxa_ocupacao_estimada_pct: 80.0,
      },
    ]);

    const csvExport = await reportsService.exportReport('ocupacao_ambientes', 'csv', 'unit-1');
    expect(csvExport.contentType).toContain('text/csv');
    expect(csvExport.buffer.length).toBeGreaterThan(0);

    const xlsxExport = await reportsService.exportReport('ocupacao_ambientes', 'xlsx', 'unit-1');
    expect(xlsxExport.contentType).toContain('spreadsheetml');
    expect(xlsxExport.buffer.length).toBeGreaterThan(0);

    const pdfExport = await reportsService.exportReport('ocupacao_ambientes', 'pdf', 'unit-1');
    expect(pdfExport.contentType).toContain('application/pdf');
    expect(pdfExport.buffer.length).toBeGreaterThan(0);
  });
});
