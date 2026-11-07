import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { RbacService } from '../rbac.service.js';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user }: { user: AuthenticatedUser } = context.switchToHttp().getRequest();

    if (!user || !user.id) {
      throw new ForbiddenException('Acesso negado: identificação do usuário ausente.');
    }

    // Administrador possui acesso irrestrito
    if (user.perfis && user.perfis.includes('administrador')) {
      return true;
    }

    const userPermissions = await this.rbacService.getUserPermissions(user.id);

    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissions.includes(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Acesso negado: permissões ausentes [${missingPermissions.join(', ')}].`,
      );
    }

    return true;
  }
}
