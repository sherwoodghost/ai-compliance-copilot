import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScopeReviewResult {
  exclusionRisks:   { system: string; risk: string; recommendation: string }[];
  auditFaqs:        { question: string; suggestedAnswer: string }[];
  tscAdvisory:      { selectedTscs: string[]; missingRecommended: string[]; rationale: string };
  executiveSummary: string;
  generatedAt:      string;
}

export interface Soc2Scope {
  id:               string;
  system:           string;
  description:      string;
  status:           'pending' | 'approved' | 'rejected';
  approvedBy?:      string;
  approvedAt?:      string;
  [key: string]:    unknown;
}

export interface SoaEntry {
  id:             string;
  controlCode:    string;
  applicable:     boolean;
  justification?: string;
  implementationStatus?: string;
  [key: string]:  unknown;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const scopeApi = {
  /** AI review of current scope with gap analysis */
  aiScopeReview: (): Promise<ScopeReviewResult> =>
    apiClient.post('/scoping/ai-scope-review', {}).then((r) => r.data),

  /** Get current SOC 2 in-scope systems */
  getSoc2Scope: (): Promise<Soc2Scope[]> =>
    apiClient.get('/scoping/soc2/current').then((r) => r.data),

  /** Approve a SOC 2 in-scope system */
  approveSoc2Item: (id: string): Promise<Soc2Scope> =>
    apiClient.patch(`/scoping/soc2/${id}/approve`).then((r) => r.data),

  /** Get ISO 27001 Statement of Applicability */
  getIsoSoa: (): Promise<SoaEntry[]> =>
    apiClient.get('/scoping/iso/soa').then((r) => r.data),

  /** Generate/regenerate the ISO 27001 SoA */
  generateIsoSoa: (): Promise<SoaEntry[]> =>
    apiClient.post('/scoping/iso/soa/generate').then((r) => r.data),
};
