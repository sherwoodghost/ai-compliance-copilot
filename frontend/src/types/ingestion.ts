export interface IngestionBatch {
  id: string;
  orgId: string;
  totalFiles: number;
  processedFiles: number;
  autoPlaced: number;
  needsReview: number;
  failed: number;
  status: 'queued' | 'processing' | 'review_pending' | 'completed' | 'failed';
  jobStatusId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionFile {
  id: string;
  batchId: string;
  orgId: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  folderPath: string | null;
  status: 'queued' | 'classifying' | 'converting' | 'mapped' | 'needs_review' | 'skipped' | 'error';
  tier: number | null;
  detectedType: string | null;
  detectedFrameworks: string[];
  suggestedControlIds: string[];
  confidence: number | null;
  classificationReason: string | null;
  documentId: string | null;
  errorMessage: string | null;
  piiDetected: boolean;
  piiFields: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BatchStatusResponse {
  id: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  autoPlaced: number;
  needsReview: number;
  failed: number;
  filesByStatus: Record<string, number>;
  jobStatusId: string;
}
