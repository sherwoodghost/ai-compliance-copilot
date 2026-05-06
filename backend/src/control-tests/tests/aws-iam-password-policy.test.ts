import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';
import { IAMClient, GetAccountPasswordPolicyCommand } from '@aws-sdk/client-iam';

export class IamPasswordPolicyTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'aws-iam-password-policy',
    controlCode:       'CC6.1',
    name:              'AWS IAM — Strong Password Policy',
    description:       'Checks that the AWS account has a strong IAM password policy (min 14 chars, complexity, 90-day rotation).',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: 'aws',
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const accessKeyId     = ctx.credentials?.['accessKeyId']     as string;
    const secretAccessKey = ctx.credentials?.['secretAccessKey'] as string;
    const region          = (ctx.credentials?.['region'] as string) ?? 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      return this.skip('Missing AWS accessKeyId or secretAccessKey');
    }

    const iam = new IAMClient({ region, credentials: { accessKeyId, secretAccessKey } });

    let policy: Record<string, unknown>;

    try {
      const res = await iam.send(new GetAccountPasswordPolicyCommand({}));
      policy = res.PasswordPolicy as Record<string, unknown>;
    } catch (err: any) {
      if (err.name === 'NoSuchEntityException') {
        return this.fail(
          { error: 'No IAM password policy is set on this account', issues: ['No password policy configured'] },
          'AWS IAM Password Policy Report',
          { policySet: false },
        );
      }
      throw err;
    }

    const issues: string[] = [];

    const minLen = (policy['MinimumPasswordLength'] as number) ?? 0;
    if (minLen < 14)                                    issues.push(`Minimum password length is ${minLen} (required: ≥ 14)`);
    if (!policy['RequireUppercaseCharacters'])          issues.push('Uppercase characters not required');
    if (!policy['RequireLowercaseCharacters'])          issues.push('Lowercase characters not required');
    if (!policy['RequireNumbers'])                      issues.push('Numbers not required');
    if (!policy['RequireSymbols'])                      issues.push('Symbols not required');

    const maxAge = policy['MaxPasswordAge'] as number | undefined;
    if (!maxAge || maxAge > 90)                         issues.push(`Max password age is ${maxAge ?? 'not set'} days (required: ≤ 90)`);
    if (!policy['PreventPasswordReuse'])                issues.push('Password reuse prevention not configured');

    const evidenceData = { policySet: true, issues, policy };

    if (issues.length > 0) {
      return this.fail(
        { issues, issueCount: issues.length, policy },
        'AWS IAM Password Policy Report',
        evidenceData,
      );
    }

    return this.pass(
      { issues: [], policy },
      'AWS IAM Password Policy Report',
      evidenceData,
    );
  }
}
