import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContext } from './tenant.context.js';
import { TenantInterceptor } from './tenant.interceptor.js';
import { TenantScopeHelper } from './tenant-scope.helper.js';

@Global()
@Module({
  providers: [
    TenantContext,
    TenantScopeHelper,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
  exports: [TenantContext, TenantScopeHelper],
})
export class TenantModule {}
