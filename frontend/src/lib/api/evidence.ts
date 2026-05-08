import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EvidenceType   = 'screenshot' | 'document' | 'log' | 'config' | 'report' | 'other';
export type EvidenceSource = 'manual_upload' | 'integration_pull' | 'agent_generated';

export interface EvidenceControl {
  id:         string;
  code:       string;
  title:      string;
  confidence?: number;
  mappedBy?:  string;
}

export interface Evidence {
  id:           string;
  title:        string;
  description?: string;
  type?:        EvidenceType;
  evidenceType?: EvidenceType;
  source?:      EvidenceSource;
  status?:      string;
  isValid?:     boolean;
  collectedAt?: string;
  createdAt:    string;
  expiresAt?:   string | null;
  fileUrl?:     string;
  storageUrl?:  string;
  controlId?:   string;
  control?:     EvidenceControl | null;
  controls?:    EvidenceControl[];
  reviewedBy?:  string | null;
  metadata?:    Record<string, unknown>;
  orgId:        string;
}

export interface MappingSuggestion {
  controlId:   string;
  controlCode: string;
  confidence:  number;
  reason:      string;
}

export interface BulkMapControl {
  controlId:   string;
  controlCode: string;
  title:       string;
  confidence:  number;
  reason:      string;
}

export interface BulkMapSuggestion {
  evidenceId:         string;
  evidenceTitle:      string;
  evidenceType?:      string;
  storageUrl?:        string;
  suggestedControls:  BulkMapControl[];
  additionalControls: BulkMapControl[];
}

export interface BulkMapResult {
  processed:   number;
  suggestions: BulkMapSuggestion[];
}

export interface ExpiryReport {
  critical:  Evidence[];  // expires ≤7 days
  warning:   Evidence[];  // expires 8–30 days
  ok:        Evidence[];  // expires >30 days
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateEvidenceDto {
  title:        string;
  description?: string;
  controlId:    string;
  type?:        string;
  source?:      string;
  storageUrl?:  string;
  expiresAt?:   string;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const evidenceApi = {
  /** List all evidence for the org */
  list(): Promise<Evidence[]> {
    return apiClient.get<Evidence[]>('/evidence').then((r) => r.data);
  },

  /** Get expiry report grouped by urgency */
  getExpiryReport(): Promise<ExpiryReport> {
    return apiClient.get<ExpiryReport>('/evidence/expiry-report').then((r) => r.data);
  },

  /** Upload a file as evidence (multipart/form-data) */
  upload(formData: FormData): Promise<Evidence> {
    return apiClient
      .post<Evidence>('/evidence/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /** Create an evidence record without file upload */
  create(dto: CreateEvidenceDto): Promise<Evidence> {
    return apiClient.post<Evidence>('/evidence', dto).then((r) => r.data);
  },

  /** Revalidate evidence (mark as re-checked) */
  revalidate(id: string): Promise<Evidence> {
    return apiClient.post<Evidence>(`/evidence/${id}/revalidate`, {}).then((r) => r.data);
  },

  /** Get AI control mapping suggestions for an evidence record */
  getMappingSuggestions(id: string): Promise<{ suggestions: MappingSuggestion[] }> {
    return apiClient
      .get<{ suggestions: MappingSuggestion[] }>(`/evidence/${id}/mapping-suggestions`)
      .then((r) => r.data);
  },

  /** Run AI bulk mapping across all unmapped evidence */
  aiBulkMap(): Promise<BulkMapResult> {
    return apiClient.post<BulkMapResult>('/evidence/ai-bulk-map').then((r) => r.data);
  },

  /** Delete an evidence record */
  delete(id: string): Promise<void> {
    return apiClient.delete(`/evidence/${id}`).then(() => undefined);
  },
};
