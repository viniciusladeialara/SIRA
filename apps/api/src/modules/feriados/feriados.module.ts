import { Module } from '@nestjs/common';
import { FeriadosService } from './feriados.service.js';
import { FeriadosController, CalendarHolidaysController } from './feriados.controller.js';

@Module({
  controllers: [FeriadosController, CalendarHolidaysController],
  providers: [FeriadosService],
  exports: [FeriadosService],
})
export class FeriadosModule {}
