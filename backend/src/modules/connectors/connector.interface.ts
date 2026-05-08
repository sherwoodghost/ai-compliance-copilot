/**
 * Connector abstraction layer — makes third-party integrations composable and testable.
 * Each connector implements this interface.
 */

export interface ConnectorEvidence {
  controlId: string;
  title:     string;
  data:      Record<string, unknown>;
  passedAt:  Date | null;
  summary:   string;
}

export interface ImportableDocument {
  externalId: string;
  title:      string;
  mimeType:   string;
  /** Pre-signed or direct URL to download the file */
  downloadUrl: string;
}

export interface ComplianceConnector {
  readonly id:                 string;
  readonly name:               string;
  readonly logoUrl:            string;
  readonly supportedControls:  string[];

  connect(orgId: string, credentials: Record<string, string>): Promise<void>;
  disconnect(orgId: string): Promise<void>;
  testConnection(orgId: string): Promise<{ ok: boolean; error?: string }>;

  /** Pull evidence for a specific control */
  collectEvidence(orgId: string, controlId: string): Promise<ConnectorEvidence[]>;

  /** Optional: list documents available to import */
  importDocuments?(orgId: string): Promise<ImportableDocument[]>;
}
