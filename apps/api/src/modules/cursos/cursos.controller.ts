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
import { CursosService } from './cursos.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Controller('cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.cursosService.findAll(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.cursosService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.cursosService.create(body, tenantId);
  }

  @Put(':id')
  async updatePut(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.cursosService.update(id, body);
  }

  @Patch(':id')
  async updatePatch(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
    return this.cursosService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.cursosService.delete(id, user?.id);
  }
}
