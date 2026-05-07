import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

/**
 * DatadogAdapter
 *
 * Connects via API key + Application key.
 * Collects evidence for:
 * - CC7.2 System Operations / A.12.4: Logging & monitoring (monitors, log pipelines)
 * - CC7.1 Threat & Vulnerability Detection: security signal rules
 * - A.12.1 Operational Procedures: SLO configurations
 */
@Injectable()
export class DatadogAdapter implements IntegrationAdapter {
  readonly provider = 'datadog';
  private readonly logger = new Logger(DatadogAdapter.name);

  private headers(apiKey: string, appKey: string) {
    return {
      'DD-API-KEY': apiKey,
      'DD-APPLICATION-KEY': appKey,
      'Content-Type': 'application/json',
    };
  }

  private site(credentials: Record<string, unknown>) {
    // Datadog has regional sites: datadoghq.com (US), datadoghq.eu (EU), etc.
    return (credentials['site'] as string) || 'datadoghq.com';
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const { apiKey, appKey } = credentials as Record<string, string>;
    if (!apiKey || !appKey) {
      return { connected: false, error: 'Missing apiKey or appKey' };
    }

    try {
      const site = this.site(credentials);
      const res = await fetch(`https://api.${site}/api/v1/validate`, {
        headers: this.headers(apiKey, appKey),
      });

      if (!res.ok) {
        return { connected: false, error: `Datadog returned HTTP ${res.status}` };
      }

      const data = await res.json() as any;
      return {
        connected: data.valid === true,
        details: { site, valid: data.valid },
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const { apiKey, appKey } = credentials as Record<string, string>;
    const site = this.site(credentials);
    const hdrs = this.headers(apiKey, appKey);
    const base = `https://api.${site}`;
    const evidence: IntegrationEvidence[] = [];

    try {
      // ── CC7.2 / A.12.4: Monitors (alerting configuration) ──────────────────
      const monitorsRes = await fetch(`${base}/api/v1/monitor?page_size=25`, { headers: hdrs });

      if (monitorsRes.ok) {
        const monitors = await monitorsRes.json() as any[];
        const activeMonitors = monitors.filter((m) => !m.deleted);
        const criticalMonitors = activeMonitors.filter((m) =>
          (m.options?.thresholds?.critical !== undefined) ||
          m.tags?.some((t: string) => t.toLowerCase().includes('security') || t.toLowerCase().includes('alert')),
        );

        evidence.push({
          controlCode: 'CC7.2',
          title: 'Datadog Monitoring & Alerting Configuration',
          data: {
            totalMonitors: activeMonitors.length,
            criticalAlerts: criticalMonitors.length,
            sampleMonitors: activeMonitors.slice(0, 10).map((m: any) => ({
              name: m.name,
              type: m.type,
              status: m.overall_state,
              tags: m.tags?.slice(0, 3),
            })),
            collectedAt: new Date().toISOString(),
            note: 'Active monitoring and alerting configuration evidencing operational oversight',
          },
          collectedAt: new Date(),
        });
      }

      // ── CC7.1: Security Signal rules / detection rules ──────────────────────
      const secRulesRes = await fetch(
        `${base}/api/v2/security_monitoring/rules?is_enabled=true&page[size]=25`,
        { headers: hdrs },
      );

      if (secRulesRes.ok) {
        const rulesData = await secRulesRes.json() as any;
        const rules = rulesData.data ?? [];

        evidence.push({
          controlCode: 'CC7.1',
          title: 'Datadog Security Monitoring Rules',
          data: {
            totalRules: rules.length,
            enabledRules: rules.filter((r: any) => r.attributes?.isEnabled).length,
            sampleRules: rules.slice(0, 8).map((r: any) => ({
              name: r.attributes?.name,
              severity: r.attributes?.options?.maxSignalDuration,
              type: r.type,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Security detection rules evidencing threat monitoring controls',
          },
          collectedAt: new Date(),
        });
      }

      // ── A.12.4: Log pipelines (audit trail completeness) ───────────────────
      const logPipelinesRes = await fetch(`${base}/api/v1/logs/config/pipelines`, { headers: hdrs });

      if (logPipelinesRes.ok) {
        const pipelines = await logPipelinesRes.json() as any[];

        evidence.push({
          controlCode: 'A.12.4',
          title: 'Datadog Log Pipeline Configuration',
          data: {
            totalPipelines: pipelines.length,
            enabledPipelines: pipelines.filter((p: any) => p.is_enabled).length,
            samplePipelines: pipelines.slice(0, 5).map((p: any) => ({
              name: p.name,
              isEnabled: p.is_enabled,
              filter: p.filter?.query,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Log processing pipelines evidencing audit trail completeness',
          },
          collectedAt: new Date(),
        });
      }

      this.logger.log(`Datadog: collected ${evidence.length} evidence items`);
    } catch (err: any) {
      this.logger.error(`Datadog evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
