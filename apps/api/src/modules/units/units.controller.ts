import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { UnitsService } from './units.service.js';

@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  async findAll() {
    return this.unitsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.unitsService.findById(id);
  }
}
