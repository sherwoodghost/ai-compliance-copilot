import { apiClient } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DocType           = 'policy' | 'procedure' | 'template' | 'evidence_note' | 'report';
export type DocStatus         = 'draft' | 'review' | 'approved' | 'archived';
export type DocClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export interface Document {
  id:             string;
  orgId:          string;
  title:          string;
  docType:        DocType;
  content:        Record<string, unknown>;  // TipTap JSON
  contentHtml:    string;
  contentText:    string | null;
  wordCount:      number;
  status:         DocStatus;
  classification: DocClassification;
  version:        number;
  controlIds:     string[];
  frameworkIds:   string[];
  tags:           string[];
  ownerId:        string | null;
  reviewDue:      string | null;
  approvedBy:     string | null;
  approvedAt:     string | null;
  lockedAt:       string | null;
  lockedBy:       string | null;
  lockedReason:   string | null;
  legalHoldAt:    string | null;
  legalHoldBy:    string | null;
  legalHoldReason: string | null;
  metadata:       Record<string, unknown>;
  createdAt:      string;
  updatedAt:      string;
}

export interface DocumentVersion {
  id:          string;
  documentId:  string;
  version:     number;
  contentHtml: string;
  createdBy:   string | null;
  note:        string | null;
  createdAt:   string;
}

export interface ListDocumentsFilters {
  docType?:       DocType;
  status?:        DocStatus;
  classification?: DocClassification;
  search?:        string;
  ownerId?:       string;
  page?:          number;
  limit?:         number;
}

export interface CreateDocumentDto {
  title:          string;
  docType?:       DocType;
  content?:       Record<string, unknown>;
  contentHtml?:   string;
  classification?: DocClassification;
  controlIds?:    string[];
  frameworkIds?:  string[];
  tags?:          string[];
  ownerId?:       string;
  reviewDue?:     string;
}

export interface UpdateDocumentDto {
  title?:         string;
  content?:       Record<string, unknown>;
  contentHtml?:   string;
  classification?: DocClassification;
  controlIds?:    string[];
  frameworkIds?:  string[];
  tags?:          string[];
  ownerId?:       string;
  reviewDue?:     string;
}

export interface GapResult {
  section:   string;
  framework: string;
  severity:  'critical' | 'major' | 'minor';
  detail:    string;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const documentsApi = {
  // List documents with optional filters
  async list(filters?: ListDocumentsFilters): Promise<Document[]> {
    const { data } = await apiClient.get('/documents', { params: filters });
    return data;
  },

  // Get a single document
  async get(id: string): Promise<Document> {
    const { data } = await apiClient.get(`/documents/${id}`);
    return data;
  },

  // Create a new document
  async create(dto: CreateDocumentDto): Promise<Document> {
    const { data } = await apiClient.post('/documents', dto);
    return data;
  },

  // Update a document (409 if locked)
  async update(id: string, dto: UpdateDocumentDto): Promise<Document> {
    const { data } = await apiClient.patch(`/documents/${id}`, dto);
    return data;
  },

  // Request approval — locks the document
  async requestApproval(id: string): Promise<Document> {
    const { data } = await apiClient.post(`/documents/${id}/request-approval`);
    return data;
  },

  // Approve a document (SoD enforced — approver ≠ owner)
  async approve(id: string): Promise<Document> {
    const { data } = await apiClient.post(`/documents/${id}/approve`);
    return data;
  },

  // Reject a document with reason
  async reject(id: string, reason: string): Promise<Document> {
    const { data } = await apiClient.post(`/documents/${id}/reject`, { reason });
    return data;
  },

  // Archive a document
  async archive(id: string): Promise<Document> {
    const { data } = await apiClient.post(`/documents/${id}/archive`);
    return data;
  },

  // Create a new version snapshot
  async newVersion(id: string, note?: string): Promise<Document> {
    const { data } = await apiClient.post(`/documents/${id}/new-version`, { note });
    return data;
  },

  // Get version history
  async getVersions(id: string): Promise<DocumentVersion[]> {
    const { data } = await apiClient.get(`/documents/${id}/versions`);
    return data;
  },

  // Restore to a specific version
  async restoreVersion(id: string, version: number): Promise<Document> {
    const { data } = await apiClient.post(`/documents/${id}/restore/${version}`);
    return data;
  },

  // AI: improve selected text
  async aiImprove(
    id: string,
    selectedHtml: string,
    instruction?: string,
  ): Promise<{ improved: string }> {
    const { data } = await apiClient.post(`/documents/${id}/ai-improve`, {
      selectedHtml,
      instruction,
    });
    return data;
  },

  // AI: detect missing ISO/SOC2 sections
  async aiGaps(id: string): Promise<{ gaps: GapResult[] }> {
    const { data } = await apiClient.post(`/documents/${id}/ai-gaps`);
    return data;
  },

  // Import PDF via AI (multipart)
  async importPdf(file: File): Promise<{ title: string; content: string }> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post('/documents/import/pdf', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  // Legal hold
  async setLegalHold(id: string, reason: string): Promise<Document> {
    const { data } = await apiClient.post(`/documents/${id}/legal-hold`, { reason });
    return data;
  },

  async releaseLegalHold(id: string): Promise<Document> {
    const { data } = await apiClient.delete(`/documents/${id}/legal-hold`);
    return data;
  },
};
