import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export class ReviewFileDto {
  @IsEnum(['mapped', 'skipped', 'needs_review'])
  status: 'mapped' | 'skipped' | 'needs_review';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedControlIds?: string[];

  @IsOptional()
  @IsString()
  detectedType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  detectedFrameworks?: string[];
}

export class BulkReviewDto {
  @IsArray()
  fileIds: string[];

  @IsEnum(['mapped', 'skipped'])
  status: 'mapped' | 'skipped';
}
