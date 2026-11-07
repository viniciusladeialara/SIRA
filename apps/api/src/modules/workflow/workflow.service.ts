import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EventStoreService } from '../event-store/event-store.service.js';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  /**
   * Garante a existência dos fluxos fundamentais do SIRA no banco
   */
  async ensureDefaultFlows() {
    const defaultFlows = [
      {
        codigo: 'TROCA_DOCENTE',
        nome: 'Fluxo de Permuta / Substituição Docente',
        descricao: 'Aprovação de troca de turno ou substituição entre docentes',
        etapas: [
          { ordem: 1, nome: 'Parecer da Coordenação Pedagógica', perfil_aprovador: 'administrador' },
          { ordem: 2, nome: 'Homologação da Direção Escolar', perfil_aprovador: 'administrador' },
        ],
      },
      {
        codigo: 'RESERVA_EXTRAORDINARIA',
        nome: 'Fluxo de Reserva Extraordinária de Ambiente',
        descricao: 'Alocação especial fora da grade curricular padrão',
        etapas: [
          { ordem: 1, nome: 'Validação de Disponibilidade', perfil_aprovador: 'administrador' },
        ],
      },
      {
        codigo: 'PROMOCAO_BANCO',
        nome: 'Fluxo de Promoção Teste para Produção',
        descricao: 'Validação técnica e homologação com senha de administrador',
        etapas: [
          { ordem: 1, nome: 'Auditoria e Concorrência Atômica', perfil_aprovador: 'administrador' },
        ],
      },
    ];

    for (const f of defaultFlows) {
      const existing = await this.prisma.fluxos.findUnique({ where: { codigo: f.codigo } });
      if (!existing) {
        const fluxo = await this.prisma.fluxos.create({
          data: {
            codigo: f.codigo,
            nome: f.nome,
            descricao: f.descricao,
          },
        });

        for (const e of f.etapas) {
          await this.prisma.etapas.create({
            data: {
              fluxo_id: fluxo.id,
              ordem: e.ordem,
              nome: e.nome,
              perfil_aprovador: e.perfil_aprovador,
            },
          });
        }
      }
    }
  }

  /**
   * Abre uma nova solicitação de workflow
   */
  async openRequest(params: {
    fluxoCodigo: string;
    solicitanteId: string;
    unidadeId?: string | null;
    tipo: string;
    dados: any;
  }) {
    await this.ensureDefaultFlows();

    const fluxo = await this.prisma.fluxos.findUnique({
      where: { codigo: params.fluxoCodigo },
      include: { etapas: { orderBy: { ordem: 'asc' } } },
    });

    if (!fluxo) {
      throw new NotFoundException(`Fluxo com código [${params.fluxoCodigo}] não encontrado.`);
    }

    const solicitacao = await this.prisma.solicitacoes.create({
      data: {
        fluxo_id: fluxo.id,
        solicitante_id: params.solicitanteId,
        unidade_id: params.unidadeId || null,
        tipo: params.tipo,
        status: 'pendente',
        dados_jsonb: params.dados,
      },
      include: {
        fluxos: { include: { etapas: true } },
      },
    });

    // Registra no histórico inicial
    await this.prisma.historicos.create({
      data: {
        solicitacao_id: solicitacao.id,
        de_status: 'novo',
        para_status: 'pendente',
        usuario_id: params.solicitanteId,
        motivo: 'Abertura da solicitação no motor de workflow',
      },
    });

    // Registra evento no Event Store
    await this.eventStore.recordEvent({
      tipo: 'SOLICITACAO_WORKFLOW_ABERTA',
      entidade: 'solicitacoes',
      entidade_id: solicitacao.id,
      payload: { fluxoCodigo: params.fluxoCodigo, tipo: params.tipo, dados: params.dados },
      usuario_id: params.solicitanteId,
      unidade_id: params.unidadeId,
    });

    return solicitacao;
  }

  /**
   * Avalia uma etapa de aprovação
   */
  async evaluateStep(params: {
    solicitacaoId: string;
    etapaId: string;
    aprovadorId: string;
    decisao: 'aprovado' | 'rejeitado' | 'devolvido';
    parecer?: string;
  }) {
    const solicitacao = await this.prisma.solicitacoes.findUnique({
      where: { id: params.solicitacaoId },
      include: { fluxos: { include: { etapas: { orderBy: { ordem: 'asc' } } } } },
    });

    if (!solicitacao) {
      throw new NotFoundException(`Solicitação [${params.solicitacaoId}] não encontrada.`);
    }

    const aprovacao = await this.prisma.aprovacoes.create({
      data: {
        solicitacao_id: params.solicitacaoId,
        etapa_id: params.etapaId,
        aprovador_id: params.aprovadorId,
        decisao: params.decisao,
        parecer: params.parecer || null,
      },
    });

    const previousStatus = solicitacao.status;
    let newStatus = solicitacao.status;

    if (params.decisao === 'rejeitado') {
      newStatus = 'rejeitado';
    } else if (params.decisao === 'devolvido') {
      newStatus = 'devolvido';
    } else if (params.decisao === 'aprovado') {
      // Verifica se todas as etapas obrigatórias foram cumpridas
      const allEtapas = solicitacao.fluxos.etapas;
      const existingApprovals = await this.prisma.aprovacoes.findMany({
        where: { solicitacao_id: params.solicitacaoId, decisao: 'aprovado' },
      });

      if (existingApprovals.length >= allEtapas.length) {
        newStatus = 'aprovado';
      }
    }

    if (newStatus !== previousStatus) {
      await this.prisma.solicitacoes.update({
        where: { id: params.solicitacaoId },
        data: { status: newStatus, atualizado_em: new Date() },
      });

      await this.prisma.historicos.create({
        data: {
          solicitacao_id: params.solicitacaoId,
          de_status: previousStatus,
          para_status: newStatus,
          usuario_id: params.aprovadorId,
          motivo: params.parecer || `Decisão: ${params.decisao}`,
        },
      });

      // Emissão de evento de aprovação final
      if (newStatus === 'aprovado') {
        await this.eventStore.recordEvent({
          tipo: 'SOLICITACAO_WORKFLOW_APROVADA',
          entidade: 'solicitacoes',
          entidade_id: params.solicitacaoId,
          payload: { decisao: params.decisao, aprovadorId: params.aprovadorId },
          usuario_id: params.aprovadorId,
          unidade_id: solicitacao.unidade_id,
        });
      }
    }

    return { aprovacao, novoStatus: newStatus };
  }

  /**
   * Assina digitalmente uma solicitação
   */
  async signRequest(params: {
    solicitacaoId: string;
    usuarioId: string;
    hashAssinatura: string;
  }) {
    return this.prisma.assinaturas.create({
      data: {
        solicitacao_id: params.solicitacaoId,
        usuario_id: params.usuarioId,
        hash_assinatura: params.hashAssinatura,
      },
    });
  }

  /**
   * Lista solicitações, opcionalmente filtradas por unidade
   */
  async listRequests(tenantId?: string | null) {
    const where = tenantId ? { unidade_id: tenantId } : {};
    return this.prisma.solicitacoes.findMany({
      where,
      include: {
        fluxos: true,
        aprovacoes: true,
        assinaturas: true,
        historicos: { orderBy: { registrado_em: 'desc' } },
      },
      orderBy: { criado_em: 'desc' },
    });
  }

  /**
   * Busca detalhes completos de uma solicitação
   */
  async getRequestById(id: string) {
    const req = await this.prisma.solicitacoes.findUnique({
      where: { id },
      include: {
        fluxos: { include: { etapas: true } },
        aprovacoes: true,
        assinaturas: true,
        historicos: { orderBy: { registrado_em: 'desc' } },
      },
    });

    if (!req) {
      throw new NotFoundException(`Solicitação [${id}] não encontrada.`);
    }

    return req;
  }
}
