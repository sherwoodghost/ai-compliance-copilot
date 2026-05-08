import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PolicyStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface PolicyVersion {
  id:        string;
  version:   number;
  content:   string;
  createdAt: string;
  createdBy?: string | null;
}

export interface Policy {
  id:           string;
  title:        string;
  description?: string;
  content:      string;   // HTML
  status:       PolicyStatus;
  version:      number;
  authorId?:    string | null;
  /** May be a user ID string or a partial User object with fullName */
  approvedBy?:  string | { fullName?: string } | null;
  approvedAt?:  string | null;
  generatedBy?: string | null;
  versions?:    PolicyVersion[];
  controls?:    { id: string; code: string; title: string }[];
  /** Optional framework tag returned by some backend responses */
  framework?:   string;
  /** Number of linked controls (derived field) */
  controlCount?: number;
  createdAt:    string;
  updatedAt:    string;
}

export interface PolicyGap {
  policyType:   string;
  priority:     'critical' | 'high' | 'medium';
  framework:    string;
  requirement:  string;
  covered:      boolean;
}

export interface CoverageResult {
  totalPolicies:   number;
  frameworks:      string;
  coverageScore:   number;
  gaps:            PolicyGap[];
  recommendations: string[];
  generatedAt:     string;
}

export interface AiDraftResult {
  content: string;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface UpdatePolicyDto {
  content?: string;
  title?: string;
  status?: PolicyStatus;
}

export interface NewVersionDto {
  content?: string;
  note?: string;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const policiesApi = {
  /** List all policies for the org */
  list(): Promise<Policy[]> {
    return apiClient.get<Policy[]>('/policies').then((r) => r.data);
  },

  /** Get a single policy by ID */
  get(id: string): Promise<Policy> {
    return apiClient.get<Policy>(`/policies/${id}`).then((r) => r.data);
  },

  /** Update policy content or metadata */
  update(id: string, dto: UpdatePolicyDto): Promise<Policy> {
    return apiClient.patch<Policy>(`/policies/${id}`, dto).then((r) => r.data);
  },

  /** Create a new version snapshot */
  newVersion(id: string, dto?: NewVersionDto): Promise<Policy> {
    return apiClient.post<Policy>(`/policies/${id}/new-version`, dto ?? {}).then((r) => r.data);
  },

  /** Approve a policy (SoD: approver ≠ author) */
  approve(id: string): Promise<Policy> {
    return apiClient.post<Policy>(`/policies/${id}/approve`, {}).then((r) => r.data);
  },

  /** AI-draft / regenerate policy content */
  aiDraft(id: string): Promise<AiDraftResult> {
    return apiClient.post<AiDraftResult>(`/policies/${id}/ai-draft`, {}).then((r) => r.data);
  },

  /** Archive a policy */
  archive(id: string): Promise<Policy> {
    return apiClient.patch<Policy>(`/policies/${id}/archive`, {}).then((r) => r.data);
  },

  /** AI coverage check — which controls does the current policy library cover? */
  aiCoverageCheck(): Promise<CoverageResult> {
    return apiClient.post<CoverageResult>('/policies/ai-coverage-check').then((r) => r.data);
  },
};
