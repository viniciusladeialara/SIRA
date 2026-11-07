import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EventStoreService } from '../event-store/event-store.service.js';

@Injectable()
export class AgendamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async findAll(tenantId?: string | null, filters?: { start?: string; end?: string; roomId?: string; teacherId?: string }) {
    const where: any = {};
    if (tenantId) {
      where.unidade_id = tenantId;
    }
    if (filters?.roomId) {
      where.ambiente_id = filters.roomId;
    }
    if (filters?.teacherId) {
      where.docente_id = filters.teacherId;
    }
    if (filters?.start && filters?.end) {
      where.data_inicio = { gte: new Date(filters.start) };
      where.data_fim = { lte: new Date(filters.end) };
    }

    return this.prisma.agendamentos.findMany({
      where,
      include: {
        turmas: {
          select: { id: true, codigo: true, nome: true, turno: true },
        },
        ambientes: {
          select: { id: true, nome: true, tipo: true, bloco: true, andar: true },
        },
        docentes: {
          select: { id: true, nome: true, email: true, especialidade: true },
        },
        unidades: {
          select: { id: true, nome: true, sigla: true, cidade: true },
        },
      },
      orderBy: { data_inicio: 'asc' },
    });
  }

  async findById(id: string) {
    const agendamento = await this.prisma.agendamentos.findUnique({
      where: { id },
      include: {
        turmas: true,
        ambientes: true,
        docentes: true,
        unidades: true,
      },
    });
    if (!agendamento) {
      throw new NotFoundException(`Agendamento com ID [${id}] não encontrado.`);
    }
    return agendamento;
  }

  async checkConflicts(ambienteId: string, docenteId: string, dataInicio: Date, dataFim: Date, excludeId?: string) {
    const whereAmbiente: any = {
      ambiente_id: ambienteId,
      status: { not: 'cancelado' },
      AND: [
        { data_inicio: { lt: dataFim } },
        { data_fim: { gt: dataInicio } },
      ],
    };
    if (excludeId) whereAmbiente.id = { not: excludeId };

    const ambienteConflict = await this.prisma.agendamentos.findFirst({
      where: whereAmbiente,
      include: { ambientes: true, turmas: true },
    });

    if (ambienteConflict) {
      const ambNome = ambienteConflict.ambientes?.nome || 'Ambiente Selecionado';
      const turmaNome = ambienteConflict.turmas?.nome || 'Outra Turma';
      throw new ConflictException(
        `Conflito de Ambiente: O ambiente "${ambNome}" já está alocado para a turma "${turmaNome}" neste horário.`,
      );
    }

    const whereDocente: any = {
      docente_id: docenteId,
      status: { not: 'cancelado' },
      AND: [
        { data_inicio: { lt: dataFim } },
        { data_fim: { gt: dataInicio } },
      ],
    };
    if (excludeId) whereDocente.id = { not: excludeId };

    const docenteConflict = await this.prisma.agendamentos.findFirst({
      where: whereDocente,
      include: { docentes: true, turmas: true },
    });

    if (docenteConflict) {
      const docNome = docenteConflict.docentes?.nome || 'Docente Selecionado';
      const turmaNome = docenteConflict.turmas?.nome || 'Outra Turma';
      throw new ConflictException(
        `Conflito de Docente: O(A) professor(a) "${docNome}" já possui aula agendada com a turma "${turmaNome}" neste horário.`,
      );
    }
  }

  async create(data: any, tenantId?: string | null, userId?: string | null) {
    const targetUnitId = data.unidade_id || data.unitId || tenantId;
    if (!targetUnitId) {
      throw new Error('unidade_id é obrigatório para criar um agendamento.');
    }

    const turmaId = data.turma_id || data.classId;
    const ambienteId = data.ambiente_id || data.roomId;
    const docenteId = data.docente_id || data.teacherId;
    const dataInicio = new Date(data.data_inicio || data.startTime);
    const dataFim = new Date(data.data_fim || data.endTime);

    if (!data.ignoreLimits) {
      await this.checkConflicts(ambienteId, docenteId, dataInicio, dataFim);
    }

    const agendamento = await this.prisma.agendamentos.create({
      data: {
        unidade_id: targetUnitId,
        turma_id: turmaId,
        ambiente_id: ambienteId,
        docente_id: docenteId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        status: data.status || 'agendado',
        observacao: data.observacao || data.observation || null,
        criado_por: userId || null,
      },
      include: {
        turmas: true,
        ambientes: true,
        docentes: true,
      },
    });

    // Registra evento imutável no Event Store (PRD Enterprise V2 - EPIC 4)
    await this.eventStore.recordEvent({
      tipo: 'AGENDAMENTO_CRIADO',
      entidade: 'agendamentos',
      entidade_id: agendamento.id,
      payload: {
        turmaId,
        ambienteId,
        docenteId,
        dataInicio: agendamento.data_inicio,
        dataFim: agendamento.data_fim,
      },
      usuario_id: userId,
      unidade_id: targetUnitId,
    });

    return agendamento;
  }

  async update(id: string, data: any) {
    const existing = await this.findById(id);

    const ambienteId = data.ambiente_id || data.roomId || existing.ambiente_id;
    const docenteId = data.docente_id || data.teacherId || existing.docente_id;
    const dataInicio = data.data_inicio || data.startTime ? new Date(data.data_inicio || data.startTime) : existing.data_inicio;
    const dataFim = data.data_fim || data.endTime ? new Date(data.data_fim || data.endTime) : existing.data_fim;

    if (!data.ignoreLimits) {
      await this.checkConflicts(ambienteId, docenteId, dataInicio, dataFim, id);
    }

    const updateData: any = {};
    if (data.turma_id || data.classId) updateData.turma_id = data.turma_id || data.classId;
    if (data.ambiente_id || data.roomId) updateData.ambiente_id = data.ambiente_id || data.roomId;
    if (data.docente_id || data.teacherId) updateData.docente_id = data.docente_id || data.teacherId;
    updateData.data_inicio = dataInicio;
    updateData.data_fim = dataFim;
    if (data.status) updateData.status = data.status;
    if (data.observacao !== undefined || data.observation !== undefined) {
      updateData.observacao = data.observacao || data.observation;
    }

    return this.prisma.agendamentos.update({
      where: { id },
      data: updateData,
      include: {
        turmas: true,
        ambientes: true,
        docentes: true,
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.agendamentos.delete({
      where: { id },
    });
  }
}
