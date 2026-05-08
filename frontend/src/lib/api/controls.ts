import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ControlStatus     = 'not_started' | 'in_progress' | 'implemented' | 'not_applicable';
export type ControlSeverity   = 'critical' | 'high' | 'medium' | 'low';
export type ControlFramework  = 'ISO27001' | 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI_DSS';

export interface ControlStats {
  total:          number;
  implemented:    number;
  inProgress:     number;
  notStarted:     number;
  notApplicable:  number;
  score:          number;  // 0–100
}

export interface Control {
  id:            string;
  code:          string;
  title:         string;
  description?:  string;
  status:        ControlStatus;
  severity?:     ControlSeverity;
  framework?:    ControlFramework;
  category?:     string;
  assignedTo?:   string | null;
  evidence?:     { id: string; title: string }[];
  tasks?:        { id: string; title: string; status: string }[];
  createdAt:     string;
  updatedAt:     string;
}

export interface ControlTest {
  id:         string;
  controlId:  string;
  result:     'PASS' | 'FAIL' | 'PARTIAL';
  method:     string;
  notes?:     string;
  sampledAt:  string;
}

export interface AiAnalyzeResult {
  summary:     string;
  riskLevel:   string;
  suggestions: string[];
  gaps:        { controlCode: string; description: string }[];
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface UpdateControlDto {
  status?:     ControlStatus;
  assignedTo?: string | null;
  notes?:      string;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const controlsApi = {
  /** List all controls for the org, optionally filtered by status */
  list(filters?: { status?: ControlStatus }): Promise<Control[]> {
    return apiClient
      .get<Control[]>('/controls', { params: filters })
      .then((r) => r.data);
  },

  /** Get aggregate control stats */
  getStats(): Promise<ControlStats> {
    return apiClient.get<ControlStats>('/controls/stats').then((r) => r.data);
  },

  /** Get a single control by ID */
  get(id: string): Promise<Control> {
    return apiClient.get<Control>(`/controls/${id}`).then((r) => r.data);
  },

  /** Update control status or assignment */
  update(id: string, dto: UpdateControlDto): Promise<Control> {
    return apiClient.patch<Control>(`/controls/${id}`, dto).then((r) => r.data);
  },

  /** Initialize controls from a framework template */
  initialize(framework: 'soc2' | 'iso27001' | 'gdpr'): Promise<{ created: number }> {
    return apiClient
      .post<{ created: number }>(`/controls/initialize/${framework}`, {})
      .then((r) => r.data);
  },

  /** Run AI control analysis across all controls */
  aiAnalyze(): Promise<AiAnalyzeResult> {
    return apiClient.post<AiAnalyzeResult>('/control-tests/ai-analyze', {}).then((r) => r.data);
  },

  /** List control effectiveness samples for a control */
  getEffectivenessSamples(controlId: string): Promise<ControlTest[]> {
    return apiClient
      .get<ControlTest[]>(`/controls/${controlId}/effectiveness-samples`)
      .then((r) => r.data);
  },

  /** Get the full control library (ISO + SOC2 reference controls) */
  getLibrary(): Promise<Control[]> {
    return apiClient.get<Control[]>('/controls/library').then((r) => r.data);
  },

  /** AI-explain a control from the library */
  aiExplainControl(controlCode: string): Promise<{ explanation: string; examples: string[]; generatedAt: string }> {
    return apiClient
      .post(`/controls/library/control/${controlCode}/ai-explain`, {})
      .then((r) => r.data);
  },
};
