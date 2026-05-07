import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

/**
 * RipplingAdapter
 *
 * Connects to Rippling via API key (Bearer token).
 * Credentials required:
 *   - apiKey: Rippling API key (Bearer token)
 *
 * Evidence collected:
 * - CC6.2  Logical Access: active employee count + department breakdown
 * - CC6.2  Logical Access: offboarded/terminated employee evidence
 * - CC6.3  Access Control: RBAC role structure from Rippling roles API
 */
@Injectable()
export class RipplingAdapter implements IntegrationAdapter {
  readonly provider = 'rippling';
  private readonly logger = new Logger(RipplingAdapter.name);

  private readonly baseUrl = 'https://api.rippling.com';

  private authHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const apiKey = credentials['apiKey'] as string;
    if (!apiKey) {
      return { connected: false, error: 'Missing apiKey' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/platform/api/me`, {
        headers: this.authHeaders(apiKey),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return {
          connected: false,
          error: `Rippling API returned HTTP ${response.status}: ${body.slice(0, 200)}`,
        };
      }

      const me = await response.json() as any;
      return {
        connected: true,
        details: {
          id: me.id,
          name: me.name ?? `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim(),
          email: me.email,
          role: me.role,
        },
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const apiKey = credentials['apiKey'] as string;
    const evidence: IntegrationEvidence[] = [];

    if (!apiKey) {
      this.logger.error('RipplingAdapter: apiKey is missing, skipping evidence collection');
      return evidence;
    }

    const headers = this.authHeaders(apiKey);

    try {
      // ── CC6.2: Active employees — count + department breakdown ────────────────
      try {
        const activeRes = await fetch(
          `${this.baseUrl}/platform/api/employees?status=ACTIVE&limit=50`,
          { headers },
        );

        if (activeRes.ok) {
          const employees = await activeRes.json() as any[];
          const deptCounts: Record<string, number> = {};
          for (const emp of employees) {
            const dept: string = emp.department ?? 'Unknown';
            deptCounts[dept] = (deptCounts[dept] ?? 0) + 1;
          }

          evidence.push({
            controlCode: 'CC6.2',
            title: 'Rippling Active Employee Access Roster',
            data: {
              totalActive: employees.length,
              departmentBreakdown: deptCounts,
              collectedAt: new Date().toISOString(),
              note: 'Employee counts by department (names omitted for privacy). Evidences active access management.',
            },
            collectedAt: new Date(),
          });
        } else {
          this.logger.warn(`Rippling active employees returned HTTP ${activeRes.status}`);
        }
      } catch (empErr: any) {
        this.logger.error(`Rippling active employee fetch failed: ${empErr.message}`);
      }

      // ── CC6.3: Roles — RBAC structure ─────────────────────────────────────────
      try {
        const rolesRes = await fetch(`${this.baseUrl}/platform/api/roles`, { headers });

        if (rolesRes.ok) {
          const roles = await rolesRes.json() as any[];

          evidence.push({
            controlCode: 'CC6.3',
            title: 'Rippling RBAC Role Structure',
            data: {
              totalRoles: roles.length,
              roles: roles.slice(0, 20).map((r: any) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                isSystem: r.isSystem ?? false,
              })),
              collectedAt: new Date().toISOString(),
              note: 'Role definitions evidencing role-based access control (RBAC) configuration',
            },
            collectedAt: new Date(),
          });
        } else {
          this.logger.warn(`Rippling roles returned HTTP ${rolesRes.status}`);
        }
      } catch (rolesErr: any) {
        this.logger.error(`Rippling roles fetch failed: ${rolesErr.message}`);
      }

      // ── CC6.2: Terminated / offboarded employees ──────────────────────────────
      try {
        const termRes = await fetch(
          `${this.baseUrl}/platform/api/employees?status=TERMINATED&limit=50`,
          { headers },
        );

        if (termRes.ok) {
          const terminated = await termRes.json() as any[];

          evidence.push({
            controlCode: 'CC6.2',
            title: 'Rippling Offboarded Employee Records',
            data: {
              totalTerminated: terminated.length,
              collectedAt: new Date().toISOString(),
              note: 'Count of terminated employees in Rippling. Evidences offboarding process and access revocation tracking.',
            },
            collectedAt: new Date(),
          });
        } else {
          this.logger.warn(`Rippling terminated employees returned HTTP ${termRes.status}`);
        }
      } catch (termErr: any) {
        this.logger.error(`Rippling terminated employee fetch failed: ${termErr.message}`);
      }

      this.logger.log(`Rippling: collected ${evidence.length} evidence items`);
    } catch (err: any) {
      this.logger.error(`Rippling evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
