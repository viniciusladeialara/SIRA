import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsUUID, IsArray, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'O nome deve ser uma cadeia de caracteres.' })
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  nome!: string;

  @IsEmail({}, { message: 'E-mail em formato inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @IsString({ message: 'A senha deve ser uma cadeia de caracteres.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  senha!: string;

  @IsUUID('4', { message: 'O ID da unidade deve ser um UUID v4 válido.' })
  @IsOptional()
  unidadeId?: string;

  @IsArray({ message: 'Os perfis devem ser informados como uma lista de slugs.' })
  @IsString({ each: true, message: 'Cada perfil deve ser uma string identificadora.' })
  @IsOptional()
  perfis?: string[];

  @IsBoolean({ message: 'O status ativo deve ser booleano.' })
  @IsOptional()
  ativo?: boolean;
}
