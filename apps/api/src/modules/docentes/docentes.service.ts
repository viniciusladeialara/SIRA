import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class DocentesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId?: string | null) {
    const where: any = { ativo: true };
    if (tenantId) {
      where.unidade_id = tenantId;
    }
    return this.prisma.docentes.findMany({
      where,
      include: {
        unidades: {
          select: { id: true, nome: true, sigla: true, cidade: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findById(id: string) {
    const docente = await this.prisma.docentes.findUnique({
      where: { id },
      include: {
        unidades: true,
        usuarios: true,
      },
    });
    if (!docente) {
      throw new NotFoundException(`Docente com ID [${id}] não encontrado.`);
    }
    return docente;
  }

  async create(data: any, tenantId?: string | null) {
    const targetUnitId = data.unidade_id || tenantId;
    if (!targetUnitId) {
      throw new Error('unidade_id é obrigatório para cadastrar um docente.');
    }

    return this.prisma.docentes.create({
      data: {
        unidade_id: targetUnitId,
        usuario_id: data.usuario_id || null,
        nome: data.nome || data.name,
        email: data.email || null,
        matricula: data.matricula || data.registration || `DOC-${Date.now().toString().slice(-4)}`,
        telefone: data.telefone || data.phone || null,
        especialidade: data.especialidade || data.specialty || 'Geral',
        carga_horaria_max: Number(data.carga_horaria_max || data.maxWeeklyHours || 40),
        ativo: data.ativo !== undefined ? data.ativo : true,
      },
    });
  }

  async update(id: string, data: any) {
    await this.findById(id);
    const updateData: any = {};
    if (data.nome || data.name) updateData.nome = data.nome || data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.matricula || data.registration) updateData.matricula = data.matricula || data.registration;
    if (data.telefone || data.phone) updateData.telefone = data.telefone || data.phone;
    if (data.especialidade || data.specialty) updateData.especialidade = data.especialidade || data.specialty;
    if (data.carga_horaria_max !== undefined || data.maxWeeklyHours !== undefined) {
      updateData.carga_horaria_max = Number(data.carga_horaria_max ?? data.maxWeeklyHours);
    }
    if (data.ativo !== undefined) updateData.ativo = data.ativo;

    return this.prisma.docentes.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.docentes.delete({
      where: { id },
    });
  }
}
