import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class GoogleWorkspaceAdapter implements IntegrationAdapter {
  readonly provider = 'google_workspace';
  private readonly logger = new Logger(GoogleWorkspaceAdapter.name);

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const accessToken = credentials['accessToken'] as string;
    if (!accessToken) return { connected: false, error: 'Missing accessToken' };
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { connected: false, error: `Google API returned ${res.status}` };
      const info = await res.json() as any;
      return { connected: true, details: { email: info.email, scope: info.scope } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const accessToken = credentials['accessToken'] as string;
    const domain      = credentials['domain'] as string;
    const evidence: IntegrationEvidence[] = [];

    // CC6.2: User access management — active users
    try {
      const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?domain=${domain}&maxResults=200&query=isSuspended=false`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'CC6.2',
          title: 'Google Workspace Active User Roster',
          data: {
            activeUserCount: (data.users ?? []).length,
            domain,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Google Workspace users evidence: ${err.message}`); }

    // CC6.1: 2-Step verification enrollment
    try {
      const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?domain=${domain}&maxResults=200&query=isEnrolledIn2Sv=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'CC6.1',
          title: 'Google Workspace 2-Step Verification Enrollment',
          data: {
            usersWithMfa: (data.users ?? []).length,
            domain,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Google Workspace MFA evidence: ${err.message}`); }

    // A.9.4: Admin console security settings
    try {
      const res = await fetch('https://www.googleapis.com/admin/reports/v1/activity/users/all/applications/admin?maxResults=25&eventName=CHANGE_APPLICATION_SETTING', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'A.9.4',
          title: 'Google Workspace Admin Security Activity',
          data: {
            recentSecurityChanges: (data.items ?? []).length,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Google Workspace admin activity evidence: ${err.message}`); }

    return evidence;
  }
}
