import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { RolesGuard } from '../rbac/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Controller('feature-flags')
export class FeatureFlagController {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  /**
   * Endpoint público (ou acessível pelo frontend) para obter o mapa de flags ativas
   */
  @Public()
  @Get()
  async getFlags() {
    const flags = await this.featureFlagService.getAllFlags();
    return {
      success: true,
      flags,
    };
  }

  /**
   * Listagem detalhada para administradores
   */
  @UseGuards(RolesGuard)
  @Roles('administrador')
  @Get('admin/details')
  async listAllDetails() {
    const list = await this.featureFlagService.listAllDetails();
    return {
      success: true,
      data: list,
    };
  }

  /**
   * Atualizar estado da flag (apenas Administrador)
   */
  @UseGuards(RolesGuard)
  @Roles('administrador')
  @Patch(':nome')
  async updateFlag(
    @Param('nome') nome: string,
    @Body('ativo') ativo: boolean,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.featureFlagService.setFlag(nome, Boolean(ativo), user.id);
    return {
      success: true,
      message: `Feature flag ${nome} atualizada para ${ativo}`,
    };
  }
}
