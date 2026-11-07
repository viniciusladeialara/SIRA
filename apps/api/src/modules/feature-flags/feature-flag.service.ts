import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service.js';

const CACHE_KEY_ALL_FLAGS = 'sira:feature_flags:all';
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Obtém o mapa de todas as feature flags e seus estados
   */
  async getAllFlags(): Promise<Record<string, boolean>> {
    // 1. Tentar ler do cache Redis
    const cached = await this.cache.get<Record<string, boolean>>(CACHE_KEY_ALL_FLAGS);
    if (cached) {
      return cached;
    }

    // 2. Fallback para PostgreSQL
    const flags = await this.prisma.feature_flags.findMany();
    const map: Record<string, boolean> = {};

    for (const flag of flags) {
      map[flag.nome] = flag.ativo;
    }

    // 3. Gravar no cache Redis
    await this.cache.set(CACHE_KEY_ALL_FLAGS, map, CACHE_TTL_SECONDS);
    return map;
  }

  /**
   * Verifica se uma flag específica está ativada
   */
  async isEnabled(flagName: string): Promise<boolean> {
    const flags = await this.getAllFlags();
    return flags[flagName] ?? false;
  }

  /**
   * Atualiza o estado de uma feature flag e invalida o cache
   */
  async setFlag(nome: string, ativo: boolean, usuarioId?: string): Promise<void> {
    await this.prisma.feature_flags.upsert({
      where: { nome },
      update: {
        ativo,
        atualizado_em: new Date(),
        atualizado_por: usuarioId,
      },
      create: {
        nome,
        ativo,
        ambiente: 'all',
        descricao: `Flag ${nome} criada dinamicamente`,
        atualizado_por: usuarioId,
      },
    });

    // Invalida cache no Redis
    await this.cache.del(CACHE_KEY_ALL_FLAGS);
    this.logger.log(`Feature flag [${nome}] alterada para [${ativo}] por [${usuarioId || 'sistema'}]. Cache invalidado.`);
  }

  /**
   * Lista completa com metadados para painel administrativo
   */
  async listAllDetails() {
    return this.prisma.feature_flags.findMany({
      orderBy: { nome: 'asc' },
    });
  }
}
