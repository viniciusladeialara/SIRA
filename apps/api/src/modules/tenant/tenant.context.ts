import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextData {
  unidadeId: string | null;
  userId?: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class TenantContext {
  private readonly asyncLocalStorage = new AsyncLocalStorage<TenantContextData>();

  /**
   * Executa a função fornecida dentro do escopo do contexto de unidade
   */
  run<T>(data: TenantContextData, callback: () => T): T {
    return this.asyncLocalStorage.run(data, callback);
  }

  /**
   * Retorna os dados completos do contexto da requisição atual
   */
  get(): TenantContextData | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Retorna o ID da unidade operacional ativa no contexto atual
   */
  getTenantId(): string | null {
    return this.asyncLocalStorage.getStore()?.unidadeId ?? null;
  }

  /**
   * Retorna se a requisição está sendo executada por um superusuário (Administrador)
   */
  isSuperAdmin(): boolean {
    return this.asyncLocalStorage.getStore()?.isSuperAdmin ?? false;
  }
}
