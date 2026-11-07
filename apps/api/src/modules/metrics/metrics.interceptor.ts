import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, route, originalUrl } = request;
    // Normalizar a rota para não inflar a cardinalidade do Prometheus
    const path = route?.path || (originalUrl ? originalUrl.split('?')[0] : 'unknown');

    // Ignorar a própria rota de métricas para não gerar ruído
    if (path.includes('/metrics')) {
      return next.handle();
    }

    const start = process.hrtime();

    return next.handle().pipe(
      tap(() => {
        const statusCode = String(response.statusCode || 200);
        const diff = process.hrtime(start);
        const durationSeconds = diff[0] + diff[1] / 1e9;

        this.metricsService.httpRequestsTotal.inc({
          method,
          route: path,
          status_code: statusCode,
        });

        this.metricsService.httpRequestDuration.observe(
          {
            method,
            route: path,
            status_code: statusCode,
          },
          durationSeconds,
        );

        if (response.statusCode >= 400) {
          this.metricsService.httpErrorsTotal.inc({
            method,
            route: path,
            status_code: statusCode,
          });
        }
      }),
      catchError((err) => {
        const statusCode = String(
          err instanceof HttpException ? err.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
        );
        const diff = process.hrtime(start);
        const durationSeconds = diff[0] + diff[1] / 1e9;

        this.metricsService.httpRequestsTotal.inc({
          method,
          route: path,
          status_code: statusCode,
        });

        this.metricsService.httpRequestDuration.observe(
          {
            method,
            route: path,
            status_code: statusCode,
          },
          durationSeconds,
        );

        this.metricsService.httpErrorsTotal.inc({
          method,
          route: path,
          status_code: statusCode,
        });

        throw err;
      }),
    );
  }
}
