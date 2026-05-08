import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class DatadogAdapter implements IntegrationAdapter {
  readonly provider = 'datadog';
  private readonly logger = new Logger(DatadogAdapter.name);

  private headers(apiKey: string, appKey: string) {
    return { 'DD-API-KEY': apiKey, 'DD-APPLICATION-KEY': appKey, Accept: 'application/json' };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const apiKey = credentials['apiKey'] as string;
    const appKey = credentials['appKey'] as string;
    if (!apiKey || !appKey) return { connected: false, error: 'Missing apiKey or appKey' };
    try {
      const res = await fetch('https://api.datadoghq.com/api/v1/validate', {
        headers: this.headers(apiKey, appKey),
      });
      if (!res.ok) return { connected: false, error: `Datadog API returned ${res.status}` };
      return { connected: true, details: { validated: true } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const apiKey = credentials['apiKey'] as string;
    const appKey = credentials['appKey'] as string;
    const evidence: IntegrationEvidence[] = [];

    // CC7.2: Monitoring & alerting coverage
    try {
      const res = await fetch('https://api.datadoghq.com/api/v1/monitor?page_size=100', {
        headers: this.headers(apiKey, appKey),
      });
      if (res.ok) {
        const monitors = await res.json() as any[];
        const alerting = monitors.filter((m: any) => m.type === 'metric alert' || m.type === 'service check');
        evidence.push({
          controlCode: 'CC7.2',
          title: 'Datadog Monitoring & Alerting Configuration',
          data: {
            totalMonitors: monitors.length,
            alertingMonitors: alerting.length,
            monitorTypes: [...new Set(monitors.map((m: any) => m.type))],
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Datadog monitors evidence: ${err.message}`); }

    // CC7.4: Log management
    try {
      const res = await fetch('https://api.datadoghq.com/api/v2/logs/config/pipelines', {
        headers: this.headers(apiKey, appKey),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const pipelines = data.data ?? [];
        evidence.push({
          controlCode: 'CC7.4',
          title: 'Datadog Log Pipeline Configuration',
          data: {
            pipelineCount: pipelines.length,
            enabledPipelines: pipelines.filter((p: any) => p.attributes?.is_enabled).length,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`Datadog log pipeline evidence: ${err.message}`); }

    return evidence;
  }
}
