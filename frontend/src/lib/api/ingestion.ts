import { apiClient } from './client';

export interface FileWithPath {
  file: File;
  folderPath?: string;
}

export const ingestionApi = {
  createBatch: (filesWithPaths: FileWithPath[], onProgress?: (percent: number) => void) => {
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
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            onProgress(percent);
          }
        },
      })
      .then((r) => r.data);
  },

  createPresignedBatch: async (files: FileWithPath[]) => {
    const filesMeta = files.map(f => ({
      filename: f.file.name,
      mimeType: f.file.type || 'application/octet-stream',
      sizeBytes: f.file.size,
      folderPath: f.folderPath,
    }));

    const { data: batch } = await apiClient.post('/ingestion/batches/presigned', { files: filesMeta });

    // Upload files directly to S3 via presigned URLs
    const uploadPromises = batch.uploadUrls.map(async (urlInfo: any, i: number) => {
      const file = files.find(f => f.file.name === urlInfo.filename)?.file;
      if (!file) return;

      await fetch(urlInfo.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
    });

    // Upload with concurrency limit of 5
    for (let i = 0; i < uploadPromises.length; i += 5) {
      await Promise.all(uploadPromises.slice(i, i + 5));
    }

    // Confirm batch
    const { data: confirmed } = await apiClient.post(`/ingestion/batches/${batch.batchId}/confirm`);
    return { data: confirmed };
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
