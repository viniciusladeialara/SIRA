import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { PermissionsGuard } from '../rbac/guards/permissions.guard.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';

@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('usuarios.ler')
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions')
  @RequirePermissions('usuarios.ler')
  async findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }
}
