import { Module } from '@nestjs/common';
import { CursosService } from './cursos.service.js';
import { CursosController } from './cursos.controller.js';

@Module({
  controllers: [CursosController],
  providers: [CursosService],
  exports: [CursosService],
})
export class CursosModule {}
