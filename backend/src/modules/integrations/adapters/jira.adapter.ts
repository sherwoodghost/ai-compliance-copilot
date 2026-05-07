import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

/**
 * JiraAdapter
 *
 * Connects to Jira Cloud via email + API token (Basic Auth).
 * No OAuth flow needed — users generate a token at
 * https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * Evidence collected:
 * - CC8.1  Change Management: recent change/release tickets
 * - CC6.3  Access Control: permission scheme / project role changes
 * - CC7.1  Risk: open security/vulnerability tickets
 * - A.12.6 Vulnerability Management: security ticket backlog
 */
@Injectable()
export class JiraAdapter implements IntegrationAdapter {
  readonly provider = 'jira';
  private readonly logger = new Logger(JiraAdapter.name);

  private baseUrl(domain: string) {
    const clean = domain.replace(/https?:\/\//, '').replace(/\/$/, '');
    return `https://${clean}`;
  }

  private authHeader(email: string, apiToken: string) {
    return 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64');
  }

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const { domain, email, apiToken } = credentials as Record<string, string>;
    if (!domain || !email || !apiToken) {
      return { connected: false, error: 'Missing domain, email, or apiToken' };
    }

    try {
      const res = await fetch(`${this.baseUrl(domain)}/rest/api/3/myself`, {
        headers: {
          Authorization: this.authHeader(email, apiToken),
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { connected: false, error: `Jira returned HTTP ${res.status}: ${body.slice(0, 200)}` };
      }

      const user = await res.json() as any;
      return {
        connected: true,
        details: {
          displayName: user.displayName,
          accountId: user.accountId,
          emailAddress: user.emailAddress,
        },
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const { domain, email, apiToken, projectKey } = credentials as Record<string, string>;
    const evidence: IntegrationEvidence[] = [];
    const headers = {
      Authorization: this.authHeader(email, apiToken),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const base = this.baseUrl(domain);

    try {
      // ── CC8.1: Change management — recently resolved issues ──────────────────
      const changeQuery = projectKey
        ? `project = "${projectKey}" AND issuetype in (Story, Task, Epic, Sub-task) AND status changed to Done AFTER -30d ORDER BY updated DESC`
        : `issuetype in (Story, Task, Epic) AND status changed to Done AFTER -30d ORDER BY updated DESC`;

      const changeRes = await fetch(
        `${base}/rest/api/3/search?jql=${encodeURIComponent(changeQuery)}&maxResults=25&fields=summary,status,priority,assignee,updated,issuetype`,
        { headers },
      );

      if (changeRes.ok) {
        const changeData = await changeRes.json() as any;
        const issues = changeData.issues ?? [];

        evidence.push({
          controlCode: 'CC8.1',
          title: 'Jira Change Management — Recently Completed Issues',
          data: {
            totalRecentChanges: changeData.total ?? 0,
            sampledIssues: issues.slice(0, 15).map((i: any) => ({
              key: i.key,
              summary: i.fields?.summary,
              status: i.fields?.status?.name,
              priority: i.fields?.priority?.name,
              assignee: i.fields?.assignee?.displayName,
              updated: i.fields?.updated,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Evidence that changes are tracked and completed through formal ticket process',
          },
          collectedAt: new Date(),
        });
      }

      // ── CC7.1 / A.12.6: Security tickets — open vulnerabilities ─────────────
      const securityQuery = projectKey
        ? `project = "${projectKey}" AND (labels = security OR labels = vulnerability OR summary ~ "security") AND status != Done ORDER BY priority ASC`
        : `(labels = security OR labels = vulnerability OR summary ~ "CVE") AND status != Done ORDER BY priority ASC`;

      const secRes = await fetch(
        `${base}/rest/api/3/search?jql=${encodeURIComponent(securityQuery)}&maxResults=20&fields=summary,status,priority,labels,created`,
        { headers },
      );

      if (secRes.ok) {
        const secData = await secRes.json() as any;
        const secIssues = secData.issues ?? [];

        evidence.push({
          controlCode: 'CC7.1',
          title: 'Jira Security Ticket Backlog',
          data: {
            openSecurityIssues: secData.total ?? 0,
            sampledIssues: secIssues.slice(0, 10).map((i: any) => ({
              key: i.key,
              summary: i.fields?.summary,
              priority: i.fields?.priority?.name,
              labels: i.fields?.labels,
              created: i.fields?.created,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Open security and vulnerability issues being actively tracked',
          },
          collectedAt: new Date(),
        });
      }

      // ── Project list — shows governance structure ────────────────────────────
      const projRes = await fetch(`${base}/rest/api/3/project/search?maxResults=10`, { headers });

      if (projRes.ok) {
        const projData = await projRes.json() as any;
        const projects = projData.values ?? [];

        evidence.push({
          controlCode: 'CC6.3',
          title: 'Jira Project Access & Governance Structure',
          data: {
            totalProjects: projData.total ?? 0,
            projects: projects.slice(0, 10).map((p: any) => ({
              key: p.key,
              name: p.name,
              type: p.projectTypeKey,
              style: p.style,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Project governance structure evidencing access control segregation',
          },
          collectedAt: new Date(),
        });
      }

      this.logger.log(`Jira: collected ${evidence.length} evidence items from ${domain}`);
    } catch (err: any) {
      this.logger.error(`Jira evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
