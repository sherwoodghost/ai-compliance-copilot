import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'User-Agent':  'AI-Compliance-Copilot',
  Accept:        'application/vnd.github.v3+json',
});

export class SecretScanningTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'github-secret-scanning',
    controlCode:       'CC7.2',
    name:              'GitHub Secret Scanning — No Open Alerts',
    description:       'Checks that there are no open secret scanning alerts in the GitHub organization.',
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
      `https://api.github.com/orgs/${org}/secret-scanning/alerts?state=open&per_page=20`,
      { headers: GH_HEADERS(token) },
    );

    // 404 means secret scanning is not enabled (treat as misconfiguration → fail)
    if (res.status === 404) {
      return this.fail(
        { error: 'Secret scanning not enabled or org not found', openAlerts: null },
        'GitHub Secret Scanning Status',
        { enabled: false },
      );
    }

    if (!res.ok) {
      return this.fail({ error: `GitHub API ${res.status}: ${await res.text()}` });
    }

    const alerts: any[] = await res.json();
    const openAlerts    = alerts.length;

    if (openAlerts > 0) {
      return this.fail(
        { openAlerts, alertSample: alerts.slice(0, 5).map((a: any) => ({ id: a.number, secret_type: a.secret_type, state: a.state })) },
        'GitHub Secret Scanning Status',
        { openAlerts, enabled: true },
      );
    }

    return this.pass(
      { openAlerts: 0, enabled: true },
      'GitHub Secret Scanning Status',
      { openAlerts: 0, enabled: true },
    );
  }
}
