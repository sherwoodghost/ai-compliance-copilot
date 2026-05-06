import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

export class MfaFlagTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'mfa-flag',
    controlCode:       'CC6.1',
    name:              'MFA Enabled in Business Profile',
    description:       'Checks that the organization has indicated MFA is enabled in their business profile.',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: null,
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const profile = await ctx.prisma.businessProfile.findUnique({
      where: { orgId: ctx.orgId },
    });

    if (!profile) {
      return this.skip('No business profile found — complete onboarding first');
    }

    // Check multiple possible profile fields for MFA flag
    const compliance = profile.complianceGoals as Record<string, unknown> | null;
    const infra      = profile.infrastructure  as Record<string, unknown> | null;

    const mfaEnabled =
      compliance?.['mfaEnabled'] === true ||
      infra?.['mfaEnabled']      === true ||
      compliance?.['mfa']        === true ||
      infra?.['mfa']             === true;

    if (!mfaEnabled) {
      return this.fail(
        { mfaEnabled: false, profileComplete: profile.isComplete },
        'MFA Configuration Status',
        { mfaEnabled: false },
      );
    }

    return this.pass(
      { mfaEnabled: true, profileComplete: profile.isComplete },
      'MFA Configuration Status',
      { mfaEnabled: true },
    );
  }
}
