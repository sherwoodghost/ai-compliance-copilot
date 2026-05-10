import { IsOptional, IsString, IsArray, IsInt, Min, IsIn } from 'class-validator';

export class ListDocumentsDto {
  @IsOptional() @IsString()
  docType?: string;

  @IsOptional() @IsString()
  framework?: string;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsInt() @Min(1)
  page?: number;

  @IsOptional() @IsInt() @Min(1)
  limit?: number;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  @IsIn(['policy', 'procedure', 'evidence', 'report', 'template', 'other'])
  docType?: string;

  @IsOptional()
  content?: Record<string, any>; // TipTap JSON

  @IsOptional() @IsString()
  contentHtml?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  controlIds?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  detectedFrameworks?: string[];
}

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsString()
  @IsIn(['policy', 'procedure', 'evidence', 'report', 'template', 'other'])
  docType: string;

  @IsOptional()
  content?: Record<string, any>;

  @IsOptional() @IsString()
  contentHtml?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  controlIds?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  detectedFrameworks?: string[];
}

export class CreateVersionDto {
  @IsOptional() @IsString()
  changeNote?: string;
}
