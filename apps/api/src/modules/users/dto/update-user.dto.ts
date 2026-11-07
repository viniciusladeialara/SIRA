import { IsEmail, IsString, MinLength, IsOptional, IsUUID, IsArray, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  senha?: string;

  @IsUUID('4')
  @IsOptional()
  unidadeId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perfis?: string[];

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
