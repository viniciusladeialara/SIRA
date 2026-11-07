import { Module } from '@nestjs/common';
import { SubstituicoesService } from './substituicoes.service.js';
import { SubstituicoesController } from './substituicoes.controller.js';

@Module({
  controllers: [SubstituicoesController],
  providers: [SubstituicoesService],
  exports: [SubstituicoesService],
})
export class SubstituicoesModule {}
