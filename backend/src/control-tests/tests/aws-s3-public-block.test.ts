import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';
import { S3Client, ListBucketsCommand, GetPublicAccessBlockCommand } from '@aws-sdk/client-s3';

export class S3PublicBlockTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'aws-s3-public-block',
    controlCode:       'CC6.7',
    name:              'AWS S3 — Public Access Block Enabled on All Buckets',
    description:       'Verifies that every S3 bucket has all four public-access-block settings enabled.',
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

    const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });

    const bucketsRes = await s3.send(new ListBucketsCommand({}));
    const buckets    = bucketsRes.Buckets ?? [];

    if (buckets.length === 0) {
      return this.pass({ totalBuckets: 0, publicBuckets: 0, allBlocked: true }, 'AWS S3 Public Access Block Report', { totalBuckets: 0 });
    }

    const results: { name: string; allBlocked: boolean; config: Record<string, boolean | undefined> }[] = [];

    for (const bucket of buckets) {
      const name = bucket.Name ?? '';
      try {
        const blockRes = await s3.send(new GetPublicAccessBlockCommand({ Bucket: name }));
        const cfg      = blockRes.PublicAccessBlockConfiguration ?? {};
        const allBlocked =
          cfg.BlockPublicAcls    === true &&
          cfg.IgnorePublicAcls   === true &&
          cfg.BlockPublicPolicy  === true &&
          cfg.RestrictPublicBuckets === true;

        results.push({
          name,
          allBlocked,
          config: {
            BlockPublicAcls:       cfg.BlockPublicAcls,
            IgnorePublicAcls:      cfg.IgnorePublicAcls,
            BlockPublicPolicy:     cfg.BlockPublicPolicy,
            RestrictPublicBuckets: cfg.RestrictPublicBuckets,
          },
        });
      } catch {
        // NoSuchPublicAccessBlockConfiguration = no block config set → public
        results.push({ name, allBlocked: false, config: {} });
      }
    }

    const publicBuckets   = results.filter((r) => !r.allBlocked);
    const publicBucketNames = publicBuckets.map((r) => r.name);

    const evidenceData = {
      totalBuckets:   buckets.length,
      blockedBuckets: results.length - publicBuckets.length,
      publicBuckets:  publicBuckets.length,
      buckets:        results,
    };

    if (publicBuckets.length > 0) {
      return this.fail(
        { totalBuckets: buckets.length, publicBuckets: publicBuckets.length, publicBucketNames },
        'AWS S3 Public Access Block Report',
        evidenceData,
      );
    }

    return this.pass(
      { totalBuckets: buckets.length, publicBuckets: 0, allBlocked: true },
      'AWS S3 Public Access Block Report',
      evidenceData,
    );
  }
}
