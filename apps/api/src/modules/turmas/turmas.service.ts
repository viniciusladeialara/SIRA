import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class TurmasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId?: string | null) {
    const where: any = { ativo: true };
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
    const turma = await this.prisma.turmas.findUnique({
      where: { id },
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

    return this.prisma.turmas.create({
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

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.turmas.delete({
      where: { id },
    });
  }
}
