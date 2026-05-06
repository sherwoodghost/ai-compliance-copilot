import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

const FRESHNESS_DAYS = 90;

export class EvidenceFreshnessTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'evidence-freshness',
    controlCode:       'CC2.1',
    name:              'Evidence Freshness Check',
    description:       `Verifies that no evidence items are expired or older than ${FRESHNESS_DAYS} days.`,
    frequencyCron:     '0 */6 * * *',
    requiresConnector: null,
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - FRESHNESS_DAYS);

    const [validCount, staleCount, invalidCount] = await Promise.all([
      ctx.prisma.evidence.count({ where: { orgId: ctx.orgId, isValid: true } }),
      ctx.prisma.evidence.count({
        where: { orgId: ctx.orgId, isValid: true, collectedAt: { lt: cutoff } },
      }),
      ctx.prisma.evidence.count({ where: { orgId: ctx.orgId, isValid: false } }),
    ]);

    const totalStale = staleCount + invalidCount;

    if (totalStale > 0) {
      return this.fail(
        { staleCount, invalidCount, totalStale, validCount, freshnessThresholdDays: FRESHNESS_DAYS },
        'Evidence Freshness Report',
        { staleCount, invalidCount, totalStale, validCount },
      );
    }

    return this.pass(
      { validCount, totalStale: 0, freshnessThresholdDays: FRESHNESS_DAYS },
      'Evidence Freshness Report',
      { validCount, totalStale: 0 },
    );
  }
}
