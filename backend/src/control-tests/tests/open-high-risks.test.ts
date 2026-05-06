import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

export class OpenHighRisksTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'open-high-risks',
    controlCode:       'CC3.1',
    name:              'No Open Critical / High Risks',
    description:       'Checks that there are no unresolved critical or high severity risks.',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: null,
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const openHighRisks = await ctx.prisma.riskItem.findMany({
      where: {
        orgId:    ctx.orgId,
        status:   'open',
        severity: { in: ['critical', 'high'] },
      },
      select: { id: true, title: true, severity: true },
      take: 20,
    });

    const criticalCount = openHighRisks.filter((r) => r.severity === 'critical').length;
    const highCount     = openHighRisks.filter((r) => r.severity === 'high').length;

    if (openHighRisks.length > 0) {
      return this.fail(
        { openHighRiskCount: openHighRisks.length, criticalCount, highCount },
        'Open High-Risk Items Report',
        { risks: openHighRisks.map((r) => ({ id: r.id, title: r.title, severity: r.severity })) },
      );
    }

    return this.pass(
      { openHighRiskCount: 0, criticalCount: 0, highCount: 0 },
      'Open High-Risk Items Report',
      { risks: [] },
    );
  }
}
