import { apiClient } from './client';

export interface FileWithPath {
  file: File;
  folderPath?: string;
}

export const ingestionApi = {
  createBatch: (filesWithPaths: FileWithPath[]) => {
    const formData = new FormData();
    const folderPaths: Record<string, string> = {};

    filesWithPaths.forEach(({ file, folderPath }) => {
      formData.append('files', file);
      if (folderPath) {
        folderPaths[file.name] = folderPath;
      }
    });

    // Send folder paths as a JSON field alongside files
    if (Object.keys(folderPaths).length > 0) {
      formData.append('folderPaths', JSON.stringify(folderPaths));
    }

    return apiClient
      .post('/ingestion/batches', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 min for large uploads
      })
      .then((r) => r.data);
  },

  listBatches: () =>
    apiClient.get('/ingestion/batches').then((r) => r.data),

  getBatchStatus: (batchId: string) =>
    apiClient.get(`/ingestion/batches/${batchId}`).then((r) => r.data),

  getBatchFiles: (batchId: string, status?: string) =>
    apiClient
      .get(`/ingestion/batches/${batchId}/files`, { params: status ? { status } : {} })
      .then((r) => r.data),

  reviewFile: (fileId: string, dto: {
    documentType?: string;
    controlIds?: string[];
    documentId?: string;
    skipFile?: boolean;
  }) =>
    apiClient.patch(`/ingestion/files/${fileId}/review`, dto).then((r) => r.data),

  bulkReview: (batchId: string, dto: {
    fileIds: string[];
    documentType?: string;
    controlIds?: string[];
  }) =>
    apiClient.post(`/ingestion/batches/${batchId}/bulk-review`, dto).then((r) => r.data),
};
