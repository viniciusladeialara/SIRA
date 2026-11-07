import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from './feature-flag.decorator.js';
import { FeatureFlagService } from './feature-flag.service.js';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFlag = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFlag) {
      return true;
    }

    const isEnabled = await this.featureFlagService.isEnabled(requiredFlag);

    if (!isEnabled) {
      throw new ForbiddenException(
        `A funcionalidade vinculada a este recurso está temporariamente desativada (${requiredFlag}).`,
      );
    }

    return true;
  }
}
