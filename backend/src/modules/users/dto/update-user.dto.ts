import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsString()
  currentPassword: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#])[A-Za-z\d@$!%*?&^#]/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  newPassword: string;
}
