import { Injectable, Logger } from '@nestjs/common';
import { IAMClient, GetAccountSummaryCommand, ListUsersCommand, ListMFADevicesCommand } from '@aws-sdk/client-iam';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand } from '@aws-sdk/client-s3';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

@Injectable()
export class AwsAdapter implements IntegrationAdapter {
  readonly provider = 'aws';
  private readonly logger = new Logger(AwsAdapter.name);

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const accessKeyId     = credentials['accessKeyId']     as string;
    const secretAccessKey = credentials['secretAccessKey'] as string;
    const region          = (credentials['region'] as string) ?? 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      return { connected: false, error: 'Missing accessKeyId or secretAccessKey' };
    }

    try {
      const sts      = new STSClient({ region, credentials: { accessKeyId, secretAccessKey } });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      return {
        connected: true,
        details:   { account: identity.Account, arn: identity.Arn, userId: identity.UserId },
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const accessKeyId     = credentials['accessKeyId']     as string;
    const secretAccessKey = credentials['secretAccessKey'] as string;
    const region          = (credentials['region'] as string) ?? 'us-east-1';
    const awsCreds        = { accessKeyId, secretAccessKey };

    const evidence: IntegrationEvidence[] = [];

    // ── CC6.1: IAM MFA status ──────────────────────────────────────────────
    try {
      const iam      = new IAMClient({ region, credentials: awsCreds });
      const usersRes = await iam.send(new ListUsersCommand({ MaxItems: 100 }));
      const users    = usersRes.Users ?? [];

      const usersWithoutMfa: string[] = [];
      for (const user of users) {
        const mfaRes = await iam.send(new ListMFADevicesCommand({ UserName: user.UserName }));
        if ((mfaRes.MFADevices ?? []).length === 0) {
          usersWithoutMfa.push(user.UserName ?? '');
        }
      }

      evidence.push({
        controlCode: 'CC6.1',
        title:       'AWS IAM MFA Status',
        data: {
          totalUsers:        users.length,
          usersWithMfa:      users.length - usersWithoutMfa.length,
          usersWithoutMfa:   usersWithoutMfa.length,
          nonCompliantUsers: usersWithoutMfa,
          collectedAt:       new Date().toISOString(),
        },
        collectedAt: new Date(),
      });
    } catch (err: any) {
      this.logger.warn(`IAM MFA evidence collection failed: ${err.message}`);
    }

    // ── CC6.3: Root access keys check ──────────────────────────────────────
    try {
      const iam     = new IAMClient({ region, credentials: awsCreds });
      const summary = await iam.send(new GetAccountSummaryCommand({}));
      const map     = (summary.SummaryMap ?? {}) as Record<string, number>;

      evidence.push({
        controlCode: 'CC6.3',
        title:       'AWS IAM Root Access Key Report',
        data: {
          rootKeysPresent:  (map['AccountAccessKeysPresent'] ?? 0) > 0,
          rootMfaActive:    (map['AccountMFAEnabled']        ?? 0) > 0,
          totalUsers:        map['Users']                    ?? 0,
          totalAccessKeys:   map['AccessKeys']               ?? 0,
          collectedAt:       new Date().toISOString(),
        },
        collectedAt: new Date(),
      });
    } catch (err: any) {
      this.logger.warn(`IAM account summary evidence collection failed: ${err.message}`);
    }

    // ── CC6.7: S3 public access block ─────────────────────────────────────
    try {
      const s3         = new S3Client({ region, credentials: awsCreds });
      const bucketsRes = await s3.send(new ListBucketsCommand({}));
      const buckets    = bucketsRes.Buckets ?? [];

      const bucketResults: { name: string; allBlocked: boolean }[] = [];
      for (const bucket of buckets) {
        const name = bucket.Name ?? '';
        try {
          const blockRes = await s3.send(new GetPublicAccessBlockCommand({ Bucket: name }));
          const cfg      = blockRes.PublicAccessBlockConfiguration ?? {};
          bucketResults.push({
            name,
            allBlocked:
              cfg.BlockPublicAcls       === true &&
              cfg.IgnorePublicAcls      === true &&
              cfg.BlockPublicPolicy     === true &&
              cfg.RestrictPublicBuckets === true,
          });
        } catch {
          bucketResults.push({ name, allBlocked: false });
        }
      }

      const publicCount = bucketResults.filter((b) => !b.allBlocked).length;

      evidence.push({
        controlCode: 'CC6.7',
        title:       'AWS S3 Public Access Block Configuration',
        data: {
          totalBuckets:   buckets.length,
          blockedBuckets: buckets.length - publicCount,
          publicBuckets:  publicCount,
          buckets:        bucketResults,
          collectedAt:    new Date().toISOString(),
        },
        collectedAt: new Date(),
      });
    } catch (err: any) {
      this.logger.warn(`S3 public-access-block evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
