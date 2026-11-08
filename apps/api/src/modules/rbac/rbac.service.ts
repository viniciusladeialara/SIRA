import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service.js';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly PERMISSIONS_CACHE_TTL = 30 * 60; // 30 minutos em segundos

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Obtém a lista consolidada de chaves de permissão do usuário com cache no Redis
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `sira:perms:${userId}`;
    const cached = await this.redisCache.get<string[]>(cacheKey);

    if (cached) {
      return cached;
    }

    // Busca no PostgreSQL as permissões vinculadas aos perfis do usuário
    const user = await this.prisma.usuarios.findUnique({
      where: { id: userId },
      include: {
        usuario_perfis: {
          include: {
            perfis: {
              include: {
                perfil_permissoes: {
                  include: {
                    permissoes: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    const permissionSet = new Set<string>();

    for (const up of user.usuario_perfis) {
      if (up.perfis && up.perfis.ativo) {
        for (const pp of up.perfis.perfil_permissoes) {
          if (pp.permissoes && pp.permissoes.chave) {
            permissionSet.add(pp.permissoes.chave);
          }
        }
      }
    }

    const permissions = Array.from(permissionSet);

    // Grava no Redis para otimização de requisições subsequentes
    await this.redisCache.set(cacheKey, permissions, this.PERMISSIONS_CACHE_TTL);

    return permissions;
  }

  /**
   * Verifica se o usuário possui determinada permissão (administrador sempre possui acesso irrestrito)
   */
  async hasPermission(userId: string, permission: string, userRoles: string[] = []): Promise<boolean> {
    const isFullAccess =
      userRoles.includes('administrador') ||
      userRoles.includes('super_admin') ||
      userRoles.includes('admin') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('ADMIN');
    if (isFullAccess) {
      return true;
    }
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  /**
   * Invalida o cache de permissões do usuário (disparado ao alterar perfis ou permissões)
   */
  async invalidateUserPermissions(userId: string): Promise<void> {
    const cacheKey = `sira:perms:${userId}`;
    await this.redisCache.del(cacheKey);
    this.logger.log(`Cache de permissões invalidado para o usuário [${userId}].`);
  }
}
