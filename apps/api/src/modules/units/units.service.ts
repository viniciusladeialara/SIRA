import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.unidades.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async findById(id: string) {
    const unit = await this.prisma.unidades.findUnique({
      where: { id },
    });

    if (!unit) {
      throw new NotFoundException(`Unidade operacional com ID [${id}] não encontrada.`);
    }

    return unit;
  }

  async findByCodigo(codigo: string) {
    const unit = await this.prisma.unidades.findUnique({
      where: { codigo },
    });

    if (!unit) {
      throw new NotFoundException(`Unidade com código [${codigo}] não encontrada.`);
    }

    return unit;
  }
}
