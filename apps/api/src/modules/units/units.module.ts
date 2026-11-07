import { Module } from '@nestjs/common';
import { UnitsService } from './units.service.js';
import { UnitsController } from './units.controller.js';

@Module({
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
