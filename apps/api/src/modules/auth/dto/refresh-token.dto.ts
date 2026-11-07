import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'O refresh token deve ser uma cadeia de caracteres válida.' })
  @IsNotEmpty({ message: 'O refresh token é obrigatório.' })
  refreshToken!: string;
}
