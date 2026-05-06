import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: Plan, default: Plan.starter })
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;
}
