import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceType, EvidenceSource } from '@prisma/client';

export class CreateEvidenceDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  controlId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: EvidenceType })
  @IsEnum(EvidenceType)
  type: EvidenceType;

  @ApiProperty({ enum: EvidenceSource })
  @IsEnum(EvidenceSource)
  source: EvidenceSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateEvidenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isValid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
