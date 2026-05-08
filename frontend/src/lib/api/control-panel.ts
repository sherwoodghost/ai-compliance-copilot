import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowSummary {
  id:        string;
  name:      string;
  status:    string;
  startedAt: string;
  duration?: number;
  [key: string]: unknown;
}

export interface WorkflowEvent {
  id:        string;
  type:      string;
  agentName?: string;
  payload?:  Record<string, unknown>;
  createdAt: string;
  [key: string]: unknown;
}

export interface WorkflowCanvas {
  nodes: { id: string; type: string; label: string; status?: string }[];
  edges: { from: string; to: string }[];
  [key: string]: unknown;
}

export interface ControlPanelStats {
  totalWorkflows:    number;
  activeWorkflows:   number;
  completedToday:    number;
  failedToday:       number;
  [key: string]: unknown;
}

export interface AiDiagnoseResult {
  diagnosis:       string;
  recommendations: string[];
  severity:        'low' | 'medium' | 'high';
  [key: string]: unknown;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const controlPanelApi = {
  /** List all workflows */
  listWorkflows: (): Promise<WorkflowSummary[]> =>
    apiClient.get('/control-panel/workflows').then((r) => r.data),

  /** Get system stats */
  getStats: (): Promise<ControlPanelStats> =>
    apiClient.get('/control-panel/stats').then((r) => r.data),

  /** Get workflow event log */
  getWorkflowEvents: (workflowId: string): Promise<WorkflowEvent[]> =>
    apiClient.get(`/control-panel/workflows/${workflowId}/events`).then((r) => r.data),

  /** Get workflow visualization canvas */
  getWorkflowCanvas: (workflowId: string): Promise<WorkflowCanvas> =>
    apiClient.get(`/control-panel/workflows/${workflowId}/canvas`).then((r) => r.data),

  /** Replay from a specific agent in the workflow */
  replayFromAgent: (workflowId: string, agentName: string): Promise<WorkflowSummary> =>
    apiClient.post(`/orchestrator/workflows/${workflowId}/replay`, { agentName }).then((r) => r.data),

  /** AI diagnose a workflow */
  aiDiagnose: (workflowId: string): Promise<AiDiagnoseResult> =>
    apiClient.post(`/control-panel/workflows/${workflowId}/ai-diagnose`, {}).then((r) => r.data),
};
