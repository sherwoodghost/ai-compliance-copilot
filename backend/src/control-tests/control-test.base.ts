import { Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TestOutcome = 'pass' | 'fail' | 'error' | 'skipped';

export interface TestContext {
  orgId: string;
  prisma: PrismaService;
  /** Decrypted credentials for the connected integration (if any) */
  credentials?: Record<string, unknown>;
}

export interface TestResult {
  outcome: TestOutcome;
  details: Record<string, unknown>;
  errorMessage?: string;
  /** Evidence title — service layer creates the Evidence record */
  evidenceTitle?: string;
  /** Evidence data blob stored in metadata */
  evidenceData?: Record<string, unknown>;
}

export interface TestDefinition {
  testId: string;
  controlCode: string;
  name: string;
  description: string;
  frequencyCron: string;
  requiresConnector: string | null;
}

// ─── Abstract Base ────────────────────────────────────────────────────────────

export abstract class ControlTest {
  protected readonly logger: Logger;

  abstract readonly meta: TestDefinition;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  abstract execute(ctx: TestContext): Promise<TestResult>;

  /** Helper: wrap execution with timing + error capture */
  async run(ctx: TestContext): Promise<TestResult & { durationMs: number }> {
    const start = Date.now();
    try {
      const result = await this.execute(ctx);
      return { ...result, durationMs: Date.now() - start };
    } catch (err: any) {
      this.logger.error(`Test ${this.meta.testId} threw: ${err.message}`);
      return {
        outcome: 'error',
        details: {},
        errorMessage: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  /** Convenience: build a passing result */
  protected pass(details: Record<string, unknown>, evidenceTitle?: string, evidenceData?: Record<string, unknown>): TestResult {
    return { outcome: 'pass', details, evidenceTitle, evidenceData };
  }

  /** Convenience: build a failing result */
  protected fail(details: Record<string, unknown>, evidenceTitle?: string, evidenceData?: Record<string, unknown>): TestResult {
    return { outcome: 'fail', details, evidenceTitle, evidenceData };
  }

  protected skip(reason: string): TestResult {
    return { outcome: 'skipped', details: { reason } };
  }
}
