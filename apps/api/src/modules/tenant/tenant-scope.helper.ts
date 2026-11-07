import { Injectable } from '@nestjs/common';
import { TenantContext } from './tenant.context.js';

@Injectable()
export class TenantScopeHelper {
  constructor(private readonly tenantContext: TenantContext) {}

  /**
   * Aplica o filtro de unidade_id a um objeto 'where' de consulta Prisma
   * Se for superadministrador e não houver unidade específica no contexto, retorna o 'where' sem restrição.
   */
  applyScope<T extends Record<string, any>>(where: T = {} as T): T {
    const tenantId = this.tenantContext.getTenantId();
    const isSuper = this.tenantContext.isSuperAdmin();

    if (tenantId) {
      return {
        ...where,
        unidade_id: tenantId,
      };
    }

    if (isSuper) {
      return where;
    }

    // Usuário não-admin sem unidade: impede vazamento de dados
    return {
      ...where,
      unidade_id: '00000000-0000-0000-0000-000000000000',
    };
  }

  /**
   * Obtém o ID da unidade atual ou lança exceção se for mandatório para a operação
   */
  requireTenantId(): string {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Identificador de unidade obrigatório não encontrado no contexto atual.');
    }
    return tenantId;
  }
}
