import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { EventStoreService } from '../event-store/event-store.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly eventStore: EventStoreService,
  ) {}

  /**
   * Lista todos os usuários respeitando hierarquia e isolamento multitenant
   */
  async findAll(tenantId?: string | null, actor?: AuthenticatedUser) {
    const isActorSuper = this.checkIsSuperAdmin(actor);

    const where: any = { excluido_em: null };

    // Se não for Super Admin, filtra estritamente pela unidade do ator
    if (!isActorSuper) {
      const allowedUnitId = actor?.unidadeId || tenantId;
      if (allowedUnitId) {
        where.OR = [
          { unidade_id: allowedUnitId },
          { usuario_unidades: { some: { unidade_id: allowedUnitId } } },
        ];
      }
      // Oculta o Super Administrador da visão de administradores escolares
      where.NOT = {
        usuario_perfis: {
          some: {
            perfis: {
              slug: { in: ['super_admin'] },
            },
          },
        },
      };
    } else if (tenantId) {
      where.OR = [
        { unidade_id: tenantId },
        { usuario_unidades: { some: { unidade_id: tenantId } } },
      ];
    }

    const users = await this.prisma.usuarios.findMany({
      where,
      include: {
        unidades: true,
        usuario_perfis: {
          include: {
            perfis: true,
          },
        },
        usuario_unidades: {
          include: {
            unidades: true,
          },
        },
        usuario_modulos: true,
      },
      orderBy: { nome: 'asc' },
    });

    return users.map((u) => this.sanitizeUser(u));
  }

  /**
   * Busca usuário por ID com detalhes de perfis, unidades e módulos liberados
   */
  async findById(id: string) {
    const user = await this.prisma.usuarios.findUnique({
      where: { id },
      include: {
        unidades: true,
        usuario_perfis: {
          include: {
            perfis: true,
          },
        },
        usuario_unidades: {
          include: {
            unidades: true,
          },
        },
        usuario_modulos: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID [${id}] não encontrado.`);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Criação de usuário com aplicação estrita de regras:
   * 1. Apenas SUPER_ADMIN pode criar perfis ADMIN ou SUPER_ADMIN.
   * 2. Administrador escolar cria usuários vinculados obrigatoriamente à sua unidade (efeito cascata).
   * 3. Novos usuários iniciam com todos os módulos desativados por padrão, exceto os selecionados.
   */
  async create(dto: CreateUserDto, actor?: AuthenticatedUser) {
    const isActorSuper = this.checkIsSuperAdmin(actor);

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.usuarios.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(`Já existe um usuário cadastrado com o e-mail [${email}].`);
    }

    // Normalização de papel/perfil solicitado
    const requestedProfiles = this.extractProfileSlugs(dto);

    // REGRA MASTER: Admin escolar NÃO cadastra nem edita admin/super_admin
    if (!isActorSuper) {
      const hasPrivilegedRole = requestedProfiles.some((p) =>
        ['super_admin', 'administrador'].includes(p),
      );
      if (hasPrivilegedRole) {
        throw new ForbiddenException(
          'Administradores escolares não possuem permissão para cadastrar administradores ou super administradores.',
        );
      }
    }

    // EFEITO CASCATA: Unidade forçada para a unidade do gestor caso não seja Super Admin
    let effectiveUnitId: string | null = null;
    let effectiveUnitIds: string[] = [];

    if (!isActorSuper) {
      effectiveUnitId = actor?.unidadeId || null;
      effectiveUnitIds = effectiveUnitId ? [effectiveUnitId] : [];
    } else {
      effectiveUnitId = dto.unidadeId || dto.selectedUnitId || null;
      if (dto.unitIds && dto.unitIds.length > 0) {
        effectiveUnitIds = dto.unitIds;
      } else if (effectiveUnitId) {
        effectiveUnitIds = [effectiveUnitId];
      }
    }

    const rawPassword = dto.senha || dto.password || 'Muda@123';
    const senhaHash = await bcrypt.hash(rawPassword, 10);
    const nome = (dto.nome || dto.name || 'Novo Usuário').trim();

    const user = await this.prisma.usuarios.create({
      data: {
        nome,
        email,
        senha_hash: senhaHash,
        unidade_id: effectiveUnitId,
        ativo: dto.ativo ?? dto.isActive ?? true,
      },
    });

    // 1. Vinculação de Perfis
    const foundProfiles = await this.prisma.perfis.findMany({
      where: { slug: { in: requestedProfiles } },
    });

    for (const p of foundProfiles) {
      await this.prisma.usuario_perfis.create({
        data: {
          usuario_id: user.id,
          perfil_id: p.id,
        },
      });
    }

    // 2. Vinculação de Unidades Permitidas (Multi-Unidade)
    for (const uId of effectiveUnitIds) {
      await this.prisma.usuario_unidades.create({
        data: {
          usuario_id: user.id,
          unidade_id: uId,
        },
      }).catch(() => null);
    }

    // 3. Liberação de Módulos (Por padrão todos desativados, grava apenas os liberados)
    const modulesToGrant = dto.allowedModules || dto.modulos || [];
    for (const modSlug of modulesToGrant) {
      if (modSlug) {
        await this.prisma.usuario_modulos.create({
          data: {
            usuario_id: user.id,
            modulo_slug: modSlug,
            ativo: true,
          },
        }).catch(() => null);
      }
    }

    // Registra evento imutável no Event Store
    await this.eventStore.recordEvent({
      tipo: 'USUARIO_CRIADO',
      entidade: 'usuarios',
      entidade_id: user.id,
      payload: {
        nome: user.nome,
        email: user.email,
        unidadeId: user.unidade_id,
        unitIds: effectiveUnitIds,
        perfis: requestedProfiles,
        allowedModules: modulesToGrant,
      },
      usuario_id: actor?.id || user.id,
      unidade_id: user.unidade_id,
    });

    return this.findById(user.id);
  }

  /**
   * Atualização de usuário existente respeitando autoridade de papel e escopo
   */
  async update(id: string, dto: UpdateUserDto, actor?: AuthenticatedUser) {
    const isActorSuper = this.checkIsSuperAdmin(actor);
    const targetUser = await this.findById(id);

    const targetProfiles = (targetUser.perfis || []).map((p: any) => p.slug);
    const isTargetSuperOrAdmin = targetProfiles.some((p: string) =>
      ['super_admin', 'administrador'].includes(p),
    );

    // REGRA: Admin escolar NÃO edita outros admins ou o super_admin
    if (!isActorSuper) {
      if (isTargetSuperOrAdmin) {
        throw new ForbiddenException(
          'Administradores escolares não possuem permissão para alterar outros administradores ou o super administrador.',
        );
      }

      // Validação de Tenant / Unidade
      const actorUnitId = actor?.unidadeId;
      if (actorUnitId && targetUser.unidadeId && targetUser.unidadeId !== actorUnitId) {
        throw new ForbiddenException('Acesso negado: o usuário pertence a outra unidade.');
      }
    }

    if (dto.email) {
      const cleanEmail = dto.email.trim().toLowerCase();
      const conflict = await this.prisma.usuarios.findFirst({
        where: { email: { equals: cleanEmail, mode: 'insensitive' }, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`O e-mail [${dto.email}] já está em uso por outro usuário.`);
      }
    }

    const dataToUpdate: any = {};
    if (dto.nome !== undefined || dto.name !== undefined) {
      dataToUpdate.nome = (dto.nome || dto.name)!.trim();
    }
    if (dto.email !== undefined) dataToUpdate.email = dto.email.trim().toLowerCase();
    if (dto.ativo !== undefined) dataToUpdate.ativo = dto.ativo;
    if (dto.isActive !== undefined) dataToUpdate.ativo = dto.isActive;

    // Apenas Super Admin pode reatribuir a unidade principal do usuário
    const targetUnitId = dto.unidadeId || dto.selectedUnitId;
    if (isActorSuper && targetUnitId !== undefined) {
      dataToUpdate.unidade_id = targetUnitId;
    }

    const newPass = dto.senha || dto.password;
    if (newPass) {
      dataToUpdate.senha_hash = await bcrypt.hash(newPass, 10);
    }
    dataToUpdate.atualizado_em = new Date();

    await this.prisma.usuarios.update({
      where: { id },
      data: dataToUpdate,
    });

    // 1. Atualização de Perfis
    const requestedProfiles = this.extractProfileSlugs(dto);
    if (requestedProfiles.length > 0) {
      if (!isActorSuper) {
        const triesToPromote = requestedProfiles.some((p) =>
          ['super_admin', 'administrador'].includes(p),
        );
        if (triesToPromote) {
          throw new ForbiddenException(
            'Administradores escolares não podem conceder perfil de administrador.',
          );
        }
      }

      await this.prisma.usuario_perfis.deleteMany({
        where: { usuario_id: id },
      });

      const foundProfiles = await this.prisma.perfis.findMany({
        where: { slug: { in: requestedProfiles } },
      });

      for (const p of foundProfiles) {
        await this.prisma.usuario_perfis.create({
          data: {
            usuario_id: id,
            perfil_id: p.id,
          },
        });
      }
    }

    // 2. Atualização de Unidades Permitidas (Multi-Unidade)
    if (dto.unitIds !== undefined && isActorSuper) {
      await this.prisma.usuario_unidades.deleteMany({
        where: { usuario_id: id },
      });

      for (const uId of dto.unitIds) {
        await this.prisma.usuario_unidades.create({
          data: {
            usuario_id: id,
            unidade_id: uId,
          },
        }).catch(() => null);
      }
    }

    // 3. Atualização de Módulos Liberados
    const modulesToGrant = dto.allowedModules || dto.modulos;
    if (modulesToGrant !== undefined) {
      await this.prisma.usuario_modulos.deleteMany({
        where: { usuario_id: id },
      });

      for (const modSlug of modulesToGrant) {
        if (modSlug) {
          await this.prisma.usuario_modulos.create({
            data: {
              usuario_id: id,
              modulo_slug: modSlug,
              ativo: true,
            },
          }).catch(() => null);
        }
      }
    }

    // Invalida cache de permissões no Redis
    await this.rbacService.invalidateUserPermissions(id);

    return this.findById(id);
  }

  /**
   * Exclusão lógica corporativa (Soft Delete) com validação de hierarquia
   */
  async remove(id: string, executorId?: string, actor?: AuthenticatedUser) {
    const isActorSuper = this.checkIsSuperAdmin(actor);
    const target = await this.findById(id);

    if (actor && actor.id === id) {
      throw new ForbiddenException('Não é permitido desativar a própria conta de acesso.');
    }

    if (!isActorSuper) {
      const targetProfiles = (target.perfis || []).map((p: any) => p.slug);
      const isTargetSuperOrAdmin = targetProfiles.some((p: string) =>
        ['super_admin', 'administrador'].includes(p),
      );
      if (isTargetSuperOrAdmin) {
        throw new ForbiddenException(
          'Administradores escolares não possuem permissão para excluir outros administradores ou o super administrador.',
        );
      }

      if (actor?.unidadeId && target.unidadeId && target.unidadeId !== actor.unidadeId) {
        throw new ForbiddenException('Acesso negado: o usuário pertence a outra unidade.');
      }
    }

    await this.prisma.usuarios.update({
      where: { id },
      data: {
        ativo: false,
        excluido_em: new Date(),
        excluido_por: executorId || null,
        atualizado_em: new Date(),
      },
    });

    await this.rbacService.invalidateUserPermissions(id);
    return { message: `Usuário [${id}] desativado com sucesso (soft-delete).` };
  }

  async delete(id: string, executorId?: string, actor?: AuthenticatedUser) {
    return this.remove(id, executorId, actor);
  }

  /**
   * Helper: Verifica se o ator tem papel de Super Admin
   */
  private checkIsSuperAdmin(actor?: AuthenticatedUser): boolean {
    if (!actor) return true; // Chamadas internas do sistema operam com autoridade total
    if (actor.email === 'admin@sira.local' || actor.email === 'admin@sira.com') return true;
    return (actor.perfis || []).includes('super_admin');
  }

  /**
   * Helper: Extrai e normaliza slugs de perfis
   */
  private extractProfileSlugs(dto: CreateUserDto | UpdateUserDto): string[] {
    if (dto.perfis && dto.perfis.length > 0) {
      return dto.perfis.map((p) => p.toLowerCase());
    }
    if (dto.role) {
      const r = dto.role.toUpperCase();
      if (r === 'SUPER_ADMIN') return ['super_admin', 'administrador'];
      if (r === 'ADMIN') return ['administrador'];
      if (r === 'PROFESSOR') return ['professor'];
      if (r === 'USER') return ['coordenador'];
      if (r === 'PARTNER_SCHOOL') return ['consulta'];
      return [dto.role.toLowerCase()];
    }
    return ['coordenador'];
  }

  /**
   * Remove senha_hash e formata resposta corporativa limpa com suporte completo a multi-unidade e módulos
   */
  private sanitizeUser(user: any) {
    const { senha_hash, usuario_perfis, usuario_unidades, usuario_modulos, unidades, ...rest } = user;

    const perfis = (usuario_perfis || []).map((up: any) => ({
      id: up.perfis.id,
      slug: up.perfis.slug,
      nome: up.perfis.nome,
    }));

    const profileSlugs = perfis.map((p: any) => p.slug);
    const isSuper = profileSlugs.includes('super_admin');

    // Mapeamento de unidades atribuídas
    const unitIds = (usuario_unidades || []).map((uu: any) => uu.unidade_id);
    if (rest.unidade_id && !unitIds.includes(rest.unidade_id)) {
      unitIds.push(rest.unidade_id);
    }

    // Mapeamento de papel principal (Role enum compatível)
    let role = 'USER';
    if (isSuper) {
      role = 'SUPER_ADMIN';
    } else if (profileSlugs.includes('administrador')) {
      role = 'ADMIN';
    } else if (profileSlugs.includes('professor')) {
      role = 'PROFESSOR';
    } else if (profileSlugs.includes('consulta')) {
      role = 'PARTNER_SCHOOL';
    }

    // Módulos liberados explicitamente
    let allowedModules: string[];
    if (isSuper) {
      allowedModules = [
        'overview', 'user-management', 'professors', 'classes', 'courses',
        'environments', 'schedules', 'conflicts', 'swaps', 'teacher-allocation',
        'teacher-monitoring', 'uniforms', 'assets', 'report-issue', 'diary-import',
        'reports', 'core-eventos', 'core-demo', 'system-settings'
      ];
    } else {
      allowedModules = (usuario_modulos || [])
        .filter((um: any) => um.ativo)
        .map((um: any) => um.modulo_slug);
    }

    return {
      ...rest,
      name: rest.nome,
      unidadeId: rest.unidade_id,
      unitIds,
      allowedModules,
      role,
      perfis,
      unidade: unidades ? { id: unidades.id, nome: unidades.nome, sigla: unidades.sigla } : null,
      isActive: rest.ativo,
    };
  }
}
