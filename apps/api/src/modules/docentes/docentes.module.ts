import { Module } from '@nestjs/common';
import { DocentesService } from './docentes.service.js';
import { DocentesController, ProfessoresController } from './docentes.controller.js';

@Module({
  controllers: [DocentesController, ProfessoresController],
  providers: [DocentesService],
  exports: [DocentesService],
})
export class DocentesModule {}
