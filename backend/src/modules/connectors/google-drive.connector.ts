import { Injectable, Logger } from '@nestjs/common';
import { ComplianceConnector, ConnectorEvidence, ImportableDocument } from './connector.interface';

/**
 * GoogleDriveConnector — Stub (P19 E12)
 *
 * Provides document import from Google Drive: lists Drive files accessible
 * to the service account / OAuth token and converts DOCX/Docs to ImportableDocument
 * for the user to select in the Documents editor.
 *
 * Full implementation planned for P21.
 * Currently returns `{ ok: false }` from testConnection() and empty arrays
 * so the connector shows as "available but not connected" in the UI.
 *
 * To implement fully:
 *   1. Create a Google Cloud project and enable Drive API v3
 *   2. Set up OAuth 2.0 credentials (client ID + secret) or a Service Account
 *   3. Store credentials in ConnectorCredential (encrypted) via ConnectorsController
 *   4. Replace stub methods below with real Drive API calls using googleapis npm package
 *
 * Required env vars (when implemented):
 *   GOOGLE_DRIVE_CLIENT_ID=...
 *   GOOGLE_DRIVE_CLIENT_SECRET=...
 *   GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3001/api/v1/connectors/google-drive/oauth/callback
 */
@Injectable()
export class GoogleDriveConnector implements ComplianceConnector {
  private readonly logger = new Logger(GoogleDriveConnector.name);

  readonly id   = 'google-drive';
  readonly name = 'Google Drive';
  readonly logoUrl = 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png';
  readonly supportedControls: string[] = [];   // Drive is an import source, not a control evidence provider

  async connect(orgId: string, credentials: Record<string, string>): Promise<void> {
    // TODO P21: validate credentials, exchange OAuth code for tokens, store encrypted
    this.logger.log('GoogleDrive connect called for org ' + orgId + ' (stub — not implemented)');
    throw new Error('Google Drive connector not yet implemented. Coming in P21.');
  }

  async disconnect(orgId: string): Promise<void> {
    // TODO P21: revoke OAuth token, delete ConnectorCredential
    this.logger.log('GoogleDrive disconnect called for org ' + orgId + ' (stub)');
  }

  async testConnection(orgId: string): Promise<{ ok: boolean; error?: string }> {
    // Always returns not-configured until P21 implementation
    return { ok: false, error: 'Google Drive connector not yet implemented. Coming in P21.' };
  }

  async collectEvidence(_orgId: string, _controlId: string): Promise<ConnectorEvidence[]> {
    // Drive is a document source; it does not collect control evidence
    return [];
  }

  /**
   * importDocuments — Lists Google Drive files accessible to the connected account.
   * Returns DOCX and Google Docs files as ImportableDocument[] for the editor to consume.
   * TODO P21: implement with googleapis Drive API v3
   */
  async importDocuments(_orgId: string): Promise<ImportableDocument[]> {
    return [];
  }
}
