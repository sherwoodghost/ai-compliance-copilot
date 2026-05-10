import {
  IsOptional, IsInt, Min, Max, IsString, IsBoolean,
  IsArray, IsIn, ArrayMaxSize,
} from 'class-validator';

export class CreateIngestionBatchDto {
  // Files come from multipart upload — no body fields needed
}

const DOCUMENT_TYPES = ['policy', 'procedure', 'evidence', 'report', 'template', 'other'] as const;

export class ReviewIngestionFileDto {
  @IsOptional()
  @IsString()
  @IsIn([...DOCUMENT_TYPES])
  documentType?: string;        // user override for detected type

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  controlIds?: string[];        // user-confirmed control mappings

  @IsOptional()
  @IsString()
  documentId?: string;          // if mapped to an existing document

  @IsOptional()
  @IsBoolean()
  skipFile?: boolean;           // skip this file entirely
}

export class BulkReviewDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  fileIds: string[];             // files to bulk-confirm

  @IsOptional()
  @IsString()
  @IsIn([...DOCUMENT_TYPES])
  documentType: string;          // apply this type to all

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  controlIds?: string[];         // apply these controls to all
}
