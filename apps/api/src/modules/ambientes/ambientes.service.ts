import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class AmbientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId?: string | null) {
    const where: any = { ativo: true };
    if (tenantId) {
      where.unidade_id = tenantId;
    }
    return this.prisma.ambientes.findMany({
      where,
      include: {
        unidades: {
          select: { id: true, nome: true, sigla: true, cidade: true },
        },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.ambientes.findUnique({
      where: { id },
      include: {
        unidades: true,
      },
    });
    if (!item) {
      throw new NotFoundException(`Ambiente com ID [${id}] não encontrado.`);
    }
    return item;
  }

  async create(data: any, tenantId?: string | null) {
    const targetUnitId = data.unidade_id || tenantId;
    if (!targetUnitId) {
      throw new Error('unidade_id é obrigatório para cadastrar um ambiente.');
    }

    return this.prisma.ambientes.create({
      data: {
        unidade_id: targetUnitId,
        nome: data.nome || data.name,
        tipo: data.tipo || data.type || 'Sala de Aula',
        capacidade: Number(data.capacidade || data.capacity || 30),
        bloco: data.bloco || data.block || 'Bloco A',
        andar: data.andar || data.floor || 'Térreo',
        ativo: data.ativo !== undefined ? data.ativo : (data.available !== undefined ? data.available : true),
        recursos: data.recursos || {},
      },
    });
  }

  async update(id: string, data: any) {
    await this.findById(id);
    const updateData: any = {};
    if (data.nome || data.name) updateData.nome = data.nome || data.name;
    if (data.tipo || data.type) updateData.tipo = data.tipo || data.type;
    if (data.capacidade !== undefined || data.capacity !== undefined) {
      updateData.capacidade = Number(data.capacidade ?? data.capacity);
    }
    if (data.bloco || data.block) updateData.bloco = data.bloco || data.block;
    if (data.andar || data.floor) updateData.andar = data.andar || data.floor;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;
    if (data.available !== undefined) updateData.ativo = data.available;
    if (data.recursos) updateData.recursos = data.recursos;

    return this.prisma.ambientes.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.ambientes.delete({
      where: { id },
    });
  }
}
