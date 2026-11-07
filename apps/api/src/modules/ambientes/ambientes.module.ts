import { Module } from '@nestjs/common';
import { AmbientesService } from './ambientes.service.js';
import { AmbientesController, SalasController } from './ambientes.controller.js';

@Module({
  controllers: [AmbientesController, SalasController],
  providers: [AmbientesService],
  exports: [AmbientesService],
})
export class AmbientesModule {}
