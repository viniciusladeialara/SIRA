import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant.context.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    // Se a rota for pública ou não houver usuário autenticado, segue fluxo normal
    if (!user) {
      return next.handle();
    }

    const isSuperAdmin = user.perfis?.includes('administrador') ?? false;
    const headerUnitId = (request.headers['x-unidade-id'] as string | undefined)?.trim();

    let targetUnitId: string | null = null;

    if (headerUnitId) {
      // Usuário solicitou explicitamente operar em uma unidade via cabeçalho
      if (isSuperAdmin) {
        // Administrador tem permissão para atuar em qualquer unidade
        targetUnitId = headerUnitId;
      } else {
        // Usuário regular só pode operar se o cabeçalho corresponder à sua própria unidade
        if (user.unidadeId && user.unidadeId.toLowerCase() === headerUnitId.toLowerCase()) {
          targetUnitId = user.unidadeId;
        } else {
          throw new ForbiddenException(
            'Acesso negado: seu usuário não possui autorização para operar na unidade especificada.',
          );
        }
      }
    } else {
      // Sem cabeçalho explícito: adota a unidade natural vinculada ao cadastro do usuário
      targetUnitId = user.unidadeId ?? null;
    }

    // Registra no request para conveniência do decorator @CurrentTenant()
    request.tenantId = targetUnitId;

    // Encapsula a execução assíncrona do endpoint no AsyncLocalStorage
    return new Observable((subscriber) => {
      this.tenantContext.run(
        {
          unidadeId: targetUnitId,
          userId: user.id,
          isSuperAdmin,
        },
        () => {
          next.handle().subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        },
      );
    });
  }
}
