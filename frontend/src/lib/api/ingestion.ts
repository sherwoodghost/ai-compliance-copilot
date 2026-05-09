import { apiClient } from './client';

export interface IngestionBatch {
  id: string;
  orgId: string;
  totalFiles: number;
  processedFiles: number;
  autoPlaced: number;
  needsReview: number;
  failed: number;
  status: 'queued' | 'processing' | 'review_pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface IngestionFile {
  id: string;
  batchId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  folderPath: string | null;
  status: 'queued' | 'extracting' | 'classifying' | 'mapped' | 'needs_review' | 'error' | 'skipped';
  confidence: number | null;
  detectedType: string | null;
  detectedFrameworks: string[];
  suggestedControlIds: string[];
  errorMessage: string | null;
  tier: number | null;
  createdAt: string;
}

export interface CreateBatchResult {
  batchId: string;
  jobStatusId: string;
  totalFiles: number;
}

export const ingestionApi = {
  /** Upload files to create an ingestion batch */
  async createBatch(files: File[], folderPaths?: Record<string, string>): Promise<CreateBatchResult> {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    if (folderPaths && Object.keys(folderPaths).length > 0) {
      form.append('folderPaths', JSON.stringify(folderPaths));
    }
    const { data } = await apiClient.post('/ingestion/batch', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  /** List all batches */
  async listBatches(): Promise<IngestionBatch[]> {
    const { data } = await apiClient.get('/ingestion/batches');
    return data;
  },

  /** Get batch status */
  async getBatch(batchId: string): Promise<IngestionBatch> {
    const { data } = await apiClient.get(`/ingestion/batch/${batchId}`);
    return data;
  },

  /** Get files in a batch, optionally filtered by status */
  async getBatchFiles(batchId: string, status?: string): Promise<IngestionFile[]> {
    const { data } = await apiClient.get(`/ingestion/batch/${batchId}/files`, {
      params: status ? { status } : undefined,
    });
    return data;
  },

  /** Review a single file */
  async reviewFile(fileId: string, dto: {
    status: 'mapped' | 'skipped' | 'needs_review';
    suggestedControlIds?: string[];
    detectedType?: string;
    detectedFrameworks?: string[];
  }): Promise<IngestionFile> {
    const { data } = await apiClient.patch(`/ingestion/files/${fileId}/review`, dto);
    return data;
  },

  /** Bulk review files */
  async bulkReview(batchId: string, fileIds: string[], status: 'mapped' | 'skipped'): Promise<{ updated: number }> {
    const { data } = await apiClient.post(`/ingestion/batch/${batchId}/bulk-review`, { fileIds, status });
    return data;
  },

  /** Get job status */
  async getJobStatus(jobId: string): Promise<{ status: string; progress: number; resultPayload: unknown; errorMessage: string | null }> {
    const { data } = await apiClient.get(`/jobs/${jobId}/status`);
    return data;
  },
};
