import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * Lista todos os usuários, opcionalmente filtrados por unidade
   */
  async findAll(tenantId?: string | null) {
    const where = tenantId ? { unidade_id: tenantId } : {};

    const users = await this.prisma.usuarios.findMany({
      where,
      include: {
        unidades: true,
        usuario_perfis: {
          include: {
            perfis: true,
          },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return users.map((u) => this.sanitizeUser(u));
  }

  /**
   * Busca usuário por ID
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
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com ID [${id}] não encontrado.`);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Cria um novo usuário com senha criptografada e vinculação de perfis
   */
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.usuarios.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(`Já existe um usuário cadastrado com o e-mail [${dto.email}].`);
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const user = await this.prisma.usuarios.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senha_hash: senhaHash,
        unidade_id: dto.unidadeId || null,
        ativo: dto.ativo ?? true,
      },
    });

    // Vincula perfis se informados
    if (dto.perfis && dto.perfis.length > 0) {
      const foundProfiles = await this.prisma.perfis.findMany({
        where: { slug: { in: dto.perfis } },
      });

      for (const p of foundProfiles) {
        await this.prisma.usuario_perfis.create({
          data: {
            usuario_id: user.id,
            perfil_id: p.id,
          },
        });
      }
    }

    return this.findById(user.id);
  }

  /**
   * Atualiza dados de um usuário existente
   */
  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    if (dto.email) {
      const conflict = await this.prisma.usuarios.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(`O e-mail [${dto.email}] já está em uso por outro usuário.`);
      }
    }

    const dataToUpdate: any = {};
    if (dto.nome !== undefined) dataToUpdate.nome = dto.nome;
    if (dto.email !== undefined) dataToUpdate.email = dto.email;
    if (dto.ativo !== undefined) dataToUpdate.ativo = dto.ativo;
    if (dto.unidadeId !== undefined) dataToUpdate.unidade_id = dto.unidadeId;
    if (dto.senha) {
      dataToUpdate.senha_hash = await bcrypt.hash(dto.senha, 10);
    }
    dataToUpdate.atualizado_em = new Date();

    await this.prisma.usuarios.update({
      where: { id },
      data: dataToUpdate,
    });

    // Atualiza perfis se informados
    if (dto.perfis !== undefined) {
      await this.prisma.usuario_perfis.deleteMany({
        where: { usuario_id: id },
      });

      const foundProfiles = await this.prisma.perfis.findMany({
        where: { slug: { in: dto.perfis } },
      });

      for (const p of foundProfiles) {
        await this.prisma.usuario_perfis.create({
          data: {
            usuario_id: id,
            perfil_id: p.id,
          },
        });
      }

      // Invalida cache de permissões no Redis
      await this.rbacService.invalidateUserPermissions(id);
    }

    return this.findById(id);
  }

  /**
   * Exclui um usuário
   */
  async remove(id: string) {
    await this.findById(id);
    await this.prisma.usuarios.delete({ where: { id } });
    await this.rbacService.invalidateUserPermissions(id);
    return { message: `Usuário [${id}] removido com sucesso.` };
  }

  /**
   * Remove senha_hash e formata resposta limpa
   */
  private sanitizeUser(user: any) {
    const { senha_hash, usuario_perfis, ...rest } = user;
    return {
      ...rest,
      perfis: (usuario_perfis || []).map((up: any) => ({
        id: up.perfis.id,
        slug: up.perfis.slug,
        nome: up.perfis.nome,
      })),
    };
  }
}
