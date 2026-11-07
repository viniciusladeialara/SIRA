import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { UnitsModule } from './modules/units/units.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { AmbientesModule } from './modules/ambientes/ambientes.module.js';
import { CursosModule } from './modules/cursos/cursos.module.js';
import { DocentesModule } from './modules/docentes/docentes.module.js';
import { TurmasModule } from './modules/turmas/turmas.module.js';
import { AgendamentosModule } from './modules/agendamentos/agendamentos.module.js';
import { FeriadosModule } from './modules/feriados/feriados.module.js';
import { SubstituicoesModule } from './modules/substituicoes/substituicoes.module.js';
import { AuditModule } from './infrastructure/interceptors/audit.module.js';
import { HttpExceptionFilter } from './infrastructure/filters/http-exception.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    AuthModule,
    RbacModule,
    TenantModule,
    UsersModule,
    UnitsModule,
    RolesModule,
    AmbientesModule,
    CursosModule,
    DocentesModule,
    TurmasModule,
    AgendamentosModule,
    FeriadosModule,
    SubstituicoesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
