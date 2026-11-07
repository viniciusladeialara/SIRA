import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class MirrorDto {
  @IsString({ message: 'A senha do administrador deve ser uma string.' })
  @IsNotEmpty({ message: 'A senha do administrador é obrigatória para autorizar o espelhamento.' })
  adminPassword!: string;

  @IsBoolean({ message: 'O campo sanitize deve ser booleano.' })
  @IsOptional()
  sanitize?: boolean = true;
}
