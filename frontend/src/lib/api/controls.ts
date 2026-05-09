import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ControlStatus     = 'not_started' | 'in_progress' | 'implemented' | 'not_applicable';
export type ControlSeverity   = 'critical' | 'high' | 'medium' | 'low';
export type ControlFramework  = 'ISO27001' | 'SOC2' | 'GDPR' | 'HIPAA' | 'PCI_DSS' | 'FEDRAMP' | 'NIST_CSF' | 'ISO9001' | 'ISO14001' | 'ISO45001';

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

// ─── Exception Types ──────────────────────────────────────────────────────────

export type ExceptionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ControlException {
  id:                 string;
  orgId:              string;
  controlId:          string;
  controlCode?:       string;
  controlTitle?:      string;
  title:              string;
  justification:      string;
  riskLevel:          string;
  mitigatingControls?: string;
  reviewDate?:        string | null;
  status:             ExceptionStatus;
  approvedBy?:        string | null;
  rejectedBy?:        string | null;
  rejectionReason?:   string | null;
  createdBy:          string;
  createdAt:          string;
  updatedAt:          string;
}

export interface ExceptionStats {
  total:    number;
  pending:  number;
  approved: number;
  expired:  number;
}

export interface CreateExceptionDto {
  controlId:           string;
  title:               string;
  justification:       string;
  riskLevel:           string;
  mitigatingControls?: string;
  reviewDate?:         string;
}

export interface UpdateExceptionDto {
  status?:          ExceptionStatus;
  rejectionReason?: string;
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

  /** Get AI implementation guide for a specific control */
  aiImplementationGuide(controlId: string): Promise<{ guide: string; steps: string[]; tools: string[]; generatedAt: string }> {
    return apiClient
      .post(`/controls/${controlId}/implementation-guide`, {})
      .then((r) => r.data);
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

  // ── Control Exceptions ─────────────────────────────────────────────────────

  /** List all control exceptions for the org */
  listExceptions(): Promise<ControlException[]> {
    return apiClient.get<ControlException[]>('/controls/exceptions').then((r) => r.data);
  },

  /** Get exception statistics */
  getExceptionStats(): Promise<ExceptionStats> {
    return apiClient.get<ExceptionStats>('/controls/exceptions/stats').then((r) => r.data);
  },

  /** Create a new control exception */
  createException(dto: CreateExceptionDto): Promise<ControlException> {
    return apiClient.post<ControlException>('/controls/exceptions', dto).then((r) => r.data);
  },

  /** Update exception status (approve/reject) */
  updateException(id: string, dto: UpdateExceptionDto): Promise<ControlException> {
    return apiClient.patch<ControlException>(`/controls/exceptions/${id}`, dto).then((r) => r.data);
  },

  /** AI-draft justification for a control exception */
  aiDraftException(controlId: string): Promise<{
    justification:       string;
    riskLevel:           string;
    suggestedReviewDate: string;
    title?:              string;
    compensatingControl?: string;
    suggestedExpiryMonths?: number;
    [key: string]: unknown;
  }> {
    return apiClient.post('/controls/exceptions/ai-draft', { controlId }).then((r) => r.data);
  },
};
