import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ControlTest } from './control-test.base';

// ─── Built-in tests ──────────────────────────────────────────────────────────
// DB / logic tests (no connector needed)
import { PolicyApprovalTest }       from './tests/policy-approval.test';
import { EvidenceFreshnessTest }    from './tests/evidence-freshness.test';
import { OpenHighRisksTest }        from './tests/open-high-risks.test';
import { MfaFlagTest }              from './tests/mfa-flag.test';
import { TaskOverdueTest }          from './tests/task-overdue.test';

// GitHub tests
import { BranchProtectionTest }     from './tests/github-branch-protection.test';
import { SecretScanningTest }       from './tests/github-secret-scanning.test';
import { DependabotTest }           from './tests/github-dependabot.test';
import { OrgMfaTest }               from './tests/github-org-mfa.test';

// AWS tests
import { IamMfaTest }               from './tests/aws-iam-mfa.test';
import { IamNoRootKeysTest }        from './tests/aws-iam-no-root-keys.test';
import { S3PublicBlockTest }        from './tests/aws-s3-public-block.test';
import { IamPasswordPolicyTest }    from './tests/aws-iam-password-policy.test';

@Injectable()
export class ControlTestRegistry implements OnModuleInit {
  private readonly logger = new Logger(ControlTestRegistry.name);
  private readonly tests = new Map<string, ControlTest>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const allTests: ControlTest[] = [
      new PolicyApprovalTest(),
      new EvidenceFreshnessTest(),
      new OpenHighRisksTest(),
      new MfaFlagTest(),
      new TaskOverdueTest(),
      new BranchProtectionTest(),
      new SecretScanningTest(),
      new DependabotTest(),
      new OrgMfaTest(),
      new IamMfaTest(),
      new IamNoRootKeysTest(),
      new S3PublicBlockTest(),
      new IamPasswordPolicyTest(),
    ];

    // Register in memory
    for (const test of allTests) {
      this.tests.set(test.meta.testId, test);
    }

    // Sync definitions to DB (idempotent upsert)
    for (const test of allTests) {
      await this.prisma.controlTestDefinition.upsert({
        where: { testId: test.meta.testId },
        create: {
          testId:            test.meta.testId,
          controlCode:       test.meta.controlCode,
          name:              test.meta.name,
          description:       test.meta.description,
          frequencyCron:     test.meta.frequencyCron,
          requiresConnector: test.meta.requiresConnector,
        },
        update: {
          name:              test.meta.name,
          description:       test.meta.description,
          frequencyCron:     test.meta.frequencyCron,
          requiresConnector: test.meta.requiresConnector,
        },
      });
    }

    this.logger.log(`Registered ${allTests.length} control tests`);
  }

  get(testId: string): ControlTest | undefined {
    return this.tests.get(testId);
  }

  getAll(): ControlTest[] {
    return Array.from(this.tests.values());
  }

  getAllForConnector(provider: string): ControlTest[] {
    return this.getAll().filter((t) => t.meta.requiresConnector === provider);
  }

  getDbOnlyTests(): ControlTest[] {
    return this.getAll().filter((t) => t.meta.requiresConnector === null);
  }
}
