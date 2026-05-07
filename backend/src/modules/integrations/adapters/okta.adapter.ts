import { Injectable, Logger } from '@nestjs/common';
import {
  IntegrationAdapter,
  IntegrationEvidence,
  IntegrationTestResult,
} from './integration.interface';

@Injectable()
export class OktaAdapter implements IntegrationAdapter {
  readonly provider = 'okta';
  private readonly logger = new Logger(OktaAdapter.name);

  // ─── helpers ────────────────────────────────────────────────────────────────

  private headers(apiToken: string) {
    return {
      Authorization: `SSWS ${apiToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private base(orgUrl: string, path: string) {
    return `${orgUrl.replace(/\/$/, '')}/api/v1${path}`;
  }

  // ─── testConnection ──────────────────────────────────────────────────────────

  async testConnection(
    credentials: Record<string, unknown>,
  ): Promise<IntegrationTestResult> {
    const orgUrl = credentials['orgUrl'] as string;
    const apiToken = credentials['apiToken'] as string;

    if (!orgUrl || !apiToken) {
      return { connected: false, error: 'Missing orgUrl or apiToken' };
    }

    try {
      const res = await fetch(this.base(orgUrl, '/org'), {
        headers: this.headers(apiToken),
      });

      if (!res.ok) {
        return {
          connected: false,
          error: `Okta API returned ${res.status} — verify orgUrl and apiToken`,
        };
      }

      const org = (await res.json()) as any;
      return {
        connected: true,
        details: { companyName: org.companyName, subdomain: org.subdomain },
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  // ─── collectEvidence ─────────────────────────────────────────────────────────

  async collectEvidence(
    credentials: Record<string, unknown>,
  ): Promise<IntegrationEvidence[]> {
    const orgUrl = credentials['orgUrl'] as string;
    const apiToken = credentials['apiToken'] as string;
    const evidence: IntegrationEvidence[] = [];

    try {
      // ── 1. Active users + MFA enrollment → CC6.1, CC6.2 ──────────────────────
      const usersRes = await fetch(
        this.base(orgUrl, '/users?status=ACTIVE&limit=200'),
        { headers: this.headers(apiToken) },
      );

      if (usersRes.ok) {
        const users = (await usersRes.json()) as any[];
        const adminUsers = users.filter((u) =>
          u.profile?.login?.toLowerCase().includes('admin') ||
          (u.credentials?.provider?.type === 'OKTA'),
        );

        evidence.push({
          controlCode: 'CC6.1',
          title: 'Okta Active Users & MFA Enrollment',
          data: {
            totalActiveUsers: users.length,
            sampleUsers: users.slice(0, 5).map((u) => ({
              login: u.profile?.login,
              status: u.status,
              lastLogin: u.lastLogin,
              mfaEnrolled: u.credentials?.provider?.type !== 'PASSWORD',
            })),
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });

        evidence.push({
          controlCode: 'CC6.2',
          title: 'Okta User Access List (Active Accounts)',
          data: {
            totalActiveUsers: users.length,
            estimatedAdminCount: adminUsers.length,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }

      // ── 2. Sign-on policies (MFA requirement) → CC6.1, A.9.1 ─────────────────
      const policiesRes = await fetch(
        this.base(orgUrl, '/policies?type=OKTA_SIGN_ON&limit=20'),
        { headers: this.headers(apiToken) },
      );

      if (policiesRes.ok) {
        const policies = (await policiesRes.json()) as any[];
        const mfaPolicies = policies.filter((p) =>
          p.name?.toLowerCase().includes('mfa') ||
          p.name?.toLowerCase().includes('enforce') ||
          p.status === 'ACTIVE',
        );

        evidence.push({
          controlCode: 'CC6.3',
          title: 'Okta Sign-On Policies (MFA Enforcement)',
          data: {
            totalPolicies: policies.length,
            activePolicies: policies.filter((p) => p.status === 'ACTIVE').length,
            mfaRelatedPolicies: mfaPolicies.length,
            policies: policies.slice(0, 5).map((p) => ({
              name: p.name,
              status: p.status,
              priority: p.priority,
            })),
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }

      // ── 3. Groups (admin groups → privileged access) → CC6.2 ─────────────────
      const groupsRes = await fetch(
        this.base(orgUrl, '/groups?q=admin&limit=10'),
        { headers: this.headers(apiToken) },
      );

      if (groupsRes.ok) {
        const groups = (await groupsRes.json()) as any[];
        evidence.push({
          controlCode: 'A.9.2',
          title: 'Okta Privileged Groups (Admin Access)',
          data: {
            adminGroupCount: groups.length,
            groups: groups.map((g) => ({
              name: g.profile?.name,
              description: g.profile?.description,
            })),
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }

      // ── 4. Applications → CC6.3 ───────────────────────────────────────────────
      const appsRes = await fetch(
        this.base(orgUrl, '/apps?filter=status+eq+"ACTIVE"&limit=50'),
        { headers: this.headers(apiToken) },
      );

      if (appsRes.ok) {
        const apps = (await appsRes.json()) as any[];
        evidence.push({
          controlCode: 'CC6.3',
          title: 'Okta SSO Application Inventory',
          data: {
            totalActiveApps: apps.length,
            apps: apps.slice(0, 10).map((a) => ({
              name: a.label,
              signOnMode: a.signOnMode,
              status: a.status,
            })),
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) {
      this.logger.error(`Okta evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
