import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class OktaAdapter implements IntegrationAdapter {
  readonly provider = 'okta';
  private readonly logger = new Logger(OktaAdapter.name);

  private headers(token: string) {
    return { Authorization: `SSWS ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const domain = credentials['domain'] as string;
    const token  = credentials['apiToken'] as string;
    if (!domain || !token) return { connected: false, error: 'Missing domain or apiToken' };
    try {
      const res = await fetch(`https://${domain}/api/v1/org`, { headers: this.headers(token) });
      if (!res.ok) return { connected: false, error: `Okta API returned ${res.status}` };
      const org = await res.json() as any;
      return { connected: true, details: { orgName: org.name, subdomain: org.subdomain } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const domain = credentials['domain'] as string;
    const token  = credentials['apiToken'] as string;
    const evidence: IntegrationEvidence[] = [];

    try {
      const res = await fetch(`https://${domain}/api/v1/policies?type=MFA_ENROLL`, { headers: this.headers(token) });
      if (res.ok) {
        const policies = await res.json() as any[];
        const active = policies.filter((p: any) => p.status === 'ACTIVE');
        evidence.push({
          controlCode: 'CC6.1',
          title: 'Okta MFA Enrollment Policies',
          data: { totalPolicies: policies.length, activePolicies: active.length, policyNames: active.map((p: any) => p.name), collectedAt: new Date().toISOString() },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Okta MFA evidence: ${err.message}`); }

    try {
      const res = await fetch(`https://${domain}/api/v1/users?limit=200&filter=status%20eq%20%22ACTIVE%22`, { headers: this.headers(token) });
      if (res.ok) {
        const users = await res.json() as any[];
        evidence.push({
          controlCode: 'CC6.2',
          title: 'Okta Active User Roster',
          data: { activeUserCount: users.length, collectedAt: new Date().toISOString() },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Okta users evidence: ${err.message}`); }

    try {
      const res = await fetch(`https://${domain}/api/v1/policies?type=PASSWORD`, { headers: this.headers(token) });
      if (res.ok) {
        const policies = await res.json() as any[];
        const active = policies.filter((p: any) => p.status === 'ACTIVE');
        const settings = (active[0] as any)?.settings?.password ?? {};
        evidence.push({
          controlCode: 'CC6.3',
          title: 'Okta Password Policy Configuration',
          data: {
            activePolicies: active.length,
            minLength: settings?.complexity?.minLength ?? null,
            requireUppercase: settings?.complexity?.useUpperCase ?? null,
            requireNumbers: settings?.complexity?.useNumber ?? null,
            lockoutMaxAttempts: settings?.lockout?.maxAttempts ?? null,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Okta password policy evidence: ${err.message}`); }

    return evidence;
  }
}
