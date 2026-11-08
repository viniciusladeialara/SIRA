import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Param,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { RolesGuard } from '../rbac/guards/roles.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60 })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-device-id') headerDeviceId?: string,
  ) {
    const deviceId = headerDeviceId || loginDto.deviceId;
    return this.authService.login(loginDto, ip, userAgent, deviceId);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 60 })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Headers('x-device-id') headerDeviceId?: string,
  ) {
    const deviceId = headerDeviceId || refreshTokenDto.deviceId;
    return this.authService.refreshTokens(refreshTokenDto, ip, userAgent, deviceId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const authHeader = req.headers.authorization || '';
    const rawAccessToken = authHeader.replace(/^Bearer\s+/i, '');
    return this.authService.logout(rawAccessToken, body?.refreshToken, user?.id);
  }

  /**
   * Revoga todas as sessões ativas do usuário logado (todos os navegadores/dispositivos)
   */
  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAllCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.revokeAll(user.id, user.email);
  }

  /**
   * Administrador revoga todas as sessões ativas de um usuário específico
   */
  @Post('revoke-user/:userId')
  @UseGuards(RolesGuard)
  @Roles('administrador')
  @HttpCode(HttpStatus.OK)
  async revokeUserSessions(
    @Param('userId') targetUserId: string,
    @CurrentUser() adminUser: AuthenticatedUser,
  ) {
    return this.authService.revokeAll(targetUserId, adminUser.email);
  }

  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    if (!user || !user.id) return user;
    return this.authService.getProfile(user.id);
  }
}
