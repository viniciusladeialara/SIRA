import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../modules/auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // Apenas mutações de dados são auditadas automaticamente
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(method)) {
      return next.handle();
    }

    // Pula rotas de auth pois AuthService possui auditoria explícita
    if (request.url.includes('/auth/login') || request.url.includes('/auth/logout')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          try {
            const user = request.user as AuthenticatedUser | undefined;
            const actionMap: Record<string, string> = {
              POST: 'INSERT',
              PUT: 'UPDATE',
              PATCH: 'UPDATE',
              DELETE: 'DELETE',
            };

            const pathParts = request.url.split('?')[0].split('/').filter(Boolean);
            const entity = pathParts[pathParts.length - 1] || 'geral';
            const recordId = request.params?.id || responseBody?.id || null;

            await this.prisma.logs.create({
              data: {
                usuario_id: user?.id || null,
                usuario_email: user?.email || null,
                unidade_id: user?.unidadeId || request.tenantId || null,
                schema_name: 'core',
                tabela: entity,
                registro_id: recordId ? String(recordId) : null,
                acao: actionMap[method] || method,
                ip: request.ip || 'unknown',
                user_agent: request.headers['user-agent'] || 'unknown',
                dados_anteriores: Prisma.JsonNull,
                dados_novos: request.body ? request.body : responseBody,
              },
            });
          } catch (error) {
            this.logger.warn('Falha não-bloqueante ao registrar log de auditoria:', error);
          }
        },
      }),
    );
  }
}
