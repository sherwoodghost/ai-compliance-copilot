import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class GitLabAdapter implements IntegrationAdapter {
  readonly provider = 'gitlab';
  private readonly logger = new Logger(GitLabAdapter.name);

  private headers(token: string) {
    return { 'PRIVATE-TOKEN': token, Accept: 'application/json' };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const token = credentials['accessToken'] as string;
    if (!token) return { connected: false, error: 'Missing accessToken' };
    try {
      const res = await fetch('https://gitlab.com/api/v4/user', { headers: this.headers(token) });
      if (!res.ok) return { connected: false, error: `GitLab API returned ${res.status}` };
      const user = await res.json() as any;
      return { connected: true, details: { username: user.username, name: user.name } };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const token   = credentials['accessToken'] as string;
    const groupId = credentials['groupId'] as string;
    const evidence: IntegrationEvidence[] = [];

    // CC8.1: Protected branches across projects
    try {
      const projRes = await fetch(`https://gitlab.com/api/v4/groups/${groupId}/projects?per_page=20`, {
        headers: this.headers(token),
      });
      if (projRes.ok) {
        const projects = await projRes.json() as any[];
        let protectedCount = 0;
        for (const proj of projects.slice(0, 10)) {
          try {
            const brRes = await fetch(`https://gitlab.com/api/v4/projects/${proj.id}/protected_branches`, {
              headers: this.headers(token),
            });
            if (brRes.ok) {
              const branches = await brRes.json() as any[];
              if (branches.length > 0) protectedCount++;
            }
          } catch { /* continue */ }
        }
        evidence.push({
          controlCode: 'CC8.1',
          title: 'GitLab Protected Branch Configuration',
          data: {
            totalProjects: projects.length,
            projectsWithProtectedBranches: protectedCount,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`GitLab branch protection evidence: ${err.message}`); }

    // CC6.3: Group member access
    try {
      const res = await fetch(`https://gitlab.com/api/v4/groups/${groupId}/members?per_page=100`, {
        headers: this.headers(token),
      });
      if (res.ok) {
        const members = await res.json() as any[];
        const owners = members.filter((m: any) => m.access_level >= 50);
        evidence.push({
          controlCode: 'CC6.3',
          title: 'GitLab Group Member Access List',
          data: {
            totalMembers: members.length,
            ownerCount: owners.length,
            collectedAt: new Date().toISOString(),
          },
          collectedAt: new Date(),
        });
      }
    } catch (err: any) { this.logger.warn(`GitLab members evidence: ${err.message}`); }

    return evidence;
  }
}
