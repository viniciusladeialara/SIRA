import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { JwtPayload, AuthenticatedUser } from '../interfaces/jwt-payload.interface.js';
import { RedisCacheService } from '../../../infrastructure/redis/redis-cache.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly redisCacheService: RedisCacheService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'sira_super_secret_jwt_key_2026_dev_env_only',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthenticatedUser> {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (rawToken) {
      const isRevoked = await this.redisCacheService.isTokenDenylisted(rawToken);
      if (isRevoked) {
        throw new UnauthorizedException('Token de autenticação revogado. Por favor, autentique-se novamente.');
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      nome: payload.nome,
      unidadeId: payload.unidadeId,
      perfis: payload.perfis || [],
    };
  }
}
