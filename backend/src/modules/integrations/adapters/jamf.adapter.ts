import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class JamfAdapter implements IntegrationAdapter {
  readonly provider = 'jamf';
  private readonly logger = new Logger(JamfAdapter.name);

  private async getToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string | null> {
    try {
      const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
      const res = await fetch(`${baseUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) return null;
      const data = await res.json() as any;
      return data.access_token ?? null;
    } catch { return null; }
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const baseUrl = credentials['baseUrl'] as string;
    const clientId = credentials['clientId'] as string;
    const clientSecret = credentials['clientSecret'] as string;
    if (!baseUrl || !clientId || !clientSecret) return { connected: false, error: 'Missing baseUrl, clientId or clientSecret' };
    const token = await this.getToken(baseUrl, clientId, clientSecret);
    if (!token) return { connected: false, error: 'Authentication failed' };
    return { connected: true, details: { authenticated: true } };
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const baseUrl = credentials['baseUrl'] as string;
    const clientId = credentials['clientId'] as string;
    const clientSecret = credentials['clientSecret'] as string;
    const evidence: IntegrationEvidence[] = [];

    const token = await this.getToken(baseUrl, clientId, clientSecret);
    if (!token) { this.logger.warn('Jamf auth failed'); return evidence; }
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    try {
      const res = await fetch(`${baseUrl}/api/v1/computers-preview?page-size=1`, { headers });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'A.8.1',
          title: 'Jamf Managed Device Inventory',
          data: { totalManagedComputers: data.totalCount ?? 0, collectedAt: new Date().toISOString() },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Jamf device inventory: ${err.message}`); }

    try {
      const res = await fetch(`${baseUrl}/api/v1/device-enrollments`, { headers });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'A.8.7',
          title: 'Jamf Device Enrollment Coverage',
          data: { enrollmentProfiles: (data.results ?? []).length, collectedAt: new Date().toISOString() },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Jamf enrollment: ${err.message}`); }

    return evidence;
  }
}
