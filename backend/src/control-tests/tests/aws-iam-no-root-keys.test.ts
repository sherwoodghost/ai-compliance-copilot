import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';
import { IAMClient, GetAccountSummaryCommand } from '@aws-sdk/client-iam';

export class IamNoRootKeysTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'aws-iam-no-root-keys',
    controlCode:       'CC6.3',
    name:              'AWS IAM — No Root Account Access Keys',
    description:       'Verifies that the AWS root account has no active access keys (best practice: use IAM users instead).',
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

    const iam     = new IAMClient({ region, credentials: { accessKeyId, secretAccessKey } });
    const summary = await iam.send(new GetAccountSummaryCommand({}));
    const map     = (summary.SummaryMap ?? {}) as Record<string, number>;

    const rootKeysPresent    = (map['AccountAccessKeysPresent']    ?? 0) > 0;
    const rootMfaActive      = (map['AccountMFAEnabled']           ?? 0) > 0;
    const totalUsers         =  map['Users']                       ?? 0;
    const totalAccessKeys    =  map['AccessKeys']                  ?? 0;

    const evidenceData = {
      rootKeysPresent,
      rootMfaActive,
      totalUsers,
      totalAccessKeys,
      accountSummary: map,
    };

    if (rootKeysPresent) {
      return this.fail(
        { rootKeysPresent: true, recommendation: 'Delete root access keys immediately and use IAM users.' },
        'AWS Root Access Key Report',
        evidenceData,
      );
    }

    return this.pass(
      { rootKeysPresent: false, rootMfaActive, totalUsers },
      'AWS Root Access Key Report',
      evidenceData,
    );
  }
}
