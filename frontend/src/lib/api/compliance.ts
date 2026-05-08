import { apiClient } from './client';

export const complianceApi = {
  // Org
  getOrgStats: () => apiClient.get('/organizations/me/stats').then((r) => r.data),

  // Controls
  getControls: (params?: Record<string, string>) =>
    apiClient.get('/controls', { params }).then((r) => r.data),
  getControlStats: () => apiClient.get('/controls/stats').then((r) => r.data),
  getControlHeatmap: () => apiClient.get('/controls/heatmap').then((r) => r.data),
  updateControl: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/controls/${id}`, data).then((r) => r.data),
  initializeControls: (frameworkId: string) =>
    apiClient.post('/controls/initialize', { frameworkId }).then((r) => r.data),

  // Evidence
  getEvidence: (params?: Record<string, string>) =>
    apiClient.get('/evidence', { params }).then((r) => r.data),
  getExpiryReport: () => apiClient.get('/evidence/expiry-report').then((r) => r.data),
  uploadEvidence: (data: FormData) =>
    apiClient.post('/evidence/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  getEvidenceDownloadUrl: (id: string) =>
    apiClient.get(`/evidence/${id}/download`).then((r) => r.data),
  deleteEvidence: (id: string) => apiClient.delete(`/evidence/${id}`).then((r) => r.data),

  // Policies
  getPolicies: () => apiClient.get('/policies').then((r) => r.data),
  getPolicy: (id: string) => apiClient.get(`/policies/${id}`).then((r) => r.data),
  getPolicyVersions: (id: string) => apiClient.get(`/policies/${id}/versions`).then((r) => r.data),
  approvePolicy: (id: string) => apiClient.patch(`/policies/${id}/approve`).then((r) => r.data),
  archivePolicy: (id: string) => apiClient.patch(`/policies/${id}/archive`).then((r) => r.data),
  // Policy templates
  getPolicyTemplates: () => apiClient.get('/policies/templates').then((r) => r.data),
  instantiatePolicyTemplate: (templateId: string) =>
    apiClient.post(`/policies/from-template/${templateId}`).then((r) => r.data),
  instantiateAllPolicyTemplates: () =>
    apiClient.post('/policies/from-template-all').then((r) => r.data),

  // Tasks
  getMyTasks: () => apiClient.get('/tasks/mine').then((r) => r.data),
  getTasks: (params?: Record<string, string>) =>
    apiClient.get('/tasks', { params }).then((r) => r.data),
  getTaskStats: () => apiClient.get('/tasks/stats').then((r) => r.data),
  updateTask: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/tasks/${id}`, data).then((r) => r.data),

  // Workflows (control panel)
  listWorkflows: () => apiClient.get('/control-panel/workflows').then((r) => r.data),
  getSystemStats: () => apiClient.get('/control-panel/stats').then((r) => r.data),
  getWorkflowCanvas: (id: string) =>
    apiClient.get(`/control-panel/workflows/${id}/canvas`).then((r) => r.data),

  getWorkflowEvents: (id: string) =>
    apiClient.get(`/control-panel/workflows/${id}/events`).then((r) => r.data),

  // Orchestrator
  triggerAssessment: (frameworkType: string) =>
    apiClient.post('/orchestrator/assess', { frameworkType }).then((r) => r.data),

  replayFromAgent: (workflowId: string, agentName: string, customInput?: Record<string, unknown>) =>
    apiClient.post(`/orchestrator/workflows/${workflowId}/replay`, { agentName, customInput }).then((r) => r.data),

  // Control Tests
  getControlTestSummary: () =>
    apiClient.get('/control-tests/summary').then((r) => r.data),
  getControlTestResults: () =>
    apiClient.get('/control-tests/results').then((r) => r.data),
  runAllControlTests: () =>
    apiClient.post('/control-tests/run').then((r) => r.data),
  runControlTest: (testId: string) =>
    apiClient.post(`/control-tests/run/${testId}`).then((r) => r.data),
};
