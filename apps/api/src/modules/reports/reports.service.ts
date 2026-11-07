import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ExportService } from './export.service.js';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Dispara o recálculo atômico e concorrente de todas as Materialized Views de relatórios
   */
  async refreshAllReports() {
    this.logger.log('Disparando refresh concorrente das Materialized Views...');
    await this.prisma.$executeRawUnsafe(`SELECT relatorios.refresh_all_reports();`);
    this.logger.log('Refresh das Materialized Views concluído com sucesso.');
    return { status: 'SUCESSO', mensagem: 'Materialized Views atualizadas com sucesso.' };
  }

  /**
   * Consulta analítica de ocupação de ambientes com taxa estimada
   */
  async getOcupacaoAmbientes(unidadeId?: string | null) {
    if (unidadeId) {
      return this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM relatorios.vw_ocupacao_ambientes WHERE unidade_id = $1::uuid ORDER BY taxa_ocupacao_estimada_pct DESC`,
        unidadeId,
      );
    }
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM relatorios.vw_ocupacao_ambientes ORDER BY taxa_ocupacao_estimada_pct DESC`,
    );
  }

  /**
   * Consulta analítica de carga horária e alocação docente
   */
  async getCargaDocentes(unidadeId?: string | null) {
    if (unidadeId) {
      return this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM relatorios.vw_carga_docentes WHERE unidade_id = $1::uuid ORDER BY total_horas_alocadas DESC`,
        unidadeId,
      );
    }
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM relatorios.vw_carga_docentes ORDER BY total_horas_alocadas DESC`,
    );
  }

  /**
   * Consulta analítica de turmas ativas e progresso de agendamentos
   */
  async getTurmasAtivas(unidadeId?: string | null) {
    if (unidadeId) {
      return this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM relatorios.vw_turmas_ativas WHERE unidade_id = $1::uuid ORDER BY ano_letivo DESC, turma_nome ASC`,
        unidadeId,
      );
    }
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM relatorios.vw_turmas_ativas ORDER BY ano_letivo DESC, turma_nome ASC`,
    );
  }

  /**
   * Consulta analítica de detecção preditiva e ativa de conflitos de agendamento
   */
  async getConflitos(unidadeId?: string | null) {
    if (unidadeId) {
      return this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM relatorios.vw_conflitos WHERE unidade_id = $1::uuid ORDER BY inicio_sobreposicao DESC`,
        unidadeId,
      );
    }
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM relatorios.vw_conflitos ORDER BY inicio_sobreposicao DESC`,
    );
  }

  /**
   * Exportador unificado desacoplado (CSV, XLSX, PDF)
   */
  async exportReport(
    reportName: 'ocupacao_ambientes' | 'carga_docentes' | 'turmas_ativas' | 'conflitos',
    format: 'csv' | 'xlsx' | 'pdf',
    unidadeId?: string | null,
    unitName = 'Todas as Unidades',
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    let data: any[] = [];
    let title = '';

    switch (reportName) {
      case 'ocupacao_ambientes':
        data = await this.getOcupacaoAmbientes(unidadeId);
        title = 'Relatório de Ocupação de Ambientes e Salas';
        break;
      case 'carga_docentes':
        data = await this.getCargaDocentes(unidadeId);
        title = 'Relatório de Carga Horária e Alocação Docente';
        break;
      case 'turmas_ativas':
        data = await this.getTurmasAtivas(unidadeId);
        title = 'Relatório de Turmas Ativas e Agendamentos';
        break;
      case 'conflitos':
        data = await this.getConflitos(unidadeId);
        title = 'Relatório de Conflitos e Sobreposições de Horários';
        break;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const baseFilename = `sira_${reportName}_${timestamp}`;

    if (format === 'csv') {
      const buffer = this.exportService.toCsv(data);
      return {
        buffer,
        contentType: 'text/csv; charset=utf-8',
        filename: `${baseFilename}.csv`,
      };
    }

    if (format === 'xlsx') {
      const buffer = await this.exportService.toXlsx(data, title);
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${baseFilename}.xlsx`,
      };
    }

    if (format === 'pdf') {
      const buffer = await this.exportService.toPdf(title, data, unitName);
      return {
        buffer,
        contentType: 'application/pdf',
        filename: `${baseFilename}.pdf`,
      };
    }

    throw new Error(`Formato de exportação inválido: ${format}`);
  }
}
