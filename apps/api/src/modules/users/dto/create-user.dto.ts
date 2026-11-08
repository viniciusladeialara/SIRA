import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsUUID, IsArray, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'O nome deve ser uma cadeia de caracteres.' })
  @IsOptional()
  nome?: string;

  @IsString({ message: 'O nome deve ser uma cadeia de caracteres.' })
  @IsOptional()
  name?: string;

  @IsEmail({}, { message: 'E-mail em formato inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @IsString({ message: 'A senha deve ser uma cadeia de caracteres.' })
  @IsOptional()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  senha?: string;

  @IsString({ message: 'A senha deve ser uma cadeia de caracteres.' })
  @IsOptional()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  password?: string;

  @IsUUID('4', { message: 'O ID da unidade deve ser um UUID v4 válido.' })
  @IsOptional()
  unidadeId?: string;

  @IsUUID('4', { message: 'O ID da unidade deve ser um UUID v4 válido.' })
  @IsOptional()
  selectedUnitId?: string;

  @IsArray({ message: 'As unidades atribuídas devem ser uma lista de UUIDs.' })
  @IsUUID('4', { each: true, message: 'Cada unidade atribuída deve ser um UUID v4.' })
  @IsOptional()
  unitIds?: string[];

  @IsArray({ message: 'Os perfis devem ser informados como uma lista de slugs.' })
  @IsString({ each: true, message: 'Cada perfil deve ser uma string identificadora.' })
  @IsOptional()
  perfis?: string[];

  @IsString({ message: 'O perfil do usuário deve ser uma cadeia de caracteres.' })
  @IsOptional()
  role?: string;

  @IsArray({ message: 'Os módulos liberados devem ser uma lista de identificadores.' })
  @IsString({ each: true, message: 'Cada módulo deve ser uma string.' })
  @IsOptional()
  allowedModules?: string[];

  @IsArray({ message: 'Os módulos liberados devem ser uma lista de identificadores.' })
  @IsString({ each: true, message: 'Cada módulo deve ser uma string.' })
  @IsOptional()
  modulos?: string[];

  @IsBoolean({ message: 'O status ativo deve ser booleano.' })
  @IsOptional()
  ativo?: boolean;

  @IsBoolean({ message: 'O status isActive deve ser booleano.' })
  @IsOptional()
  isActive?: boolean;
}
