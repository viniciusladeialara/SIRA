import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SubstituicoesService } from './substituicoes.service.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('swaps')
export class SubstituicoesController {
  constructor(private readonly substituicoesService: SubstituicoesService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string | null) {
    return this.substituicoesService.findAll(tenantId);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.substituicoesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any, @CurrentTenant() tenantId: string | null) {
    return this.substituicoesService.create(body, tenantId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.substituicoesService.updateStatus(id, status, user?.id);
  }
}
