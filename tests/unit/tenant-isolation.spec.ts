import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantInterceptor } from '../../apps/api/src/modules/tenant/tenant.interceptor.js';
import { TenantContext } from '../../apps/api/src/modules/tenant/tenant.context.js';

describe('TenantInterceptor Multi-Tenant Validation (Unit)', () => {
  let interceptor: TenantInterceptor;
  let tenantContext: TenantContext;

  beforeEach(() => {
    tenantContext = new TenantContext();
    interceptor = new TenantInterceptor(tenantContext);
  });

  const createMockContext = (user: any, headers: Record<string, string> = {}) => {
    const request: any = {
      user,
      headers,
    };
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as any;
  };

  const nextHandler = {
    handle: () => of('SUCCESS'),
  };

  it('deve bloquear com 403 Forbidden se o usuário regular tentar acessar unidade divergente de seu JWT', () => {
    const context = createMockContext(
      {
        id: 'u-1',
        email: 'user@sira.com',
        unidadeId: 'unidade-cuiaba',
        perfis: ['usuario'],
      },
      {
        'x-unidade-id': 'unidade-rondonopolis',
      },
    );

    expect(() => interceptor.intercept(context, nextHandler)).toThrow(ForbiddenException);
  });

  it('deve permitir acesso se Header Tenant for idêntico ao JWT Tenant', () => {
    const context = createMockContext(
      {
        id: 'u-1',
        email: 'user@sira.com',
        unidadeId: 'unidade-cuiaba',
        perfis: ['usuario'],
      },
      {
        'x-unidade-id': 'unidade-cuiaba',
      },
    );

    let capturedResult = '';
    const observable = interceptor.intercept(context, nextHandler);
    observable.subscribe({
      next: (val) => {
        capturedResult = val;
      },
    });

    expect(capturedResult).toBe('SUCCESS');
  });

  it('deve permitir que SuperAdmin opere em qualquer unidade via Header', () => {
    const context = createMockContext(
      {
        id: 'admin-1',
        email: 'admin@sira.com',
        unidadeId: 'unidade-cuiaba',
        perfis: ['administrador'],
      },
      {
        'x-unidade-id': 'unidade-caceres',
      },
    );

    let capturedResult = '';
    const observable = interceptor.intercept(context, nextHandler);
    observable.subscribe({
      next: (val) => {
        capturedResult = val;
      },
    });

    expect(capturedResult).toBe('SUCCESS');
  });
});
