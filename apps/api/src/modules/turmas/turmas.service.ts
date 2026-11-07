import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EventStoreService } from '../event-store/event-store.service.js';

@Injectable()
export class TurmasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async findAll(tenantId?: string | null) {
    const where: any = { ativo: true, excluido_em: null };
    if (tenantId) {
      where.unidade_id = tenantId;
    }
    return this.prisma.turmas.findMany({
      where,
      include: {
        cursos: {
          select: { id: true, codigo: true, nome: true, modalidade: true },
        },
        unidades: {
          select: { id: true, nome: true, sigla: true, cidade: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findById(id: string) {
    const turma = await this.prisma.turmas.findFirst({
      where: { id, excluido_em: null },
      include: {
        cursos: true,
        unidades: true,
        agendamentos: {
          include: {
            ambientes: true,
            docentes: true,
          },
        },
      },
    });
    if (!turma) {
      throw new NotFoundException(`Turma com ID [${id}] não encontrada.`);
    }
    return turma;
  }

  async create(data: any, tenantId?: string | null) {
    const targetUnitId = data.unidade_id || data.unitId || tenantId;
    if (!targetUnitId) {
      throw new Error('unidade_id é obrigatório para cadastrar uma turma.');
    }

    const turma = await this.prisma.turmas.create({
      data: {
        unidade_id: targetUnitId,
        curso_id: data.curso_id || data.courseId,
        codigo: data.codigo || data.code || `TRM-${Date.now().toString().slice(-4)}`,
        nome: data.nome || data.name,
        turno: data.turno || data.shift || 'Noturno',
        data_inicio: new Date(data.data_inicio || data.startDate || new Date()),
        data_fim: new Date(data.data_fim || data.endDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)),
        vagas: Number(data.vagas || data.studentsCount || 30),
        ativo: data.ativo !== undefined ? data.ativo : true,
      },
    });

    // Registra evento imutável no Event Store (PRD Enterprise V2 - EPIC 4)
    await this.eventStore.recordEvent({
      tipo: 'TURMA_CRIADA',
      entidade: 'turmas',
      entidade_id: turma.id,
      payload: { codigo: turma.codigo, nome: turma.nome, curso_id: turma.curso_id, vagas: turma.vagas },
      unidade_id: turma.unidade_id,
    });

    return turma;
  }

  async update(id: string, data: any) {
    await this.findById(id);
    const updateData: any = {};
    if (data.curso_id || data.courseId) updateData.curso_id = data.curso_id || data.courseId;
    if (data.codigo || data.code) updateData.codigo = data.codigo || data.code;
    if (data.nome || data.name) updateData.nome = data.nome || data.name;
    if (data.turno || data.shift) updateData.turno = data.turno || data.shift;
    if (data.data_inicio || data.startDate) updateData.data_inicio = new Date(data.data_inicio || data.startDate);
    if (data.data_fim || data.endDate) updateData.data_fim = new Date(data.data_fim || data.endDate);
    if (data.vagas !== undefined || data.studentsCount !== undefined) {
      updateData.vagas = Number(data.vagas ?? data.studentsCount);
    }
    if (data.ativo !== undefined) updateData.ativo = data.ativo;

    return this.prisma.turmas.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string, executorId?: string) {
    await this.findById(id);
    return this.prisma.turmas.update({
      where: { id },
      data: {
        ativo: false,
        excluido_em: new Date(),
        excluido_por: executorId || null,
        atualizado_em: new Date(),
      },
    });
  }
}
