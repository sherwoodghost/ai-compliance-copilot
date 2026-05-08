import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditorSession {
  id:           string;
  orgId:        string;
  auditorName:  string;
  auditorFirm?: string;
  scope:        { packages?: string[]; controls?: string[] };
  expiresAt:    string;
  revokedAt?:   string | null;
  createdBy:    string;
  lastUsedAt?:  string | null;
  status:       'active' | 'expired' | 'revoked';
  createdAt:    string;
  token?:       string;  // returned on create
  [key: string]: unknown;
}

export interface CreateSessionDto {
  auditorName:  string;
  auditorFirm?: string;
  expiresInDays?: number;
  scope?: { packages?: string[]; controls?: string[] };
}

export interface AuditorRfi {
  id:          string;
  orgId:       string;
  sessionId:   string;
  question:    string;
  context?:    string;
  response?:   string | null;
  status:      'open' | 'answered' | 'closed';
  createdAt:   string;
  [key: string]: unknown;
}

export interface RfiAiResult {
  suggestedResponse:  string;
  confidence?:        string;
  confidenceLevel?:   string;
  sourcedFrom?:       string[];
  supportingEvidence?: string[];
  referencedControls?: string[];
  caveats?:           string[];
  [key: string]: unknown;
}

export interface AuditorBriefing {
  executiveSummary: string;
  controlAreas:     { category: string; status: string; notes: string }[];
  openFindings:     string[];
  nextSteps:        string[];
  generatedAt:      string;
  [key: string]: unknown;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const auditorPortalApi = {
  /** List all auditor access sessions */
  listSessions: (): Promise<AuditorSession[]> =>
    apiClient.get('/auditor-portal/sessions').then((r) => r.data),

  /** Create a new auditor session */
  createSession: (dto: CreateSessionDto): Promise<AuditorSession> =>
    apiClient.post('/auditor-portal/sessions', dto).then((r) => r.data),

  /** Revoke an auditor session */
  revokeSession: (sessionId: string): Promise<AuditorSession> =>
    apiClient.patch(`/auditor-portal/sessions/${sessionId}/revoke`).then((r) => r.data),

  /** List all RFIs (requests for information) */
  listRfis: (): Promise<AuditorRfi[]> =>
    apiClient.get('/auditor-portal/rfis').then((r) => r.data),

  /** Respond to an RFI */
  respondToRfi: (rfiId: string, response: string): Promise<AuditorRfi> =>
    apiClient.post(`/auditor-portal/rfis/${rfiId}/respond`, { response }).then((r) => r.data),

  /** AI-suggest a response to an RFI */
  aiSuggestRfiResponse: (rfiId: string): Promise<RfiAiResult> =>
    apiClient.post(`/auditor-portal/rfis/${rfiId}/ai-suggest-response`, {}).then((r) => r.data),

  /** Generate an AI auditor briefing document */
  aiGenerateBriefing: (): Promise<AuditorBriefing> =>
    apiClient.post('/auditor-portal/ai-briefing', {}).then((r) => r.data),
};
