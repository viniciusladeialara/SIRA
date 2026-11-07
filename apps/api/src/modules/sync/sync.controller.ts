import { Controller, Get, Post, Body, UseGuards, Req, HttpCode, HttpStatus, Query } from '@nestjs/common';
import type { Request } from 'express';
import { SyncService } from './sync.service.js';
import { MirrorDto } from './dto/mirror.dto.js';
import { PromoteDto } from './dto/promote.dto.js';
import { RolesGuard } from '../rbac/guards/roles.guard.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Controller('sync')
@UseGuards(RolesGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Retorna o status de ambos os bancos (Produção vs Teste)
   */
  @Get('status')
  @Roles('administrador', 'gestor', 'coordenador')
  async getStatus() {
    return this.syncService.getSyncStatus();
  }

  /**
   * Executa a validação de conflitos no banco de testes antes da promoção
   */
  @Get('validate')
  @Roles('administrador', 'gestor', 'coordenador')
  async validateScenario(@Query('unidadeId') unidadeId?: string) {
    return this.syncService.validateScenario(unidadeId);
  }

  /**
   * Dispara o espelhamento de Produção para Teste (sira -> sira_teste)
   */
  @Post('mirror')
  @HttpCode(HttpStatus.OK)
  @Roles('administrador', 'gestor')
  async mirror(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MirrorDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    return this.syncService.mirrorProdToTest(user.email, dto, clientIp);
  }

  /**
   * Promove o cenário homologado no banco de testes para Produção com senha e transação atômica
   */
  @Post('promote')
  @HttpCode(HttpStatus.OK)
  @Roles('administrador', 'gestor')
  async promote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PromoteDto,
    @Req() req: Request,
  ) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    return this.syncService.promoteTestToProd(user.email, dto, clientIp);
  }
}
