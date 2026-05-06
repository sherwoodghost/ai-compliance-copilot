import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'User-Agent':  'AI-Compliance-Copilot',
  Accept:        'application/vnd.github.v3+json',
});

export class DependabotTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'github-dependabot',
    controlCode:       'CC7.1',
    name:              'GitHub Dependabot — No Critical/High Vulnerabilities',
    description:       'Checks that there are no open critical or high severity Dependabot alerts in the GitHub organization.',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: 'github',
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const token = ctx.credentials?.['accessToken'] as string;
    const org   = ctx.credentials?.['org']         as string;

    if (!token || !org) {
      return this.skip('Missing GitHub accessToken or org in credentials');
    }

    const res = await fetch(
      `https://api.github.com/orgs/${org}/dependabot/alerts?state=open&severity=critical,high&per_page=20`,
      { headers: GH_HEADERS(token) },
    );

    // 404 means Dependabot not enabled for org
    if (res.status === 404) {
      return this.fail(
        { error: 'Dependabot not enabled on organization', criticalAlerts: null },
        'Dependabot Vulnerability Report',
        { enabled: false },
      );
    }

    if (!res.ok) {
      return this.fail({ error: `GitHub API ${res.status}: ${await res.text()}` });
    }

    const alerts: any[]   = await res.json();
    const criticalAlerts  = alerts.filter((a: any) => a.security_vulnerability?.severity === 'critical').length;
    const highAlerts      = alerts.filter((a: any) => a.security_vulnerability?.severity === 'high').length;

    if (alerts.length > 0) {
      return this.fail(
        {
          totalOpenAlerts: alerts.length,
          criticalAlerts,
          highAlerts,
          sample: alerts.slice(0, 5).map((a: any) => ({
            id:           a.number,
            package:      a.security_vulnerability?.package?.name,
            severity:     a.security_vulnerability?.severity,
            fixedIn:      a.security_vulnerability?.first_patched_version?.identifier,
          })),
        },
        'Dependabot Vulnerability Report',
        { enabled: true, criticalAlerts, highAlerts },
      );
    }

    return this.pass(
      { totalOpenAlerts: 0, criticalAlerts: 0, highAlerts: 0, enabled: true },
      'Dependabot Vulnerability Report',
      { enabled: true, criticalAlerts: 0, highAlerts: 0 },
    );
  }
}
