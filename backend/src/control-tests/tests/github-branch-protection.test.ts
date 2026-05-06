import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

const GH_HEADERS = (token: string) => ({
  Authorization:  `Bearer ${token}`,
  'User-Agent':   'AI-Compliance-Copilot',
  Accept:         'application/vnd.github.v3+json',
});

export class BranchProtectionTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'github-branch-protection',
    controlCode:       'CC8.1',
    name:              'GitHub Branch Protection Enabled',
    description:       'Verifies that all repositories in the GitHub organization have branch protection rules on the default branch.',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: 'github',
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const token = ctx.credentials?.['accessToken'] as string;
    const org   = ctx.credentials?.['org']         as string;

    if (!token || !org) {
      return this.skip('Missing GitHub accessToken or org in credentials');
    }

    // Fetch up to 20 repos
    const reposRes = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=20&type=all`, {
      headers: GH_HEADERS(token),
    });

    if (!reposRes.ok) {
      return this.fail({ error: `GitHub API ${reposRes.status}: ${await reposRes.text()}` });
    }

    const repos: any[] = await reposRes.json();
    const results: { name: string; protected: boolean; branch: string }[] = [];

    for (const repo of repos) {
      const branch    = repo.default_branch ?? 'main';
      const protRes   = await fetch(
        `https://api.github.com/repos/${org}/${repo.name}/branches/${branch}/protection`,
        { headers: GH_HEADERS(token) },
      );
      results.push({ name: repo.name, protected: protRes.ok, branch });
    }

    const protectedCount   = results.filter((r) => r.protected).length;
    const unprotectedCount = results.length - protectedCount;
    const unprotected      = results.filter((r) => !r.protected).map((r) => r.name);

    if (unprotectedCount > 0) {
      return this.fail(
        { totalRepos: results.length, protectedCount, unprotectedCount, unprotectedRepos: unprotected },
        'GitHub Branch Protection Report',
        { repos: results, protectedCount, totalRepos: results.length },
      );
    }

    return this.pass(
      { totalRepos: results.length, protectedCount, unprotectedCount: 0 },
      'GitHub Branch Protection Report',
      { repos: results, protectedCount, totalRepos: results.length },
    );
  }
}
