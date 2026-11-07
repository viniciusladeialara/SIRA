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
import { TurmasService } from './turmas.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';

@Controller('turmas')
export class TurmasController {
  constructor(private readonly turmasService: TurmasService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.turmasService.findAll(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.turmasService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.turmasService.create(body, tenantId);
  }

  @Put(':id')
  async updatePut(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.turmasService.update(id, body);
  }

  @Patch(':id')
  async updatePatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.turmasService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.turmasService.delete(id);
  }
}
