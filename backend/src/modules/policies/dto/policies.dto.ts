import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PolicyStatus, GeneratedBy } from '@prisma/client';

export class CreatePolicyDto {
  @ApiProperty()
  @IsUUID()
  controlId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Full policy content in markdown' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: GeneratedBy, default: 'human' })
  @IsOptional()
  @IsEnum(GeneratedBy)
  generatedBy?: GeneratedBy;
}

export class GeneratePolicyDto {
  @ApiProperty({ description: 'Control ID to generate a policy for' })
  @IsUUID()
  controlId: string;
}

export class UpdatePolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: PolicyStatus })
  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;
}
