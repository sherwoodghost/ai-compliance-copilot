import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id:            string;
  name:          string;
  assigneeRole?: string | null;
  assigneeId?:   string | null;
  type:          'approve' | 'review' | 'sign';
  slaHours:      number;
  parallel:      boolean;
}

export interface WorkflowDefinition {
  id:          string;
  orgId:       string;
  name:        string;
  entityType:  string;
  steps:       WorkflowStep[];
  isDefault:   boolean;
  createdAt:   string;
  updatedAt:   string;
}

export interface StepHistoryEntry {
  stepId:   string;
  actorId:  string;
  action:   'approved' | 'rejected' | 'reviewed' | 'signed';
  at:       string;
  note?:    string;
}

export interface WorkflowInstance {
  id:           string;
  orgId:        string;
  definitionId: string;
  entityType:   string;
  entityId:     string;
  currentStep:  number;
  status:       'active' | 'completed' | 'rejected' | 'cancelled';
  stepHistory:  StepHistoryEntry[];
  startedAt:    string;
  completedAt?: string | null;
  definition:   { id: string; name: string };
}

export interface CreateDefinitionDto {
  entityType: string;
  name:       string;
  steps:      WorkflowStep[];
  isDefault?: boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const approvalWorkflowApi = {
  // Definitions
  listDefinitions: (entityType?: string): Promise<WorkflowDefinition[]> =>
    apiClient
      .get('/approval-workflows/definitions', { params: entityType ? { entityType } : {} })
      .then((r) => r.data),

  createDefinition: (dto: CreateDefinitionDto): Promise<WorkflowDefinition> =>
    apiClient.post('/approval-workflows/definitions', dto).then((r) => r.data),

  // Instances
  startWorkflow: (
    entityType: string,
    entityId:   string,
    opts?: { definitionId?: string; defaultSteps?: WorkflowStep[] },
  ): Promise<{ instanceId: string }> =>
    apiClient
      .post('/approval-workflows/start', { entityType, entityId, ...opts })
      .then((r) => r.data),

  advanceStep: (
    instanceId: string,
    action:     'approved' | 'rejected' | 'reviewed' | 'signed',
    note?:      string,
  ): Promise<{ status: string; complete: boolean }> =>
    apiClient
      .post(`/approval-workflows/instances/${instanceId}/advance`, { action, note })
      .then((r) => r.data),

  cancelWorkflow: (instanceId: string, reason?: string): Promise<void> =>
    apiClient
      .post(`/approval-workflows/instances/${instanceId}/cancel`, { reason })
      .then((r) => r.data),

  getHistory: (entityType: string, entityId: string): Promise<WorkflowInstance[]> =>
    apiClient
      .get('/approval-workflows/history', { params: { entityType, entityId } })
      .then((r) => r.data),
};
