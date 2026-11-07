import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Formato de e-mail inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email!: string;

  @IsString({ message: 'A senha deve ser uma cadeia de caracteres.' })
  @IsOptional()
  senha?: string;

  @IsString({ message: 'A senha deve ser uma cadeia de caracteres.' })
  @IsOptional()
  password?: string;

  @IsString({ message: 'O deviceId deve ser uma cadeia de caracteres.' })
  @IsOptional()
  deviceId?: string;
}
