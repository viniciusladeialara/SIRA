import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DocentesService } from './docentes.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';

@Controller('docentes')
export class DocentesController {
  constructor(private readonly docentesService: DocentesService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.docentesService.findAll(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.docentesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.docentesService.create(body, tenantId);
  }

  @Put(':id')
  async updatePut(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.docentesService.update(id, body);
  }

  @Patch(':id')
  async updatePatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.docentesService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.docentesService.delete(id);
  }
}

@Controller('professores')
export class ProfessoresController {
  constructor(private readonly docentesService: DocentesService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.docentesService.findAll(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.docentesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.docentesService.create(body, tenantId);
  }

  @Put(':id')
  async updatePut(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.docentesService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.docentesService.delete(id);
  }
}
