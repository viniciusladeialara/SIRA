import { Module } from '@nestjs/common';
import { TurmasService } from './turmas.service.js';
import { TurmasController } from './turmas.controller.js';

@Module({
  controllers: [TurmasController],
  providers: [TurmasService],
  exports: [TurmasService],
})
export class TurmasModule {}
