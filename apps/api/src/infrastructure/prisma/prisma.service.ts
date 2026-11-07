import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conexão com o banco de dados PostgreSQL estabelecida com sucesso via Prisma.');
    } catch (error) {
      this.logger.error('Erro ao conectar ao PostgreSQL via Prisma:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Conexão com o banco de dados encerrada.');
  }
}
