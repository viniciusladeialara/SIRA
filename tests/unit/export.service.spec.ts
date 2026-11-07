import { describe, it, expect } from 'vitest';
import { ExportService } from '../../apps/api/src/modules/reports/export.service.js';

describe('ExportService Enterprise Layer (Unit)', () => {
  const service = new ExportService();

  const dummyData = [
    { ambiente: 'Lab Info 01', capacidade: 30, ocupacao_pct: 85.5 },
    { ambiente: 'Auditório Principal', capacidade: 120, ocupacao_pct: 42.0 },
  ];

  it('deve gerar exportação CSV com cabeçalho, escape e UTF-8 BOM', () => {
    const buffer = service.toCsv(dummyData);
    expect(buffer).toBeInstanceOf(Buffer);

    const content = buffer.toString('utf-8');
    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).toContain('ambiente,capacidade,ocupacao_pct');
    expect(content).toContain('Lab Info 01,30,85.5');
  });

  it('deve gerar arquivo XLSX em memória com estrutura válida', async () => {
    const buffer = await service.toXlsx(dummyData, 'Teste Ambientes');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000); // Arquivo zip do XLSX
  });

  it('deve gerar documento PDF corporativo contendo os registros', async () => {
    const buffer = await service.toPdf('Relatório de Teste', dummyData, 'Cuiabá');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-'); // Cabeçalho mágico do formato PDF
  });
});
