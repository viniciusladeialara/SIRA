import { Module, Global } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
import { FeatureFlagController } from './feature-flag.controller.js';
import { FeatureFlagGuard } from './feature-flag.guard.js';

@Global()
@Module({
  controllers: [FeatureFlagController],
  providers: [FeatureFlagService, FeatureFlagGuard],
  exports: [FeatureFlagService, FeatureFlagGuard],
})
export class FeatureFlagModule {}
