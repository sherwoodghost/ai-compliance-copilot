import { apiClient } from './client';

export const integrationsApi = {
  list: () => apiClient.get('/integrations').then((r) => r.data),
  connect: (provider: string, credentials: Record<string, string>) =>
    apiClient.post('/integrations', { provider, credentials }).then((r) => r.data),
  sync: (id: string) => apiClient.post(`/integrations/${id}/sync`).then((r) => r.data),
  disconnect: (id: string) => apiClient.delete(`/integrations/${id}`).then((r) => r.data),
};
