import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RbacService } from './modules/rbac/rbac.service.js';
import { TenantContext } from './modules/tenant/tenant.context.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: RbacService,
          useValue: {
            hasPermission: () => Promise.resolve(true),
            getUserPermissions: () => Promise.resolve([]),
          },
        },
        {
          provide: TenantContext,
          useValue: {
            getTenantId: () => 'tenant-1',
            isSuperAdmin: () => false,
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
