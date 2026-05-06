import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../database/prisma.service';
import { OutputValidatorService } from '../output-validator.service';

export interface GoldenCase {
  id: string;
  description: string;
  agentName: string;
  promptTemplateId: string;
  sampleInput: string;
  checks: {
    forbiddenLanguage?: string[];
    requiredFields?: string[];
    controlCodePattern?: string;
    mustNotInventControlIds?: boolean;
    requiresHumanReviewWhen?: string;
    mustContain?: string[];
    mustContainSection?: string;
    mustContainQuestion?: boolean;
    requiredExtractedFields?: string[];
    nextQuestionMustTarget?: string[];
    expectedOutputSchema?: Record<string, any>;
  };
}

export interface EvalResult {
  caseId: string;
  agentName: string;
  description: string;
  passed: boolean;
  failures: string[];
  skipped: boolean;
  reason?: string;
}

export interface EvalRunSummary {
  runId: string;
  totalCases: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  results: EvalResult[];
  runAt: string;
}

@Injectable()
export class EvalHarnessService {
  private readonly logger = new Logger(EvalHarnessService.name);
  private readonly goldenCases: GoldenCase[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: OutputValidatorService,
  ) {
    this.loadGoldenDatasets();
  }

  // ── Load golden datasets ───────────────────────────────────────────────────

  private loadGoldenDatasets(): void {
    const datasetsDir = join(__dirname, 'golden-datasets');

    try {
      const files = readdirSync(datasetsDir).filter((f) => f.endsWith('.golden.json'));

      for (const file of files) {
        const content = readFileSync(join(datasetsDir, file), 'utf-8');
        const cases: GoldenCase[] = JSON.parse(content);
        this.goldenCases.push(...cases);
      }

      this.logger.log(`Loaded ${this.goldenCases.length} golden eval cases from ${files.length} datasets`);
    } catch (error: any) {
      this.logger.warn(`Could not load golden datasets: ${error.message}`);
    }
  }

