import { Global, Module, OnApplicationShutdown, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisCacheService } from './redis-cache.service.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const logger = new Logger('RedisClient');
        const host = process.env.REDIS_HOST || 'localhost';
        const port = Number(process.env.REDIS_PORT) || 6379;

        const redis = new Redis({
          host,
          port,
          lazyConnect: false,
          maxRetriesPerRequest: 3,
          retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            return delay;
          },
        });

        redis.on('connect', () => {
          logger.log(`Conexão com Redis estabelecida com sucesso em ${host}:${port}`);
        });

        redis.on('error', (err) => {
          logger.error('Erro na conexão com o Redis:', err);
        });

        return redis;
      },
    },
    RedisCacheService,
  ],
  exports: [REDIS_CLIENT, RedisCacheService],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    this.logger.log('Encerrando conexão com o Redis...');
    await this.redis.quit();
  }
}
