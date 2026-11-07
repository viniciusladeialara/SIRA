import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { RolesGuard } from '../rbac/guards/roles.guard.js';

@Controller('reports')
@UseGuards(RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Dispara o refresh manual das Materialized Views (Exclusivo Administrador)
   */
  @Post('refresh')
  @Roles('administrador')
  @HttpCode(HttpStatus.OK)
  async refreshReports() {
    return this.reportsService.refreshAllReports();
  }

  /**
   * Relatório de Ocupação de Ambientes (JSON, CSV, XLSX, PDF)
   */
  @Get('ocupacao-ambientes')
  async getOcupacaoAmbientes(
    @Query('format') format?: 'json' | 'csv' | 'xlsx' | 'pdf',
    @Query('unidadeId') queryUnidadeId?: string,
    @CurrentTenant() tenantId?: string | null,
    @CurrentUser() user?: AuthenticatedUser,
    @Res() res?: Response,
  ) {
    const isSuperAdmin = user?.perfis?.includes('administrador') ?? false;
    const effectiveUnitId = isSuperAdmin ? queryUnidadeId || tenantId : tenantId || user?.unidadeId;

    if (format === 'csv' || format === 'xlsx' || format === 'pdf') {
      const exported = await this.reportsService.exportReport(
        'ocupacao_ambientes',
        format,
        effectiveUnitId,
        effectiveUnitId ? `Unidade ${effectiveUnitId}` : 'Todas as Unidades',
      );
      res!.setHeader('Content-Type', exported.contentType);
      res!.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      return res!.send(exported.buffer);
    }

    const data = await this.reportsService.getOcupacaoAmbientes(effectiveUnitId);
    return res!.json(data);
  }

  /**
   * Relatório de Carga Docente (JSON, CSV, XLSX, PDF)
   */
  @Get('carga-docentes')
  async getCargaDocentes(
    @Query('format') format?: 'json' | 'csv' | 'xlsx' | 'pdf',
    @Query('unidadeId') queryUnidadeId?: string,
    @CurrentTenant() tenantId?: string | null,
    @CurrentUser() user?: AuthenticatedUser,
    @Res() res?: Response,
  ) {
    const isSuperAdmin = user?.perfis?.includes('administrador') ?? false;
    const effectiveUnitId = isSuperAdmin ? queryUnidadeId || tenantId : tenantId || user?.unidadeId;

    if (format === 'csv' || format === 'xlsx' || format === 'pdf') {
      const exported = await this.reportsService.exportReport(
        'carga_docentes',
        format,
        effectiveUnitId,
        effectiveUnitId ? `Unidade ${effectiveUnitId}` : 'Todas as Unidades',
      );
      res!.setHeader('Content-Type', exported.contentType);
      res!.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      return res!.send(exported.buffer);
    }

    const data = await this.reportsService.getCargaDocentes(effectiveUnitId);
    return res!.json(data);
  }

  /**
   * Relatório de Turmas Ativas (JSON, CSV, XLSX, PDF)
   */
  @Get('turmas-ativas')
  async getTurmasAtivas(
    @Query('format') format?: 'json' | 'csv' | 'xlsx' | 'pdf',
    @Query('unidadeId') queryUnidadeId?: string,
    @CurrentTenant() tenantId?: string | null,
    @CurrentUser() user?: AuthenticatedUser,
    @Res() res?: Response,
  ) {
    const isSuperAdmin = user?.perfis?.includes('administrador') ?? false;
    const effectiveUnitId = isSuperAdmin ? queryUnidadeId || tenantId : tenantId || user?.unidadeId;

    if (format === 'csv' || format === 'xlsx' || format === 'pdf') {
      const exported = await this.reportsService.exportReport(
        'turmas_ativas',
        format,
        effectiveUnitId,
        effectiveUnitId ? `Unidade ${effectiveUnitId}` : 'Todas as Unidades',
      );
      res!.setHeader('Content-Type', exported.contentType);
      res!.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      return res!.send(exported.buffer);
    }

    const data = await this.reportsService.getTurmasAtivas(effectiveUnitId);
    return res!.json(data);
  }

  /**
   * Relatório de Conflitos e Sobreposições (JSON, CSV, XLSX, PDF)
   */
  @Get('conflitos')
  async getConflitos(
    @Query('format') format?: 'json' | 'csv' | 'xlsx' | 'pdf',
    @Query('unidadeId') queryUnidadeId?: string,
    @CurrentTenant() tenantId?: string | null,
    @CurrentUser() user?: AuthenticatedUser,
    @Res() res?: Response,
  ) {
    const isSuperAdmin = user?.perfis?.includes('administrador') ?? false;
    const effectiveUnitId = isSuperAdmin ? queryUnidadeId || tenantId : tenantId || user?.unidadeId;

    if (format === 'csv' || format === 'xlsx' || format === 'pdf') {
      const exported = await this.reportsService.exportReport(
        'conflitos',
        format,
        effectiveUnitId,
        effectiveUnitId ? `Unidade ${effectiveUnitId}` : 'Todas as Unidades',
      );
      res!.setHeader('Content-Type', exported.contentType);
      res!.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      return res!.send(exported.buffer);
    }

    const data = await this.reportsService.getConflitos(effectiveUnitId);
    return res!.json(data);
  }
}
