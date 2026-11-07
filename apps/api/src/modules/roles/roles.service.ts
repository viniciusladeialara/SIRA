import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.perfis.findMany({
      include: {
        perfil_permissoes: {
          include: {
            permissoes: true,
          },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findAllPermissions() {
    return this.prisma.permissoes.findMany({
      orderBy: [{ modulo: 'asc' }, { acao: 'asc' }],
    });
  }
}
