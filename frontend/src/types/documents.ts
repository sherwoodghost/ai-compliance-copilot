export interface Document {
  id: string;
  orgId: string;
  title: string;
  docType: 'policy' | 'procedure' | 'evidence' | 'report' | 'template' | 'other';
  content: Record<string, any>;
  contentHtml: string;
  contentText: string | null;
  controlIds: string[];
  detectedFrameworks: string[];
  activeForOrg: boolean;
  sourceStorageKey: string | null;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  docType: string;
  controlIds: string[];
  detectedFrameworks: string[];
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  sourceStorageKey: string | null;
  snippet?: string;
}

export interface DocumentVersion {
  id: string;
  version: number;
  editedBy: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface DocumentStats {
  total: number;
  recentlyAdded: number;
  byType: Record<string, number>;
  byFramework: Record<string, number>;
}

export interface PaginatedDocuments {
  documents: DocumentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
