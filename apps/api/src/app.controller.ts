import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './modules/auth/decorators/public.decorator.js';
import { CurrentUser } from './modules/auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './modules/auth/interfaces/jwt-payload.interface.js';
import { Roles } from './modules/rbac/decorators/roles.decorator.js';
import { RolesGuard } from './modules/rbac/guards/roles.guard.js';
import { RequirePermissions } from './modules/rbac/decorators/require-permissions.decorator.js';
import { PermissionsGuard } from './modules/rbac/guards/permissions.guard.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(RolesGuard)
  @Roles('administrador')
  @Get('rbac/admin-only')
  testAdminOnly(@CurrentUser() user: AuthenticatedUser) {
    return { message: 'Acesso permitido: Perfil Administrador validado.', user: user.email };
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions('usuarios.ler')
  @Get('rbac/read-users')
  testRequirePermission(@CurrentUser() user: AuthenticatedUser) {
    return { message: 'Acesso permitido: Permissão [usuarios.ler] validada.', user: user.email };
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions('sistema.configuracao_inexistente')
  @Get('rbac/impossible-perm')
  testImpossiblePermission() {
    return { message: 'Não deve ser retornado a usuários normais.' };
  }
}
