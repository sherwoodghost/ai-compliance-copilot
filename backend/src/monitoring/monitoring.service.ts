import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../database/prisma.service';
import { ControlTestRegistry } from '../control-tests/control-test.registry';
import { ControlTestRunnerService } from '../control-tests/control-test-runner.service';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectQueue('monitoring') private readonly queue: Queue,
    private readonly prisma:   PrismaService,
    private readonly registry: ControlTestRegistry,
    private readonly runner:   ControlTestRunnerService,
  ) {}

  async onModuleInit() {
    // Schedule repeatable jobs for all tests across all active orgs
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });

    for (const org of orgs) {
      await this.scheduleAllTestsForOrg(org.id);
    }

    this.logger.log(`Monitoring jobs scheduled for ${orgs.length} orgs`);
  }

  /**
   * Called after a new org completes onboarding to start their monitoring schedule.
   */
  async onOrgOnboarded(orgId: string): Promise<void> {
    await this.scheduleAllTestsForOrg(orgId);
    this.logger.log(`Monitoring schedule created for new org ${orgId}`);
  }

  /**
   * Schedule all control tests as repeatable BullMQ jobs for a given org.
   * Uses each test's `frequencyCron` — default is every 6 hours.
   * Job IDs are stable so duplicate schedules are idempotent.
   */
  async scheduleAllTestsForOrg(orgId: string): Promise<void> {
    for (const test of this.registry.getAll()) {
      const jobId = `${test.meta.testId}--${orgId}`;

      await this.queue.add(
        'run-test',
        { testId: test.meta.testId, orgId },
        {
          repeat:         { cron: test.meta.frequencyCron },
          jobId,
          removeOnComplete: 50,   // keep last 50 completed jobs
          removeOnFail:     20,
        },
      );
    }
  }

  /**
   * Manually trigger all tests for an org immediately (e.g. from dashboard).
   */
  async triggerImmediateRun(orgId: string): Promise<{ queued: number }> {
    const tests  = this.registry.getAll();

    for (const test of tests) {
      await this.queue.add('run-test', { testId: test.meta.testId, orgId });
    }

    return { queued: tests.length };
  }

  /**
   * Get the monitoring queue stats.
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
