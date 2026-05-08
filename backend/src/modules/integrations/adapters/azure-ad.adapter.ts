import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class AzureAdAdapter implements IntegrationAdapter {
  readonly provider = 'azure';
  private readonly logger = new Logger(AzureAdAdapter.name);

  private hdr(token: string) {
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  private async getToken(tenantId: string, clientId: string, clientSecret: string): Promise<string | null> {
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      });
      const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
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
    const tenantId = credentials['tenantId'] as string;
    const clientId = credentials['clientId'] as string;
    const clientSecret = credentials['clientSecret'] as string;
    if (!tenantId || !clientId || !clientSecret) return { connected: false, error: 'Missing tenantId, clientId or clientSecret' };
    const token = await this.getToken(tenantId, clientId, clientSecret);
    if (!token) return { connected: false, error: 'Authentication failed' };
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/organization', { headers: this.hdr(token) });
      if (!res.ok) return { connected: false, error: `Graph API returned ${res.status}` };
      const data = await res.json() as any;
      const org = (data.value ?? [])[0];
      return { connected: true, details: { orgName: org?.displayName } };
    } catch (err: any) { return { connected: false, error: err.message }; }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const tenantId = credentials['tenantId'] as string;
    const clientId = credentials['clientId'] as string;
    const clientSecret = credentials['clientSecret'] as string;
    const evidence: IntegrationEvidence[] = [];

    const token = await this.getToken(tenantId, clientId, clientSecret);
    if (!token) { this.logger.warn('Azure AD auth failed'); return evidence; }

    // CC6.1: Conditional Access Policies
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies', { headers: this.hdr(token) });
      if (res.ok) {
        const data = await res.json() as any;
        const policies = data.value ?? [];
        const enabled = policies.filter((p: any) => p.state === 'enabled');
        evidence.push({
          controlCode: 'CC6.1',
          title: 'Azure AD Conditional Access Policies',
          data: { totalPolicies: policies.length, enabledPolicies: enabled.length, policyNames: enabled.map((p: any) => p.displayName), collectedAt: new Date().toISOString() },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Azure CA: ${err.message}`); }

    // CC6.2: Active user count
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/users?$filter=accountEnabled eq true&$count=true&$top=1', {
        headers: { ...this.hdr(token), ConsistencyLevel: 'eventual' },
      });
      if (res.ok) {
        const data = await res.json() as any;
        evidence.push({
          controlCode: 'CC6.2',
          title: 'Azure AD Active User Count',
          data: { activeUserCount: data['@odata.count'] ?? (data.value ?? []).length, collectedAt: new Date().toISOString() },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Azure users: ${err.message}`); }

    // CC6.3: Global admin count
    try {
      const rolesRes = await fetch('https://graph.microsoft.com/v1.0/directoryRoles?$filter=displayName eq \'Global Administrator\'', {
        headers: this.hdr(token),
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json() as any;
        const role = (rolesData.value ?? [])[0];
        if (role) {
          const membersRes = await fetch(`https://graph.microsoft.com/v1.0/directoryRoles/${role.id}/members`, { headers: this.hdr(token) });
          if (membersRes.ok) {
            const membersData = await membersRes.json() as any;
            evidence.push({
              controlCode: 'CC6.3',
              title: 'Azure AD Global Administrator Count',
              data: { globalAdminCount: (membersData.value ?? []).length, collectedAt: new Date().toISOString() },
              collectedAt: new Date(),
            });
          }
        }
      }
    } catch (err: any) { this.logger.warn(`Azure admins: ${err.message}`); }

    return evidence;
  }
}
