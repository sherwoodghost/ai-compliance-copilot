import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SecretManagerService } from '../integrations/secret-manager.service';
import { ResendService } from '../notifications/resend.service';
import { ControlTestRegistry } from './control-test.registry';
import { ControlTest, TestResult } from './control-test.base';

@Injectable()
export class ControlTestRunnerService {
  private readonly logger = new Logger(ControlTestRunnerService.name);

  constructor(
    private readonly registry:       ControlTestRegistry,
    private readonly prisma:         PrismaService,
    private readonly secretManager:  SecretManagerService,
    private readonly resend:         ResendService,
  ) {}

  /** Run a single test for an org and persist the result. */
  async runTest(testId: string, orgId: string): Promise<void> {
    const test = this.registry.get(testId);
    if (!test) throw new NotFoundException(`Test ${testId} not found in registry`);

    let credentials: Record<string, unknown> | undefined;

    if (test.meta.requiresConnector) {
      const integration = await this.prisma.integration.findUnique({
        where: { orgId_provider: { orgId, provider: test.meta.requiresConnector as any } },
      });

      if (!integration || integration.status !== 'connected') {
        this.logger.debug(`Skipping ${testId} for org ${orgId} — connector not connected`);
        await this.persistResult(orgId, test, {
          outcome:    'skipped',
          details:    { reason: `Connector '${test.meta.requiresConnector}' not connected` },
          durationMs: 0,
        });
        return;
      }

      credentials = this.secretManager.safeDecrypt(integration.credentials as any);
    }

    this.logger.log(`Running test ${testId} for org ${orgId}`);
    const result = await test.run({ orgId, prisma: this.prisma, credentials });
    this.logger.log(`Test ${testId} → ${result.outcome} (${result.durationMs}ms)`);

    await this.persistResult(orgId, test, result);

    // Fire failure alert email to org admins
    if (result.outcome === 'fail') {
      await this.notifyTestFailure(orgId, test.meta.testId, test.meta.name, result.details);
    }
  }

  /** Run all registered tests for an org. */
  async runAllForOrg(orgId: string): Promise<{ ran: number; skipped: number }> {
    const allTests = this.registry.getAll();
    let ran = 0, skipped = 0;

    for (const test of allTests) {
      try {
        await this.runTest(test.meta.testId, orgId);
        ran++;
      } catch (err: any) {
        this.logger.error(`Test ${test.meta.testId} failed for org ${orgId}: ${err.message}`);
        skipped++;
      }
    }

    return { ran, skipped };
  }

  /** Get the latest result for each test for an org (deduplicated). */
  async getLatestResults(orgId: string) {
    const results = await this.prisma.controlTestResult.findMany({
      where:   { orgId },
      orderBy: { testedAt: 'desc' },
      include: { definition: true },
    });

    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.testId)) return false;
      seen.add(r.testId);
      return true;
    });
  }

  /** Aggregate pass/fail/skip counts with overall pass rate. */
  async getPassRateSummary(orgId: string) {
    const latest = await this.getLatestResults(orgId);

    const pass    = latest.filter((r) => r.outcome === 'pass').length;
    const fail    = latest.filter((r) => r.outcome === 'fail').length;
    const error   = latest.filter((r) => r.outcome === 'error').length;
    const skipped = latest.filter((r) => r.outcome === 'skipped').length;
    const total   = latest.length;

    return { pass, fail, error, skipped, total, passRate: total > 0 ? Math.round((pass / total) * 100) : 0 };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async persistResult(
    orgId:  string,
    test:   ControlTest,
    result: TestResult & { durationMs: number },
  ): Promise<void> {
    let evidenceId: string | undefined;

    if (result.outcome !== 'skipped' && result.evidenceTitle) {
      try {
        const control = await this.prisma.control.findFirst({ where: { code: test.meta.controlCode } });

        if (control) {
          const orgControl = await this.prisma.organizationControl.findFirst({
            where: { orgId, controlId: control.id },
          });

          const evidence = await this.prisma.evidence.create({
            data: {
              orgId,
              controlId:   control.id,
              title:       result.evidenceTitle,
              type:        'api_response',
              source:      'agent_generated',
              isValid:     result.outcome === 'pass',
              metadata:    (result.evidenceData ?? {}) as any,
              collectedAt: new Date(),
            },
          });

          evidenceId = evidence.id;

          // Suppress unused variable warning — orgControl used for context only
          void orgControl;
        }
      } catch (err: any) {
        this.logger.warn(`Could not create evidence for ${test.meta.testId}: ${err.message}`);
      }
    }

    await this.prisma.controlTestResult.create({
      data: {
        orgId,
        testId:       test.meta.testId,
        controlCode:  test.meta.controlCode,
        outcome:      result.outcome as any,
        details:      result.details as any,
        errorMessage: result.errorMessage,
        durationMs:   result.durationMs,
        evidenceId,
        testedAt:     new Date(),
      },
    });
  }

  private async notifyTestFailure(
    orgId:    string,
    testId:   string,
    testName: string,
    details:  Record<string, unknown>,
  ): Promise<void> {
    try {
      // Look up org admins with email
      const [org, admins] = await Promise.all([
        this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        this.prisma.user.findMany({
          where: { orgId, role: 'admin' },
          select: { email: true },
        }),
      ]);

      for (const admin of admins) {
        await this.resend.sendTestFailureAlert({
          to:      admin.email,
          orgName: org?.name ?? orgId,
          testId,
          testName,
          details,
        });
      }
    } catch (err: any) {
      this.logger.warn(`Could not send failure alert for ${testId}: ${err.message}`);
    }
  }
}
