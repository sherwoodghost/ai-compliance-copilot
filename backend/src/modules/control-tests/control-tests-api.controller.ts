import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ControlTestRunnerService } from '../../control-tests/control-test-runner.service';
import { ControlTestRegistry } from '../../control-tests/control-test.registry';
import { MonitoringService } from '../../monitoring/monitoring.service';
import { LlmService } from '../../llm/llm.service';

@ApiTags('control-tests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('control-tests')
export class ControlTestsApiController {
  private readonly logger = new Logger(ControlTestsApiController.name);

  constructor(
    private readonly runner:     ControlTestRunnerService,
    private readonly registry:   ControlTestRegistry,
    private readonly monitoring: MonitoringService,
    private readonly llm:        LlmService,
  ) {}

  /** Latest result for each test registered for this org. */
  @Get('results')
  @Roles('admin', 'auditor', 'member')
  @ApiOperation({ summary: 'Get latest control test results for the org' })
  async getResults(@CurrentUser() user: JwtPayload) {
    return this.runner.getLatestResults(user.orgId);
  }

  /** Pass/fail/skip summary with overall pass rate. */
  @Get('summary')
  @Roles('admin', 'auditor', 'member')
  @ApiOperation({ summary: 'Get control test pass rate summary' })
  async getSummary(@CurrentUser() user: JwtPayload) {
    return this.runner.getPassRateSummary(user.orgId);
  }

  /** List all registered test definitions (static metadata). */
  @Get('definitions')
  @Roles('admin', 'auditor', 'member')
  @ApiOperation({ summary: 'List all registered control test definitions' })
  async getDefinitions() {
    return this.registry.getAll().map((t) => t.meta);
  }

  /** Trigger all tests for the org immediately (queues a BullMQ job). */
  @Post('run')
  @Roles('admin', 'auditor')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger all control tests for the org (async)' })
  async runAll(@CurrentUser() user: JwtPayload) {
    const result = await this.monitoring.triggerImmediateRun(user.orgId);
    this.logger.log(`Manual test run triggered for org ${user.orgId}: ${result.queued} queued`);
    return { message: `${result.queued} tests queued`, ...result };
  }

  /** Trigger a single test for the org immediately. */
  @Post('run/:testId')
  @Roles('admin', 'auditor')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a single control test for the org (async)' })
  async runOne(@Param('testId') testId: string, @CurrentUser() user: JwtPayload) {
    await this.runner.runTest(testId, user.orgId);
    return { message: `Test ${testId} executed`, testId, orgId: user.orgId };
  }

  /** AI analysis of all failing / erroring tests with remediation guidance. */
  @Post('ai-analyze')
  @Roles('admin', 'auditor', 'member')
  @ApiOperation({ summary: 'AI: analyse failing control tests and produce remediation guidance' })
  async aiAnalyzeFailures(@CurrentUser() user: JwtPayload) {
    const latest = await this.runner.getLatestResults(user.orgId);
    const failing = latest.filter((r) => r.outcome === 'fail' || r.outcome === 'error');

    if (failing.length === 0) {
      return { message: 'All tests passing — no failures to analyse.', analyses: [] };
    }

    const testSummaries = failing.map((r) => ({
      testId:      r.testId,
      name:        r.definition?.name ?? r.testId,
      controlCode: r.definition?.controlCode ?? 'N/A',
      outcome:     r.outcome,
      details:     r.details,
      errorMessage: r.errorMessage ?? null,
      testedAt:    r.testedAt,
    }));

    const systemPrompt = `You are a DevSecOps and compliance engineer. You analyse automated control test failures and provide clear, actionable remediation guidance. Be specific and concise — no generic advice.`;

    const userPrompt = `These automated compliance control tests are failing. Analyse each failure and provide a remediation plan:

${testSummaries.map((t, i) => `
Test ${i + 1}: ${t.name} (${t.testId})
Control: ${t.controlCode}
Outcome: ${t.outcome}
Details: ${JSON.stringify(t.details, null, 2).slice(0, 500)}
${t.errorMessage ? `Error: ${t.errorMessage}` : ''}
`.trim()).join('\n\n---\n\n')}

Return ONLY a JSON array (no markdown fences), one object per test:
[
  {
    "testId": "test-id",
    "rootCause": "1-2 sentences explaining the most likely root cause of this failure",
    "remediationSteps": ["Step 1", "Step 2", "Step 3"],
    "estimatedFixTime": "e.g. '30 minutes' or '2-3 days'",
    "severity": "critical|high|medium|low",
    "quickFix": "Single most impactful immediate action under 80 chars"
  }
]`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.2 },
    );

    let analyses: any[];
    try {
      analyses = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
      if (!Array.isArray(analyses)) analyses = [];
    } catch {
      analyses = [];
    }

    const validSeverity = ['critical', 'high', 'medium', 'low'];

    // Merge AI analysis back with test metadata
    const enriched = failing.map((r) => {
      const ai = analyses.find((a) => a?.testId === r.testId) ?? {};
      return {
        testId:           r.testId,
        name:             r.definition?.name ?? r.testId,
        controlCode:      r.definition?.controlCode ?? 'N/A',
        outcome:          r.outcome,
        testedAt:         r.testedAt,
        rootCause:        String(ai.rootCause ?? '').slice(0, 300),
        remediationSteps: (Array.isArray(ai.remediationSteps) ? ai.remediationSteps : []).slice(0, 5).map(String),
        estimatedFixTime: String(ai.estimatedFixTime ?? '').slice(0, 40),
        severity:         validSeverity.includes(ai.severity) ? ai.severity : 'medium',
        quickFix:         String(ai.quickFix ?? '').slice(0, 120),
      };
    });

    return {
      failingCount: failing.length,
      analyses:     enriched,
      generatedAt:  new Date().toISOString(),
    };
  }
}
