import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class InviteUserDto {
  @ApiProperty({ example: 'john@acme.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.member })
  @IsEnum(UserRole)
  role: UserRole;
}
