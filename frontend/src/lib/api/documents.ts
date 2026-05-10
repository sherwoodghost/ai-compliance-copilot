import { apiClient } from './client';

export const documentsApi = {
  list: (params?: { docType?: string; framework?: string; search?: string; page?: number; limit?: number }) =>
    apiClient.get('/documents', { params }).then((r) => r.data),

  search: (query: string, params?: { docType?: string; framework?: string; limit?: number }) =>
    apiClient.get('/documents/search', { params: { q: query, ...params } }).then((r) => r.data),

  getStats: () =>
    apiClient.get('/documents/stats').then((r) => r.data),

  get: (id: string) =>
    apiClient.get(`/documents/${id}`).then((r) => r.data),

  create: (data: { title: string; docType: string; content?: object; contentHtml?: string; controlIds?: string[]; detectedFrameworks?: string[] }) =>
    apiClient.post('/documents', data).then((r) => r.data),

  update: (id: string, data: { title?: string; docType?: string; content?: object; contentHtml?: string; controlIds?: string[]; detectedFrameworks?: string[] }) =>
    apiClient.patch(`/documents/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/documents/${id}`).then((r) => r.data),

  getVersions: (id: string) =>
    apiClient.get(`/documents/${id}/versions`).then((r) => r.data),

  createVersion: (id: string, changeNote?: string) =>
    apiClient.post(`/documents/${id}/versions`, { changeNote }).then((r) => r.data),

  getDownloadUrl: (id: string) =>
    apiClient.get(`/documents/${id}/download`).then((r) => r.data),

  getTemplates: () =>
    apiClient.get('/documents/templates').then((r) => r.data),

  createFromTemplate: (templateId: string, title?: string) =>
    apiClient.post('/documents/from-template', { templateId, title }).then((r) => r.data),

  exportDocument: (id: string, format: 'html' | 'text' | 'markdown' = 'html') =>
    apiClient.get(`/documents/${id}/export`, { params: { format }, responseType: 'blob' }),

  bulkExport: (params?: { docType?: string; framework?: string }) =>
    apiClient.get('/documents/bulk-export', { params }).then((r) => r.data),
};
