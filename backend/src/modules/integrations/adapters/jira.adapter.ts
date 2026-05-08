import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class JiraAdapter implements IntegrationAdapter {
  readonly provider = 'jira';
  private readonly logger = new Logger(JiraAdapter.name);

  private authHeader(email: string, token: string) {
    const encoded = Buffer.from(`${email}:${token}`).toString('base64');
    return { Authorization: `Basic ${encoded}`, Accept: 'application/json' };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const baseUrl = credentials['baseUrl'] as string;
    const email   = credentials['email'] as string;
    const token   = credentials['apiToken'] as string;
    if (!baseUrl || !email || !token) return { connected: false, error: 'Missing baseUrl, email or apiToken' };
    try {
      const res = await fetch(`${baseUrl}/rest/api/3/myself`, { headers: this.authHeader(email, token) });
      if (!res.ok) return { connected: false, error: `Jira API returned ${res.status}` };
      const user = await res.json() as any;
      return { connected: true, details: { displayName: user.displayName, accountId: user.accountId } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const baseUrl = credentials['baseUrl'] as string;
    const email   = credentials['email'] as string;
    const token   = credentials['apiToken'] as string;
    const evidence: IntegrationEvidence[] = [];

    // CC7.3: Change management — open change tickets
    try {
      const jql = encodeURIComponent('issuetype = "Change Request" AND status != Done ORDER BY created DESC');
      const res = await fetch(`${baseUrl}/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary,status,priority,created`, {
        headers: this.authHeader(email, token),
      });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'CC7.3',
          title: 'Jira Change Request Tracking',
          data: {
            totalChangeRequests: data.total ?? 0,
            openRequests: (data.issues ?? []).filter((i: any) => i.fields?.status?.name !== 'Done').length,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Jira change mgmt evidence: ${err.message}`); }

    // CC7.1: Bug/vulnerability tracking
    try {
      const jql = encodeURIComponent('issuetype = Bug AND priority in (Critical, High) AND status != Done ORDER BY created DESC');
      const res = await fetch(`${baseUrl}/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary,status,priority`, {
        headers: this.authHeader(email, token),
      });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'CC7.1',
          title: 'Jira High/Critical Bug Tracking',
          data: {
            totalHighCriticalBugs: data.total ?? 0,
            openHighCriticalBugs: (data.issues ?? []).length,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Jira bug tracking evidence: ${err.message}`); }

    return evidence;
  }
}
