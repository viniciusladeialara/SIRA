import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 dias em segundos

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Valida as credenciais do usuário contra o banco de dados (bcrypt hash)
   */
  async validateUser(email: string, pass: string) {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { email },
      include: {
        usuario_perfis: {
          include: {
            perfis: true,
          },
        },
        unidades: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!usuario.ativo) {
      throw new UnauthorizedException('Usuário inativo. Contate o administrador do sistema.');
    }

    const isPasswordValid = await bcrypt.compare(pass, usuario.senha_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const perfis = usuario.usuario_perfis.map((up) => up.perfis.slug);

    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      unidadeId: usuario.unidade_id,
      unidade: usuario.unidades ? { id: usuario.unidades.id, nome: usuario.unidades.nome, sigla: usuario.unidades.sigla } : null,
      perfis,
    };
  }

  /**
   * Autenticação e emissão inicial de Access Token + Refresh Token
   */
  async login(loginDto: LoginDto, ip?: string, userAgent?: string) {
    const rawPassword = loginDto.senha || loginDto.password;
    if (!rawPassword) {
      throw new UnauthorizedException('A senha é obrigatória.');
    }
    const user = await this.validateUser(loginDto.email, rawPassword);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      nome: user.nome,
      unidadeId: user.unidadeId,
      perfis: user.perfis,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomUUID();

    // Armazena o refresh token no Redis associado ao ID do usuário com TTL de 7 dias
    const refreshKey = `sira:refresh:${refreshToken}`;
    await this.redisCache.set(refreshKey, { userId: user.id, email: user.email }, this.REFRESH_TOKEN_TTL);

    // Registro na trilha imutável de auditoria
    try {
      await this.prisma.logs.create({
        data: {
          usuario_id: user.id,
          usuario_email: user.email,
          unidade_id: user.unidadeId,
          schema_name: 'core',
          tabela: 'usuarios',
          registro_id: user.id,
          acao: 'LOGIN',
          ip: ip || 'unknown',
          user_agent: userAgent || 'unknown',
          dados_novos: { evento: 'LOGIN_SUCESSO', email: user.email },
        },
      });
    } catch (auditError) {
      this.logger.warn('Falha não-bloqueante ao registrar log de login na auditoria:', auditError);
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hora
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        unidade: user.unidade,
        perfis: user.perfis,
      },
    };
  }

  /**
   * Renovação de Access Token via Refresh Token com rotação automática
   */
  async refreshTokens(dto: RefreshTokenDto) {
    const refreshKey = `sira:refresh:${dto.refreshToken}`;
    const session = await this.redisCache.get<{ userId: string; email: string }>(refreshKey);

    if (!session) {
      throw new UnauthorizedException('Refresh token expirado ou inválido.');
    }

    // Invalida o refresh token utilizado (Rotação de Refresh Token)
    await this.redisCache.del(refreshKey);

    // Busca dados atualizados do usuário
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id: session.userId },
      include: {
        usuario_perfis: {
          include: {
            perfis: true,
          },
        },
        unidades: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário inativo ou não encontrado.');
    }

    const perfis = usuario.usuario_perfis.map((up) => up.perfis.slug);

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      unidadeId: usuario.unidade_id,
      perfis,
    };

    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = randomUUID();

    // Grava novo refresh token no Redis
    const newRefreshKey = `sira:refresh:${newRefreshToken}`;
    await this.redisCache.set(newRefreshKey, { userId: usuario.id, email: usuario.email }, this.REFRESH_TOKEN_TTL);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
    };
  }

  /**
   * Encerramento de sessão (Logout) com adição do token à Denylist do Redis
   */
  async logout(rawAccessToken: string, refreshToken?: string, userId?: string) {
    if (rawAccessToken) {
      try {
        const decoded = this.jwtService.decode(rawAccessToken) as JwtPayload;
        if (decoded && decoded.exp) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const remainingSeconds = Math.max(0, decoded.exp - nowSeconds);
          if (remainingSeconds > 0) {
            await this.redisCache.addToDenylist(rawAccessToken, remainingSeconds);
          }
        }
      } catch (err) {
        this.logger.warn('Erro ao calcular expiração do token no logout:', err);
      }
    }

    if (refreshToken) {
      const refreshKey = `sira:refresh:${refreshToken}`;
      await this.redisCache.del(refreshKey);
    }

    if (userId) {
      try {
        await this.prisma.logs.create({
          data: {
            usuario_id: userId,
            schema_name: 'core',
            tabela: 'usuarios',
            registro_id: userId,
            acao: 'LOGOUT',
            dados_novos: { evento: 'LOGOUT_VOLUNTARIO' },
          },
        });
      } catch (auditError) {
        this.logger.warn('Falha não-bloqueante ao registrar log de logout:', auditError);
      }
    }

    return { message: 'Sessão encerrada com sucesso.' };
  }
}
