import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface CreateDomainEventDto {
  tipo: string;
  entidade: string;
  entidade_id: string;
  payload: any;
  usuario_id?: string | null;
  unidade_id?: string | null;
}

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava um evento de domínio imutável no Event Store (workflow.eventos)
   */
  async recordEvent(dto: CreateDomainEventDto) {
    try {
      const evento = await this.prisma.eventos.create({
        data: {
          tipo: dto.tipo,
          entidade: dto.entidade,
          entidade_id: String(dto.entidade_id),
          payload_jsonb: dto.payload || {},
          usuario_id: dto.usuario_id || null,
          unidade_id: dto.unidade_id || null,
        },
      });

      this.logger.log(`[EventStore] Evento gravado: ${dto.tipo} para ${dto.entidade}#${dto.entidade_id}`);
      return evento;
    } catch (error: any) {
      this.logger.error(`[EventStore] Falha ao persistir evento ${dto.tipo}:`, error.message);
      // Não quebra a transação principal caso o event store falhe
      return null;
    }
  }

  /**
   * Alias de conveniência para emitir eventos
   */
  async emit(dto: {
    tipo: string;
    entidade: string;
    entidade_id: string;
    payload?: any;
    payload_jsonb?: any;
    usuario_id?: string | null;
    unidade_id?: string | null;
  }) {
    return this.recordEvent({
      tipo: dto.tipo,
      entidade: dto.entidade,
      entidade_id: dto.entidade_id,
      payload: dto.payload ?? dto.payload_jsonb ?? {},
      usuario_id: dto.usuario_id,
      unidade_id: dto.unidade_id,
    });
  }

  /**
   * Consulta eventos por entidade e ID
   */
  async getEventsByEntity(entidade: string, entidadeId: string) {
    return this.prisma.eventos.findMany({
      where: {
        entidade,
        entidade_id: String(entidadeId),
      },
      orderBy: { criado_em: 'desc' },
    });
  }

  /**
   * Consulta eventos recentes por tipo ou unidade
   */
  async getRecentEvents(filter: { tipo?: string; unidadeId?: string; limit?: number }) {
    const where: any = {};
    if (filter.tipo) where.tipo = filter.tipo;
    if (filter.unidadeId) where.unidade_id = filter.unidadeId;

    return this.prisma.eventos.findMany({
      where,
      orderBy: { criado_em: 'desc' },
      take: filter.limit || 50,
    });
  }

  /**
   * Consulta eventos específicos por tipo canônico
   */
  async getEventsByType(tipo: string, limit = 100) {
    return this.getRecentEvents({ tipo, limit });
  }
}
