import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AgendamentosService } from './agendamentos.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('agendamentos')
export class AgendamentosController {
  constructor(private readonly agendamentosService: AgendamentosService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string | null,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('roomId') roomId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.agendamentosService.findAll(tenantId, { start, end, roomId, teacherId });
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.agendamentosService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: any,
    @CurrentTenant() tenantId: string | null,
    @CurrentUser() user: any,
  ) {
    return this.agendamentosService.create(body, tenantId, user?.id);
  }

  @Put(':id')
  async updatePut(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.agendamentosService.update(id, body);
  }

  @Patch(':id')
  async updatePatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.agendamentosService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.agendamentosService.delete(id);
  }
}
