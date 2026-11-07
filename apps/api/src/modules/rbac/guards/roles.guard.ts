import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user }: { user: AuthenticatedUser } = context.switchToHttp().getRequest();

    if (!user || !user.perfis) {
      throw new ForbiddenException('Acesso negado: identificação do usuário ausente.');
    }

    // Administrador possui acesso irrestrito a qualquer papel do sistema
    if (user.perfis.includes('administrador')) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => user.perfis.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado: requer um dos perfis [${requiredRoles.join(', ')}].`,
      );
    }

    return true;
  }
}
