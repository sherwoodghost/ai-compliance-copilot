import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export type IncidentStatus =
  | 'detected'
  | 'triaging'
  | 'contained'
  | 'eradicating'
  | 'recovering'
  | 'closed';

export type IncidentCategory =
  | 'data_breach'
  | 'ransomware'
  | 'phishing'
  | 'unauthorized_access'
  | 'availability'
  | 'other';

export interface TimelineEntry {
  at:      string;
  actorId: string;
  action:  string;
  note?:   string;
}

export interface CorrectiveAction {
  id:          string;
  title:       string;
  description?: string;
  assignedTo:  string;
  dueDate:     string;
  status:      'open' | 'in_progress' | 'pending_review' | 'closed';
  completedAt?: string | null;
}

export interface Incident {
  id:                 string;
  title:              string;
  description:        string;   // HTML
  severity:           IncidentSeverity;
  status:             IncidentStatus;
  category:           IncidentCategory;
  detectedAt:         string;
  containedAt?:       string | null;
  resolvedAt?:        string | null;
  closedAt?:          string | null;
  assignedTo?:        string | null;
  affectedSystems?:   string[];
  impactedUsers?:     number | null;
  dataClassification?: string | null;
  rootCause?:         string | null;    // HTML
  lessonsLearned?:    string | null;    // HTML
  evidenceId?:        string | null;
  timeline?:          TimelineEntry[];
  correctiveActions?: CorrectiveAction[];
  createdAt:          string;
  updatedAt:          string;
}

export interface IncidentMetrics {
  total:        number;
  open:         number;
  mttdMinutes:  number | null;
  mttrMinutes:  number | null;
  bySeverity:   { severity: IncidentSeverity; total: number; open: number }[];
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateIncidentDto {
  title:               string;
  description:         string;
  severity:            IncidentSeverity;
  category:            IncidentCategory;
  detectedAt?:         string;
  affectedSystems?:    string[];
  impactedUsers?:      number;
  dataClassification?: string;
  assignedTo?:         string;
}

export interface UpdateIncidentStatusDto {
  status: IncidentStatus;
  note?:  string;
}

export interface CloseIncidentDto {
  rootCause:      string;
  lessonsLearned: string;
}

export interface AddCorrectiveActionDto {
  title:       string;
  description: string;
  assignedTo:  string;
  dueDate:     string;
}

export interface ListIncidentsQuery {
  status?:   IncidentStatus;
  severity?: IncidentSeverity;
  category?: IncidentCategory;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const incidentsApi = {
  /** List incidents with optional filters */
  list(query?: ListIncidentsQuery): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (query?.status)   params.set('status',   query.status);
    if (query?.severity) params.set('severity', query.severity);
    if (query?.category) params.set('category', query.category);
    const qs = params.toString();
    return apiClient.get<Incident[]>(`/incidents${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },

  /** Get a single incident by ID */
  get(id: string): Promise<Incident> {
    return apiClient.get<Incident>(`/incidents/${id}`).then((r) => r.data);
  },

  /** Get aggregate metrics for the org */
  getMetrics(): Promise<IncidentMetrics> {
    return apiClient.get<IncidentMetrics>('/incidents/metrics').then((r) => r.data);
  },

  /** Create a new incident */
  create(dto: CreateIncidentDto): Promise<Incident> {
    return apiClient.post<Incident>('/incidents', dto).then((r) => r.data);
  },

  /** Advance or update incident status */
  updateStatus(id: string, dto: UpdateIncidentStatusDto): Promise<Incident> {
    return apiClient.post<Incident>(`/incidents/${id}/status`, dto).then((r) => r.data);
  },

  /** Close an incident (requires rootCause + lessonsLearned) */
  close(id: string, dto: CloseIncidentDto): Promise<Incident> {
    return apiClient.post<Incident>(`/incidents/${id}/close`, dto).then((r) => r.data);
  },

  /** Add a corrective action to an incident */
  addCorrectiveAction(incidentId: string, dto: AddCorrectiveActionDto): Promise<CorrectiveAction> {
    return apiClient
      .post<CorrectiveAction>(`/incidents/${incidentId}/corrective-actions`, dto)
      .then((r) => r.data);
  },

  /** Mark a corrective action as closed */
  closeCorrectiveAction(incidentId: string, actionId: string): Promise<CorrectiveAction> {
    return apiClient
      .post<CorrectiveAction>(`/incidents/${incidentId}/corrective-actions/${actionId}/close`, {})
      .then((r) => r.data);
  },
};
