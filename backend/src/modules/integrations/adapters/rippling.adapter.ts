import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class RipplingAdapter implements IntegrationAdapter {
  readonly provider = 'rippling';
  private readonly logger = new Logger(RipplingAdapter.name);

  private headers(token: string) {
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const token = credentials['apiKey'] as string;
    if (!token) return { connected: false, error: 'Missing apiKey' };
    try {
      const res = await fetch('https://app.rippling.com/api/o/auth/me', { headers: this.headers(token) });
      if (!res.ok) return { connected: false, error: `Rippling API returned ${res.status}` };
      const data = await res.json() as any;
      return { connected: true, details: { companyName: data.company?.name } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const token = credentials['apiKey'] as string;
    const evidence: IntegrationEvidence[] = [];

    // A.6.1: Employee roster — active employees
    try {
      const res = await fetch('https://app.rippling.com/api/o/employees?status=ACTIVE', { headers: this.headers(token) });
      if (res.ok) {
        const data = await res.json() as any;
        const employees = data.results ?? data ?? [];
        evidence.push({
          controlCode: 'A.6.1',
          title: 'Rippling Active Employee Roster',
          data: {
            activeEmployeeCount: Array.isArray(employees) ? employees.length : 0,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Rippling employees evidence: ${err.message}`); }

    // A.6.5: Offboarding — terminated employees this month
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(`https://app.rippling.com/api/o/employees?status=TERMINATED&start_date_gte=${thirtyDaysAgo}`, {
        headers: this.headers(token),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const terminated = data.results ?? data ?? [];
        evidence.push({
          controlCode: 'A.6.5',
          title: 'Rippling Recent Employee Terminations',
          data: {
            terminatedLast30Days: Array.isArray(terminated) ? terminated.length : 0,
            periodStart: thirtyDaysAgo,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Rippling terminations evidence: ${err.message}`); }

    return evidence;
  }
}
