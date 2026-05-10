import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateIngestionBatchDto {
  // Files come from multipart upload — no body fields needed
}

export class ReviewIngestionFileDto {
  documentType?: string;        // user override for detected type
  controlIds?: string[];        // user-confirmed control mappings
  documentId?: string;          // if mapped to an existing document
  skipFile?: boolean;           // skip this file entirely
}

export class BulkReviewDto {
  fileIds: string[];             // files to bulk-confirm
  documentType: string;          // apply this type to all
  controlIds?: string[];         // apply these controls to all
}
