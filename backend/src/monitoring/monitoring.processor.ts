import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { ControlTestRunnerService } from '../control-tests/control-test-runner.service';

export interface RunTestJobData {
  testId: string;
  orgId:  string;
}

export interface RunAllJobData {
  orgId: string;
}

@Processor('monitoring')
export class MonitoringProcessor {
  private readonly logger = new Logger(MonitoringProcessor.name);

  constructor(private readonly runner: ControlTestRunnerService) {}

  /** Run a single control test for an org. */
  @Process('run-test')
  async handleRunTest(job: Job<RunTestJobData>) {
    const { testId, orgId } = job.data;
    this.logger.log(`Running test ${testId} for org ${orgId}`);
    await this.runner.runTest(testId, orgId);
  }

  /** Run all control tests for an org (manual trigger or scheduled). */
  @Process('run-all')
  async handleRunAll(job: Job<RunAllJobData>) {
    const { orgId } = job.data;
    this.logger.log(`Running all tests for org ${orgId}`);
    const { ran, skipped } = await this.runner.runAllForOrg(orgId);
    this.logger.log(`Completed: ${ran} ran, ${skipped} skipped for org ${orgId}`);
    return { ran, skipped };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Monitoring job ${job.name} failed: ${error.message}`);
  }
}