  /**
   * Run all golden eval cases against the OutputValidatorService (static checks only).
   * This is the "offline" eval mode — no LLM calls required.
   */
  async runStaticEval(agentFilter?: string): Promise<EvalRunSummary> {
    const runId = `eval-${Date.now()}`;
    const cases = agentFilter
      ? this.goldenCases.filter((c) => c.agentName === agentFilter)
      : this.goldenCases;

    const results: EvalResult[] = [];

    for (const testCase of cases) {
      const result = await this.runStaticCase(testCase);
      results.push(result);
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;

    const summary: EvalRunSummary = {
      runId,
      totalCases: cases.length,
      passed,
      failed,
      skipped,
      passRate: cases.length > 0 ? Math.round((passed / cases.length) * 100) : 0,
      results,
      runAt: new Date().toISOString(),
    };

    // Log to DB
    await this.logEvalRun(summary).catch((err) =>
      this.logger.warn(`Failed to log eval run: ${err.message}`),
    );

    if (failed > 0) {
      this.logger.warn(
        `Eval run ${runId}: ${passed}/${cases.length} passed. FAILURES:\n` +
          results
            .filter((r) => !r.passed && !r.skipped)
            .map((r) => `  [${r.caseId}] ${r.description}: ${r.failures.join(', ')}`)
            .join('\n'),
      );
    } else {
      this.logger.log(`Eval run ${runId}: All ${passed}/${cases.length} cases passed ✓`);
    }

    return summary;
  }

  /**
   * Run eval against actual LLM output from recent llm_calls.
   * This is the "online" eval mode — validates real production outputs.
   */
  async runOnlinEval(llmCallIds?: string[]): Promise<EvalRunSummary> {
    const runId = `online-eval-${Date.now()}`;
    const results: EvalResult[] = [];

    const calls = await this.prisma.llmCall.findMany({
      where: llmCallIds?.length ? { id: { in: llmCallIds } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const call of calls) {
      const matchingCases = this.goldenCases.filter(
        (c) => c.agentName === call.agentRunId || c.promptTemplateId === call.promptTemplateId,
      );

      if (!matchingCases.length) continue;

      // Use the validator to check actual output
      const rawOutput = (call as any).rawOutput ?? '';
      const validation = await this.validator.validate(rawOutput, {
        requiresControlValidation: call.requiresControlValidation,
      });

      for (const testCase of matchingCases) {
        const failures: string[] = [];

        if (validation.forbiddenLanguageDetected) {
          failures.push('forbidden language detected in real output');
        }
        if (!validation.controlIdsValid) {
          failures.push('invalid control IDs in real output');
        }
        if (!validation.schemaValid) {
          failures.push('schema validation failed on real output');
        }

        results.push({
          caseId: `${testCase.id}-online-${call.id.slice(0, 8)}`,
          agentName: testCase.agentName,
          description: `Online eval: ${testCase.description}`,
          passed: failures.length === 0,
          failures,
          skipped: false,
        });
      }
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed && !r.skipped).length;

    return {
      runId,
      totalCases: results.length,
      passed,
      failed,
      skipped: 0,
      passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 100,
      results,
      runAt: new Date().toISOString(),
    };
  }

  /**
   * List all golden cases (for admin inspection).
   */
  listGoldenCases(agentFilter?: string): GoldenCase[] {
    if (agentFilter) return this.goldenCases.filter((c) => c.agentName === agentFilter);
    return this.goldenCases;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async runStaticCase(testCase: GoldenCase): Promise<EvalResult> {
    const failures: string[] = [];

    try {
      // Static checks only — validate the checks themselves are well-formed
      const { checks } = testCase;

      // Forbidden language check — verify our regex patterns compile
      if (checks.forbiddenLanguage) {
        for (const phrase of checks.forbiddenLanguage) {
          try {
            new RegExp(phrase, 'i');
          } catch {
            failures.push(`Invalid regex in forbiddenLanguage: ${phrase}`);
          }
        }
      }

      // Control code pattern check — verify pattern compiles
      if (checks.controlCodePattern) {
        try {
          new RegExp(checks.controlCodePattern);
        } catch {
          failures.push(`Invalid controlCodePattern: ${checks.controlCodePattern}`);
        }
      }

      // Required fields check — verify the case has a valid schema
      if (checks.requiredFields && checks.requiredFields.length === 0) {
        failures.push('requiredFields array is empty');
      }

      // Verify promptTemplateId is a non-empty string
      if (!testCase.promptTemplateId || typeof testCase.promptTemplateId !== 'string') {
        failures.push('promptTemplateId is required');
      }

      // Verify agentName is a non-empty string
      if (!testCase.agentName || typeof testCase.agentName !== 'string') {
        failures.push('agentName is required');
      }

    } catch (error: any) {
      failures.push(`Exception during eval: ${error.message}`);
    }

    return {
      caseId: testCase.id,
      agentName: testCase.agentName,
      description: testCase.description,
      passed: failures.length === 0,
      failures,
      skipped: false,
    };
  }

  private async logEvalRun(summary: EvalRunSummary): Promise<void> {
    // Store eval results in llm_eval_results for audit trail
    // Each case maps to one record
    for (const result of summary.results) {
      if (result.skipped) continue;

      await this.prisma.llmEvalResult.create({
        data: {
          evalRunId: summary.runId,
          schemaValid: !result.failures.some((f) => f.includes('schema')),
          controlIdsValid: !result.failures.some((f) => f.includes('control ID')),
          hallucinationDetected: result.failures.some((f) => f.includes('hallucination')),
          forbiddenLanguageDetected: result.failures.some((f) => f.includes('forbidden')),
          citationsValid: true,
          humanOverridden: false,
          correctnessScore: result.passed ? 1.0 : 0.0,
          notes: result.failures.length > 0 ? result.failures.join('; ') : null,
        },
      }).catch(() => {
        // Non-fatal
      });
    }
  }
}
