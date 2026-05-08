import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DocTypeDto      { policy = 'policy', procedure = 'procedure', template = 'template', evidence_note = 'evidence_note', report = 'report' }
export enum DocStatusDto    { draft = 'draft', review = 'review', approved = 'approved', archived = 'archived' }
export enum DocClassDto     { public = 'public', internal = 'internal', confidential = 'confidential', restricted = 'restricted' }

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ enum: DocTypeDto })
  @IsOptional()
  @IsEnum(DocTypeDto)
  docType?: DocTypeDto;

  @ApiPropertyOptional({ description: 'TipTap JSON content (object)' })
  @IsOptional()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional({ enum: DocClassDto })
  @IsOptional()
  @IsEnum(DocClassDto)
  classification?: DocClassDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  controlIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  frameworkIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reviewDue?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'TipTap JSON content (object)' })
  @IsOptional()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentHtml?: string;

  @ApiPropertyOptional({ enum: DocClassDto })
  @IsOptional()
  @IsEnum(DocClassDto)
  classification?: DocClassDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  controlIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  frameworkIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reviewDue?: string;
}

export class RejectDocumentDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class NewVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class AiImproveDto {
  @ApiProperty({ description: 'Selected HTML text to improve' })
  @IsString()
  selectedHtml: string;

  @ApiPropertyOptional({ description: 'Optional instruction for improvement' })
  @IsOptional()
  @IsString()
  instruction?: string;
}

export class ImportPdfDto {
  // File received via multipart — no class-validator needed
}

export class ListDocumentsDto {
  @IsOptional()
  @IsEnum(DocTypeDto)
  docType?: DocTypeDto;

  @IsOptional()
  @IsEnum(DocStatusDto)
  status?: DocStatusDto;

  @IsOptional()
  @IsEnum(DocClassDto)
  classification?: DocClassDto;

  @IsOptional()
  @IsString()
  search?: string;

  /** Semantic (vector) search query — requires pgvector + feature flag  */
  @IsOptional()
  @IsString()
  semanticSearch?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class SetLegalHoldDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
