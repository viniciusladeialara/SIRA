import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FeriadosService } from './feriados.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';

@Controller('feriados')
export class FeriadosController {
  constructor(private readonly feriadosService: FeriadosService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.feriadosService.findAll(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.feriadosService.create(body, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.feriadosService.delete(id);
  }
}

@Controller('calendar/holidays')
export class CalendarHolidaysController {
  constructor(private readonly feriadosService: FeriadosService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.feriadosService.findAll(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.feriadosService.create(body, tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.feriadosService.delete(id);
  }
}
