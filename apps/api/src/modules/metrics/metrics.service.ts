import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service.js';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: client.Registry;

  // Métricas HTTP
  public readonly httpRequestsTotal: client.Counter<string>;
  public readonly httpRequestDuration: client.Histogram<string>;
  public readonly httpErrorsTotal: client.Counter<string>;

  // Métricas de Infraestrutura (Postgres & Redis)
  public readonly databaseConnected: client.Gauge<string>;
  public readonly databaseQueryDuration: client.Gauge<string>;
  public readonly redisConnected: client.Gauge<string>;
  public readonly redisPingDuration: client.Gauge<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
  ) {
    this.registry = new client.Registry();

    // Default metrics (CPU, RAM, Event Loop)
    client.collectDefaultMetrics({ register: this.registry });

    // HTTP Metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'sira_http_requests_total',
      help: 'Contador total de requisições HTTP recebidas pelo SIRA API',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'sira_http_request_duration_seconds',
      help: 'Duração das requisições HTTP em segundos',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpErrorsTotal = new client.Counter({
      name: 'sira_http_errors_total',
      help: 'Contador total de respostas com erro HTTP (4xx e 5xx)',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // Infrastructure Metrics
    this.databaseConnected = new client.Gauge({
      name: 'sira_database_connected',
      help: 'Status da conexão com PostgreSQL (1 = UP, 0 = DOWN)',
      registers: [this.registry],
    });

    this.databaseQueryDuration = new client.Gauge({
      name: 'sira_database_query_duration_seconds',
      help: 'Latência do ping SQL de verificação no PostgreSQL',
      registers: [this.registry],
    });

    this.redisConnected = new client.Gauge({
      name: 'sira_redis_connected',
      help: 'Status da conexão com Redis (1 = UP, 0 = DOWN)',
      registers: [this.registry],
    });

    this.redisPingDuration = new client.Gauge({
      name: 'sira_redis_ping_duration_seconds',
      help: 'Latência do ping no Redis em segundos',
      registers: [this.registry],
    });
  }

  onModuleInit() {
    this.logger.log('Métricas Prometheus inicializadas com sucesso.');
  }

  /**
   * Atualiza métricas de saúde de Postgres e Redis e retorna o payload Prometheus
   */
  async getMetrics(): Promise<string> {
    // 1. Check PostgreSQL
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const dbDuration = (Date.now() - dbStart) / 1000;
      this.databaseConnected.set(1);
      this.databaseQueryDuration.set(dbDuration);
    } catch {
      this.databaseConnected.set(0);
      this.databaseQueryDuration.set(0);
    }

    // 2. Check Redis
    try {
      const redisLatencyMs = await this.redisCache.ping();
      this.redisConnected.set(1);
      this.redisPingDuration.set(redisLatencyMs / 1000);
    } catch {
      this.redisConnected.set(0);
      this.redisPingDuration.set(0);
    }

    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
