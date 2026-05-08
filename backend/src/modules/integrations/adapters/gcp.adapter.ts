import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class GcpAdapter implements IntegrationAdapter {
  readonly provider = 'gcp';
  private readonly logger = new Logger(GcpAdapter.name);

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const accessToken = credentials['accessToken'] as string;
    const projectId   = credentials['projectId'] as string;
    if (!accessToken || !projectId) return { connected: false, error: 'Missing accessToken or projectId' };
    try {
      const res = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { connected: false, error: `GCP API returned ${res.status}` };
      const proj = await res.json() as any;
      return { connected: true, details: { projectName: proj.name, projectId: proj.projectId } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const accessToken = credentials['accessToken'] as string;
    const projectId   = credentials['projectId'] as string;
    const evidence: IntegrationEvidence[] = [];

    // CC6.1: IAM policy — check for allUsers/allAuthenticatedUsers bindings
    try {
      const res = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }),
      });
      if (res.ok) {
        const policy = await res.json() as any;
        const bindings = policy.bindings ?? [];
        const publicBindings = bindings.filter((b: any) =>
          (b.members ?? []).some((m: string) => m === 'allUsers' || m === 'allAuthenticatedUsers')
        );
        evidence.push({
          controlCode: 'CC6.1',
          title: 'GCP IAM Policy — Public Access Check',
          data: {
            totalBindings: bindings.length,
            publicBindings: publicBindings.length,
            publicRoles: publicBindings.map((b: any) => b.role),
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`GCP IAM evidence: ${err.message}`); }

    // CC7.4: Cloud Logging — log sinks configured
    try {
      const res = await fetch(`https://logging.googleapis.com/v2/projects/${projectId}/sinks`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json() as any;
        const sinks = data.sinks ?? [];
        evidence.push({
          controlCode: 'CC7.4',
          title: 'GCP Cloud Logging Sinks',
          data: {
            totalSinks: sinks.length,
            sinkNames: sinks.map((s: any) => s.name),
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`GCP logging evidence: ${err.message}`); }

    // CC6.7: Storage bucket public access
    try {
      const res = await fetch(`https://storage.googleapis.com/storage/v1/b?project=${projectId}&maxResults=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json() as any;
        const buckets = data.items ?? [];
        evidence.push({
          controlCode: 'CC6.7',
          title: 'GCP Storage Bucket Inventory',
          data: {
            totalBuckets: buckets.length,
            bucketNames: buckets.map((b: any) => b.name),
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`GCP storage evidence: ${err.message}`); }

    return evidence;
  }
}
