import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class CursosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId?: string | null) {
    const where: any = { ativo: true };
    if (tenantId) {
      where.unidade_id = tenantId;
    }
    return this.prisma.cursos.findMany({
      where,
      include: {
        unidades: {
          select: { id: true, nome: true, sigla: true, cidade: true },
        },
        turmas: {
          select: { id: true, codigo: true, nome: true, turno: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findById(id: string) {
    const curso = await this.prisma.cursos.findUnique({
      where: { id },
      include: {
        unidades: true,
        turmas: true,
      },
    });
    if (!curso) {
      throw new NotFoundException(`Curso com ID [${id}] não encontrado.`);
    }
    return curso;
  }

  async create(data: any, tenantId?: string | null) {
    const targetUnitId = data.unidade_id || tenantId;
    if (!targetUnitId) {
      throw new Error('unidade_id é obrigatório para cadastrar um curso.');
    }

    return this.prisma.cursos.create({
      data: {
        unidade_id: targetUnitId,
        codigo: data.codigo || data.code || `CRS-${Date.now().toString().slice(-4)}`,
        nome: data.nome || data.name,
        modalidade: data.modalidade || 'presencial',
        nivel: data.nivel || 'tecnico',
        carga_horaria: Number(data.carga_horaria || data.workload || 0),
        ativo: data.ativo !== undefined ? data.ativo : true,
      },
    });
  }

  async update(id: string, data: any) {
    await this.findById(id);
    const updateData: any = {};
    if (data.codigo || data.code) updateData.codigo = data.codigo || data.code;
    if (data.nome || data.name) updateData.nome = data.nome || data.name;
    if (data.modalidade) updateData.modalidade = data.modalidade;
    if (data.nivel) updateData.nivel = data.nivel;
    if (data.carga_horaria !== undefined || data.workload !== undefined) {
      updateData.carga_horaria = Number(data.carga_horaria ?? data.workload);
    }
    if (data.ativo !== undefined) updateData.ativo = data.ativo;

    return this.prisma.cursos.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.cursos.delete({
      where: { id },
    });
  }
}
