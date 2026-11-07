import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber } from 'class-validator';

export class PromoteDto {
  @IsString({ message: 'A senha do administrador deve ser uma string.' })
  @IsNotEmpty({ message: 'A senha do administrador é obrigatória para autorizar a publicação em produção.' })
  adminPassword!: string;

  @IsString({ message: 'O ID da unidade deve ser uma string.' })
  @IsOptional()
  unidadeId?: string;

  @IsString({ message: 'O motivo deve ser uma string.' })
  @IsNotEmpty({ message: 'A justificativa/motivo da publicação para produção é obrigatória para fins de auditoria.' })
  motivo!: string;

  @IsNumber({}, { message: 'O ano letivo deve ser numérico.' })
  @IsOptional()
  anoLetivo?: number;

  @IsNumber({}, { message: 'O semestre deve ser numérico (1 ou 2).' })
  @IsOptional()
  semestre?: number;

  @IsArray({ message: 'O campo entities deve ser uma lista de entidades.' })
  @IsOptional()
  entities?: string[];
}
