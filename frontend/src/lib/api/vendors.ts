/**
 * Vendors API — typed client for vendor risk management endpoints.
 */

import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Vendor {
  id:              string;
  vendorName:      string;
  category?:       string;
  riskLevel:       'critical' | 'high' | 'medium' | 'low';
  status?:         'approved' | 'flagged' | 'pending';
  findings?:       string[];
  mitigations?:    string[];
  lastReviewedAt?: string;
  contactEmail?:   string;
  website?:        string;
  notes?:          string;
  summary?:        string;
}

export interface VsqQuestion {
  id?:       string;
  category:  string;
  question:  string;
  answer?:   string;
  required?: boolean;
  notes?:    string | null;
}

export interface VsqResult {
  vendorId:     string;
  vendorName:   string;
  riskLevel:    string;
  frameworks:   string;
  questions:    VsqQuestion[];
  generatedAt:  string;
}

export interface VendorAnalysis {
  riskLevel:    string;
  findings:     string[];
  mitigations:  string[];
  summary:      string;
  analyzedAt:   string;
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const vendorsApi = {
  list(): Promise<Vendor[]> {
    return apiClient.get('/vendor-risk').then((r) => r.data);
  },

  create(data: Partial<Vendor>): Promise<Vendor> {
    return apiClient.post('/vendor-risk', data).then((r) => r.data);
  },

  update(id: string, data: Partial<Vendor>): Promise<Vendor> {
    return apiClient.patch(`/vendor-risk/${id}`, data).then((r) => r.data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/vendor-risk/${id}`).then(() => undefined);
  },

  analyze(id: string): Promise<VendorAnalysis> {
    return apiClient.post(`/vendor-risk/${id}/analyze`, {}).then((r) => r.data);
  },

  aiQuestionnaire(id: string): Promise<VsqResult> {
    return apiClient.post(`/vendor-risk/${id}/ai-questionnaire`).then((r) => r.data);
  },
};
