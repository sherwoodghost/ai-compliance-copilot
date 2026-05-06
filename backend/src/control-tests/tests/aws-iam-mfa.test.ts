import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';
import {
  IAMClient,
  ListUsersCommand,
  ListMFADevicesCommand,
} from '@aws-sdk/client-iam';

export class IamMfaTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'aws-iam-mfa',
    controlCode:       'CC6.1',
    name:              'AWS IAM — All Users Have MFA',
    description:       'Checks that every IAM user in the AWS account has at least one MFA device enrolled.',
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

    // List all IAM users
    const usersRes = await iam.send(new ListUsersCommand({ MaxItems: 100 }));
    const users    = usersRes.Users ?? [];

    if (users.length === 0) {
      return this.pass({ totalUsers: 0, usersWithoutMfa: 0 }, 'AWS IAM MFA Status Report', { totalUsers: 0 });
    }

    const usersWithoutMfa: string[] = [];

    for (const user of users) {
      const mfaRes  = await iam.send(new ListMFADevicesCommand({ UserName: user.UserName }));
      const devices = mfaRes.MFADevices ?? [];
      if (devices.length === 0) {
        usersWithoutMfa.push(user.UserName ?? '');
      }
    }

    const evidenceData = {
      totalUsers:      users.length,
      usersWithMfa:    users.length - usersWithoutMfa.length,
      usersWithoutMfa: usersWithoutMfa.length,
      nonCompliantUsers: usersWithoutMfa,
    };

    if (usersWithoutMfa.length > 0) {
      return this.fail(
        { totalUsers: users.length, usersWithoutMfa: usersWithoutMfa.length, users: usersWithoutMfa },
        'AWS IAM MFA Status Report',
        evidenceData,
      );
    }

    return this.pass(
      { totalUsers: users.length, usersWithoutMfa: 0 },
      'AWS IAM MFA Status Report',
      evidenceData,
    );
  }
}
