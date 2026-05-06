import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'User-Agent':  'AI-Compliance-Copilot',
  Accept:        'application/vnd.github.v3+json',
});

export class OrgMfaTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'github-org-mfa',
    controlCode:       'CC6.1',
    name:              'GitHub Org — All Members Have 2FA',
    description:       'Checks that no organization members have 2FA disabled.',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: 'github',
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const token = ctx.credentials?.['accessToken'] as string;
    const org   = ctx.credentials?.['org']         as string;

    if (!token || !org) {
      return this.skip('Missing GitHub accessToken or org in credentials');
    }

    // filter=2fa_disabled returns only members WITHOUT 2FA
    const res = await fetch(
      `https://api.github.com/orgs/${org}/members?filter=2fa_disabled&per_page=30`,
      { headers: GH_HEADERS(token) },
    );

    if (!res.ok) {
      // 422 often means the token lacks admin:org scope
      const body = await res.text();
      return this.fail({
        error:       `GitHub API ${res.status}: ${body}`,
        hint:        'Ensure the GitHub token has admin:org scope to read 2FA status',
      });
    }

    const membersWithout2fa: any[] = await res.json();

    if (membersWithout2fa.length > 0) {
      return this.fail(
        {
          membersWithoutMfa: membersWithout2fa.length,
          logins: membersWithout2fa.map((m: any) => m.login),
        },
        'GitHub 2FA Compliance Report',
        { membersWithoutMfa: membersWithout2fa.length, logins: membersWithout2fa.map((m: any) => m.login) },
      );
    }

    // Also fetch total member count for context
    const allRes = await fetch(
      `https://api.github.com/orgs/${org}/members?per_page=1`,
      { headers: GH_HEADERS(token) },
    );
    const linkHeader  = allRes.headers.get('Link') ?? '';
    const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
    const totalMembers  = lastPageMatch ? parseInt(lastPageMatch[1], 10) : 'unknown';

    return this.pass(
      { membersWithoutMfa: 0, totalMembers },
      'GitHub 2FA Compliance Report',
      { membersWithoutMfa: 0, totalMembers },
    );
  }
}
