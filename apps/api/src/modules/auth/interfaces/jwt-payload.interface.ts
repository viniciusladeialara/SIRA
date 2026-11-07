export interface JwtPayload {
  sub: string;
  email: string;
  nome: string;
  unidadeId: string | null;
  perfis: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  nome: string;
  unidadeId: string | null;
  perfis: string[];
}
