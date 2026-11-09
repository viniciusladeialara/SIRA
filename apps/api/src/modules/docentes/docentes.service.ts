import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EventStoreService } from '../event-store/event-store.service.js';

@Injectable()
export class DocentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async findAll(tenantId?: string | null) {
    const where: any = { ativo: true, excluido_em: null };
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
    const docente = await this.prisma.docentes.findFirst({
      where: {
        OR: [
          { id },
          { usuario_id: id },
        ],
        excluido_em: null,
      },
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

    const docente = await this.prisma.docentes.create({
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

    // Registra evento imutável no Event Store (PRD Enterprise V2 - EPIC 4)
    await this.eventStore.recordEvent({
      tipo: 'DOCENTE_CRIADO',
      entidade: 'docentes',
      entidade_id: docente.id,
      payload: { nome: docente.nome, matricula: docente.matricula, especialidade: docente.especialidade },
      usuario_id: docente.usuario_id,
      unidade_id: docente.unidade_id,
    });

    return docente;
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

  async delete(id: string, executorId?: string) {
    await this.findById(id);
    return this.prisma.docentes.update({
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
