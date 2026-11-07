import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EventStoreService } from '../event-store/event-store.service.js';

@Injectable()
export class SubstituicoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async findAll(tenantId?: string | null) {
    const where: any = {};
    if (tenantId) {
      where.unidade_id = tenantId;
    }
    return this.prisma.substituicoes.findMany({
      where,
      include: {
        agendamentos: {
          include: {
            turmas: true,
            ambientes: true,
          },
        },
        docentes_substituicoes_docente_original_idTodocentes: true,
        docentes_substituicoes_docente_substituto_idTodocentes: true,
        usuarios: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { solicitado_em: 'desc' },
    });
  }

  async findById(id: string) {
    const swap = await this.prisma.substituicoes.findUnique({
      where: { id },
      include: {
        agendamentos: true,
        docentes_substituicoes_docente_original_idTodocentes: true,
        docentes_substituicoes_docente_substituto_idTodocentes: true,
      },
    });
    if (!swap) {
      throw new NotFoundException(`Substituição com ID [${id}] não encontrada.`);
    }
    return swap;
  }

  async create(data: any, tenantId?: string | null) {
    const targetUnitId = data.unidade_id || tenantId;
    if (!targetUnitId) {
      throw new Error('unidade_id é obrigatório para registrar uma solicitação de troca.');
    }

    return this.prisma.substituicoes.create({
      data: {
        unidade_id: targetUnitId,
        agendamento_id: data.agendamento_id || data.scheduleId,
        docente_original_id: data.docente_original_id || data.originalTeacherId,
        docente_substituto_id: data.docente_substituto_id || data.substituteTeacherId,
        motivo: data.motivo || data.reason || null,
        status: data.status || 'pendente',
      },
      include: {
        agendamentos: true,
        docentes_substituicoes_docente_original_idTodocentes: true,
        docentes_substituicoes_docente_substituto_idTodocentes: true,
      },
    });
  }

  async updateStatus(id: string, status: string, userId?: string | null) {
    const swap = await this.findById(id);

    const updated = await this.prisma.substituicoes.update({
      where: { id },
      data: {
        status,
        avaliado_em: new Date(),
        avaliado_por: userId || null,
      },
    });

    // Se aprovada, atualiza o docente no agendamento correspondente
    if (status === 'aprovada' || status === 'aprovado' || status === 'approved') {
      await this.prisma.agendamentos.update({
        where: { id: swap.agendamento_id },
        data: {
          docente_id: swap.docente_substituto_id,
        },
      });

      // Registra evento imutável no Event Store (PRD Enterprise V2 - EPIC 4)
      await this.eventStore.recordEvent({
        tipo: 'SWAP_APROVADO',
        entidade: 'substituicoes',
        entidade_id: id,
        payload: {
          agendamentoId: swap.agendamento_id,
          docenteOriginalId: swap.docente_original_id,
          docenteSubstitutoId: swap.docente_substituto_id,
          avaliadoPor: userId,
        },
        usuario_id: userId,
        unidade_id: swap.unidade_id,
      });
    }

    return updated;
  }
}
