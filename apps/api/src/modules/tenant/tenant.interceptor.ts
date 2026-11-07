import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant.context.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  constructor(private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    // Se a rota for pública ou não houver usuário autenticado no momento
    if (!user) {
      return next.handle();
    }

    const isSuperAdmin = user.perfis?.includes('administrador') ?? false;
    const rawHeaderUnitId = request.headers['x-unidade-id'] as string | undefined;
    const headerTenant = rawHeaderUnitId ? rawHeaderUnitId.trim() : null;
    const jwtTenant = user.unidadeId ? user.unidadeId.trim() : null;

    let contextTenant: string | null = null;

    if (headerTenant) {
      if (isSuperAdmin) {
        // Administrador tem permissão para chavear o tenant explicitamente via cabeçalho
        contextTenant = headerTenant;
      } else {
        // Para usuários normais: JWT Tenant e Header Tenant DEVEM coincidir obrigatoriamente
        if (!jwtTenant || jwtTenant.toLowerCase() !== headerTenant.toLowerCase()) {
          this.logger.warn(
            `[Multi-Tenant Divergence] Usuário ${user.id} tentou acessar Header Tenant [${headerTenant}] divergente de seu JWT Tenant [${jwtTenant}]. Operação bloqueada com 403.`,
          );
          throw new ForbiddenException(
            'Violação de Multi-Tenant: Divergência entre JWT Tenant e Header Tenant. Todos os contextos de unidade devem coincidir (403 Forbidden).',
          );
        }
        contextTenant = jwtTenant;
      }
    } else {
      // Sem cabeçalho explícito: herda estritamente o Tenant Context do JWT
      contextTenant = jwtTenant;
    }

    // Validação de Tripla Coincidência (JWT Tenant, Header Tenant se presente, Context Tenant)
    if (!isSuperAdmin && headerTenant && (jwtTenant !== headerTenant || contextTenant !== jwtTenant)) {
      throw new ForbiddenException(
        'Violação estrita de isolamento Multi-Tenant: Tenant Context JWT, Header Tenant e Context Tenant divergentes (403 Forbidden).',
      );
    }

    // Registra no request para compatibilidade com o decorator @CurrentTenant()
    request.tenantId = contextTenant;

    // Encapsula a execução no AsyncLocalStorage isolado por requisição
    return new Observable((subscriber) => {
      this.tenantContext.run(
        {
          unidadeId: contextTenant,
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
