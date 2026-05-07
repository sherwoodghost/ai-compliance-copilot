import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ControlStatus } from '@prisma/client';

export class UpdateOrgControlDto {
  @ApiPropertyOptional({ enum: ControlStatus })
  @IsOptional()
  @IsEnum(ControlStatus)
  status?: ControlStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkAssignControlsDto {
  @ApiPropertyOptional()
  @IsUUID('4', { each: true })
  controlIds: string[];

  @ApiPropertyOptional()
  @IsUUID()
  assignedTo: string;
}

export class ControlFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  frameworkId?: string;

  @ApiPropertyOptional({ enum: ControlStatus })
  @IsOptional()
  @IsEnum(ControlStatus)
  status?: ControlStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}

// ─── Control Exception DTOs ───────────────────────────────────────────────────

export class CreateExceptionDto {
  @IsUUID()
  controlId: string;

  @IsString()
  title: string;

  @IsString()
  justification: string;

  @IsOptional()
  @IsString()
  compensatingControl?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsUUID()
  riskOwnerId?: string;
}

export class UpdateExceptionDto {
  @IsOptional()
  @IsString()
  status?: 'pending' | 'approved' | 'rejected' | 'expired';

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
