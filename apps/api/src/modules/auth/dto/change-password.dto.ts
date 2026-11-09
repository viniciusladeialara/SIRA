import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'A nova senha deve ser uma cadeia de caracteres.' })
  @IsNotEmpty({ message: 'A nova senha é obrigatória.' })
  @MinLength(6, { message: 'A nova senha deve ter no mínimo 6 caracteres.' })
  newPassword!: string;

  @IsString({ message: 'A senha atual deve ser uma cadeia de caracteres.' })
  @IsOptional()
  currentPassword?: string;
}
