import { Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  /**
   * Converte uma coleção de objetos para CSV formatado em UTF-8 com BOM (compatível com Excel)
   */
  toCsv(data: Record<string, any>[]): Buffer {
    if (!data || data.length === 0) {
      return Buffer.from('\uFEFF', 'utf-8');
    }

    const headers = Object.keys(data[0]);
    const escapeCsvField = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headerLine = headers.map(escapeCsvField).join(',');
    const rows = data.map((row) => headers.map((key) => escapeCsvField(row[key])).join(','));

    // Adiciona BOM (\uFEFF) para garantir abertura correta no Microsoft Excel
    const csvContent = '\uFEFF' + [headerLine, ...rows].join('\r\n');
    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Gera uma planilha Excel moderna (.xlsx) com cabeçalhos estilizados e auto-ajuste de colunas
   */
  async toXlsx(data: Record<string, any>[], sheetName = 'Relatorio SIRA'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIRA Enterprise';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));

    if (!data || data.length === 0) {
      worksheet.addRow(['Nenhum dado encontrado para os filtros selecionados.']);
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(arrayBuffer);
    }

    const columns = Object.keys(data[0]).map((key) => ({
      header: key.replace(/_/g, ' ').toUpperCase(),
      key,
      width: Math.max(key.length + 5, 14),
    }));

    worksheet.columns = columns;

    // Estiliza o cabeçalho
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Adiciona as linhas
    data.forEach((item) => {
      worksheet.addRow(item);
    });

    // Auto-ajuste de largura de colunas
    worksheet.columns.forEach((column) => {
      let maxLen = (column.header as string)?.length || 10;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellLen = cell.value ? String(cell.value).length : 0;
        if (cellLen > maxLen) maxLen = Math.min(cellLen, 50);
      });
      column.width = maxLen + 3;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Gera um relatório em formato PDF corporativo com tabela e numeração de páginas
   */
  async toPdf(
    title: string,
    data: Record<string, any>[],
    unitName = 'Todas as Unidades',
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Cabeçalho Corporativo
      doc.fontSize(18).fillColor('#0f172a').text('SIRA - Sistema Integrado de Recursos Acadêmicos', {
        align: 'left',
      });
      doc.fontSize(14).fillColor('#334155').text(title, { align: 'left' });
      doc
        .fontSize(9)
        .fillColor('#64748b')
        .text(
          `Unidade: ${unitName} | Gerado em: ${new Date().toLocaleString('pt-BR')} | Total de Registros: ${data.length}`,
          { align: 'left' },
        );
      doc.moveDown(1);

      if (!data || data.length === 0) {
        doc.fontSize(11).fillColor('#dc2626').text('Nenhum registro localizado no período.');
        doc.end();
        return;
      }

      const keys = Object.keys(data[0]).slice(0, 7); // Limita colunas na horizontal para caber na página
      const colWidth = (doc.page.width - 80) / keys.length;
      let startY = doc.y;

      // Desenha cabeçalho da tabela
      doc.rect(40, startY, doc.page.width - 80, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');

      keys.forEach((key, i) => {
        doc.text(
          key.replace(/_/g, ' ').toUpperCase(),
          45 + i * colWidth,
          startY + 5,
          { width: colWidth - 10, align: 'left', ellipsis: true },
        );
      });

      startY += 20;
      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');

      // Desenha linhas
      data.slice(0, 100).forEach((row, rowIndex) => {
        if (startY > doc.page.height - 50) {
          doc.addPage();
          startY = 40;
        }

        if (rowIndex % 2 === 1) {
          doc.rect(40, startY, doc.page.width - 80, 18).fill('#f8fafc');
        }

        doc.fillColor('#334155');
        keys.forEach((key, i) => {
          const val = row[key] !== null && row[key] !== undefined ? String(row[key]) : '-';
          doc.text(val, 45 + i * colWidth, startY + 4, {
            width: colWidth - 10,
            align: 'left',
            ellipsis: true,
          });
        });

        startY += 18;
      });

      doc.end();
    });
  }
}
