import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('solicitacoes')
  async listRequests(@CurrentTenant() tenantId: string | null) {
    return this.workflowService.listRequests(tenantId);
  }

  @Get('solicitacoes/:id')
  async getRequestById(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.getRequestById(id);
  }

  @Post('solicitacoes')
  async openRequest(
    @Body()
    body: {
      fluxoCodigo: string;
      tipo: string;
      dados: any;
    },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string | null,
  ) {
    return this.workflowService.openRequest({
      fluxoCodigo: body.fluxoCodigo,
      solicitanteId: user.id,
      unidadeId: tenantId || user.unidadeId,
      tipo: body.tipo,
      dados: body.dados,
    });
  }

  @Patch('solicitacoes/:id/avaliar')
  async evaluateStep(
    @Param('id', ParseUUIDPipe) solicitacaoId: string,
    @Body()
    body: {
      etapaId: string;
      decisao: 'aprovado' | 'rejeitado' | 'devolvido';
      parecer?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflowService.evaluateStep({
      solicitacaoId,
      etapaId: body.etapaId,
      aprovadorId: user.id,
      decisao: body.decisao,
      parecer: body.parecer,
    });
  }

  @Post('solicitacoes/:id/assinar')
  async signRequest(
    @Param('id', ParseUUIDPipe) solicitacaoId: string,
    @Body('hashAssinatura') hashAssinatura: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflowService.signRequest({
      solicitacaoId,
      usuarioId: user.id,
      hashAssinatura,
    });
  }
}
