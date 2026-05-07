import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

/**
 * GitLabAdapter
 *
 * Connects via Personal Access Token or Group Access Token.
 * Supports both GitLab.com and self-hosted instances.
 *
 * Evidence collected:
 * - CC8.1  Change Management: merge request approval rules
 * - CC6.3  Access Control: group member permissions
 * - A.12.6 Vulnerability Management: security scanner findings
 * - CC6.1  Logical Access: 2FA enforcement status
 */
@Injectable()
export class GitLabAdapter implements IntegrationAdapter {
  readonly provider = 'gitlab';
  private readonly logger = new Logger(GitLabAdapter.name);

  private api(baseUrl: string, path: string) {
    const clean = (baseUrl || 'https://gitlab.com').replace(/\/$/, '');
    return `${clean}/api/v4${path}`;
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const { token, baseUrl } = credentials as Record<string, string>;
    if (!token) {
      return { connected: false, error: 'Missing Personal Access Token' };
    }

    try {
      const res = await fetch(this.api(baseUrl, '/user'), {
        headers: { 'PRIVATE-TOKEN': token, 'User-Agent': 'AI-Compliance-Copilot' },
      });

      if (res.status === 401) return { connected: false, error: 'Invalid or revoked access token' };
      if (!res.ok) return { connected: false, error: `GitLab returned HTTP ${res.status}` };

      const user = await res.json() as any;
      return {
        connected: true,
        details: {
          username: user.username,
          name: user.name,
          isAdmin: user.is_admin,
        },
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const { token, baseUrl, groupId } = credentials as Record<string, string>;
    const hdrs = { 'PRIVATE-TOKEN': token, 'User-Agent': 'AI-Compliance-Copilot' };
    const evidence: IntegrationEvidence[] = [];

    try {
      // ── CC8.1: Merge request approval rules ──────────────────────────────────
      // List projects in group (or user's projects)
      const projectsUrl = groupId
        ? this.api(baseUrl, `/groups/${groupId}/projects?per_page=20`)
        : this.api(baseUrl, '/projects?membership=true&per_page=20');

      const projectsRes = await fetch(projectsUrl, { headers: hdrs });

      if (projectsRes.ok) {
        const projects = await projectsRes.json() as any[];

        // Check approval rules on first 5 projects
        const approvalSamples: any[] = [];
        for (const project of projects.slice(0, 5)) {
          const apprRes = await fetch(
            this.api(baseUrl, `/projects/${project.id}/approval_rules`),
            { headers: hdrs },
          );
          if (apprRes.ok) {
            const rules = await apprRes.json() as any[];
            approvalSamples.push({
              project: project.name,
              path: project.path_with_namespace,
              approvalRules: rules.length,
              requiresApproval: rules.some((r: any) => r.approvals_required > 0),
            });
          }
        }

        evidence.push({
          controlCode: 'CC8.1',
          title: 'GitLab Merge Request Approval Configuration',
          data: {
            totalProjects: projects.length,
            projectsWithApprovalRules: approvalSamples.filter((p) => p.requiresApproval).length,
            sampleProjects: approvalSamples,
            collectedAt: new Date().toISOString(),
            note: 'Merge request approval rules evidencing change control process',
          },
          collectedAt: new Date(),
        });

        // ── CC6.1: 2FA enforcement on group ─────────────────────────────────
        if (groupId) {
          const groupRes = await fetch(
            this.api(baseUrl, `/groups/${groupId}?with_projects=false`),
            { headers: hdrs },
          );
          if (groupRes.ok) {
            const group = await groupRes.json() as any;
            evidence.push({
              controlCode: 'CC6.1',
              title: 'GitLab Group 2FA Enforcement',
              data: {
                groupName: group.name,
                groupPath: group.full_path,
                require2FA: group.require_two_factor_authentication ?? false,
                twoFactorGracePeriod: group.two_factor_grace_period,
                collectedAt: new Date().toISOString(),
                note: '2FA enforcement setting for the GitLab group',
              },
              collectedAt: new Date(),
            });
          }
        }
      }

      // ── CC6.3: Group member permissions ──────────────────────────────────────
      if (groupId) {
        const membersRes = await fetch(
          this.api(baseUrl, `/groups/${groupId}/members/all?per_page=50`),
          { headers: hdrs },
        );

        if (membersRes.ok) {
          const members = await membersRes.json() as any[];
          const accessLevels: Record<number, string> = {
            10: 'Guest', 20: 'Reporter', 30: 'Developer', 40: 'Maintainer', 50: 'Owner',
          };

          evidence.push({
            controlCode: 'CC6.3',
            title: 'GitLab Group Member Access List',
            data: {
              totalMembers: members.length,
              byAccessLevel: Object.fromEntries(
                Object.entries(accessLevels).map(([level, label]) => [
                  label,
                  members.filter((m: any) => m.access_level === Number(level)).length,
                ]),
              ),
              sampleMembers: members.slice(0, 10).map((m: any) => ({
                username: m.username,
                name: m.name,
                accessLevel: accessLevels[m.access_level] ?? m.access_level,
                expiresAt: m.expires_at,
              })),
              collectedAt: new Date().toISOString(),
              note: 'Group membership and access levels evidencing role-based access control',
            },
            collectedAt: new Date(),
          });
        }
      }

      // ── A.12.6: Security scanner findings ────────────────────────────────────
      if (groupId) {
        const vulnRes = await fetch(
          this.api(baseUrl, `/groups/${groupId}/vulnerability_findings?state=opened&per_page=20`),
          { headers: hdrs },
        );

        if (vulnRes.ok) {
          const vulns = await vulnRes.json() as any[];
          const bySeverity = vulns.reduce((acc: Record<string, number>, v: any) => {
            acc[v.severity] = (acc[v.severity] ?? 0) + 1;
            return acc;
          }, {});

          evidence.push({
            controlCode: 'A.12.6',
            title: 'GitLab Security Scanner — Open Vulnerability Findings',
            data: {
              totalOpenVulnerabilities: vulns.length,
              bySeverity,
              sampleFindings: vulns.slice(0, 8).map((v: any) => ({
                title: v.name,
                severity: v.severity,
                state: v.state,
                project: v.project?.name,
              })),
              collectedAt: new Date().toISOString(),
              note: 'Open security scanner findings from GitLab SAST/DAST/dependency scanning',
            },
            collectedAt: new Date(),
          });
        }
      }

      this.logger.log(`GitLab: collected ${evidence.length} evidence items`);
    } catch (err: any) {
      this.logger.error(`GitLab evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
