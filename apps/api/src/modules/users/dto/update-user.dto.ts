import { IsEmail, IsString, MinLength, IsOptional, IsUUID, IsArray, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  senha?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsUUID('4')
  @IsOptional()
  unidadeId?: string;

  @IsUUID('4')
  @IsOptional()
  selectedUnitId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  unitIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perfis?: string[];

  @IsString()
  @IsOptional()
  role?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedModules?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modulos?: string[];

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
