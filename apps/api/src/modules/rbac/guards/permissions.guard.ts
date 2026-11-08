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

    // Administrador ou Super Administrador possui acesso irrestrito
    const isSuperOrAdmin =
      user.email === 'admin@sira.local' ||
      user.email === 'admin@sira.com' ||
      (user.perfis &&
        (user.perfis.includes('super_admin') ||
          user.perfis.includes('SUPER_ADMIN') ||
          user.perfis.includes('administrador') ||
          user.perfis.includes('admin') ||
          user.perfis.includes('ADMIN')));

    if (isSuperOrAdmin) {
      return true;
    }

    // Liberação modular via allowedModules concedidos no token JWT
    if (user.allowedModules && user.allowedModules.length > 0) {
      if (user.allowedModules.includes('*')) {
        return true;
      }
      const moduleMap: Record<string, string[]> = {
        'user-management': ['usuarios'],
        usuarios: ['usuarios'],
        classes: ['turmas'],
        turmas: ['turmas'],
        courses: ['cursos'],
        cursos: ['cursos'],
        environments: ['ambientes'],
        ambientes: ['ambientes'],
        professors: ['docentes'],
        docentes: ['docentes'],
        schedules: ['agendamentos'],
        agendamentos: ['agendamentos'],
        reports: ['relatorios'],
        relatorios: ['relatorios'],
      };

      const hasModularPermission = requiredPermissions.every((perm) => {
        const [domain] = perm.split('.');
        return user.allowedModules?.some((m) => {
          const allowedDomains = moduleMap[m] || [m];
          return allowedDomains.includes(domain);
        });
      });

      if (hasModularPermission) {
        return true;
      }
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
