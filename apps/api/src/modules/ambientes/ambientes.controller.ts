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
import { AmbientesService } from './ambientes.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Controller('ambientes')
export class AmbientesController {
  constructor(private readonly ambientesService: AmbientesService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.ambientesService.findAll(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ambientesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.ambientesService.create(body, tenantId);
  }

  @Put(':id')
  async updatePut(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.ambientesService.update(id, body);
  }

  @Patch(':id')
  async updatePatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.ambientesService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.ambientesService.delete(id, user?.id);
  }
}

@Controller('salas')
export class SalasController {
  constructor(private readonly ambientesService: AmbientesService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.ambientesService.findAll(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ambientesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.ambientesService.create(body, tenantId);
  }

  @Put(':id')
  async updatePut(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.ambientesService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.ambientesService.delete(id, user?.id);
  }
}
