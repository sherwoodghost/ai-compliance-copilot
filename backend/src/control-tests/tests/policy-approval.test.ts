import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

export class PolicyApprovalTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'policy-approval',
    controlCode:       'CC2.1',
    name:              'All Critical Policies Approved',
    description:       'Checks that the organization has at least one approved policy on record.',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: null,
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const approvedCount = await ctx.prisma.policy.count({
      where: { orgId: ctx.orgId, status: 'approved' },
    });

    const totalCount = await ctx.prisma.policy.count({
      where: { orgId: ctx.orgId },
    });

    if (approvedCount === 0) {
      return this.fail(
        { approvedCount: 0, totalCount },
        'Policy Approval Status',
        { approvedCount: 0, totalCount },
      );
    }

    return this.pass(
      { approvedCount, totalCount },
      'Policy Approval Status',
      { approvedCount, totalCount },
    );
  }
}
