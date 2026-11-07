import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class FeriadosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId?: string | null) {
    const where: any = {
      OR: [
        { unidade_id: null },
        ...(tenantId ? [{ unidade_id: tenantId }] : []),
      ],
    };

    return this.prisma.feriados.findMany({
      where,
      orderBy: { data: 'asc' },
    });
  }

  async create(data: any, tenantId?: string | null) {
    return this.prisma.feriados.create({
      data: {
        unidade_id: data.unidade_id || tenantId || null,
        nome: data.nome || data.name,
        data: new Date(data.data || data.date),
        tipo: data.tipo || data.type || 'feriado',
      },
    });
  }

  async delete(id: string) {
    const item = await this.prisma.feriados.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Feriado com ID [${id}] não encontrado.`);
    }
    return this.prisma.feriados.delete({ where: { id } });
  }
}
