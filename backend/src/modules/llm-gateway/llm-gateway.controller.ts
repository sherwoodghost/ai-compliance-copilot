import { Controller, Get, Param, Post, Body, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PromptRegistryService } from '../../llm-gateway/prompt-registry.service';
import { EvalHarnessService } from '../../llm-gateway/eval/eval-harness.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('llm')
@UseGuards(JwtAuthGuard)
export class LlmGatewayController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly evalHarness: EvalHarnessService,
    private readonly gateway: LlmGatewayService,
  ) {}

  // ── LLM Call Logs ─────────────────────────────────────────────────────────

  @Get('calls')
  async listCalls(@Req() req: any) {
    return this.prisma.llmCall.findMany({
      where: { orgId: req.user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, taskType: true, promptTemplateId: true, promptTemplateVersion: true,
        model: true, inputTokens: true, outputTokens: true, costUsd: true, latencyMs: true,
        schemaValid: true, controlIdsValid: true, hallucinationDetected: true,
        forbiddenLanguageDetected: true, retryCount: true, createdAt: true,
      },
    });
  }

  @Get('calls/:id')
  async getCall(@Param('id') id: string) {
    return this.prisma.llmCall.findUnique({
      where: { id },
      include: { retrievalSources: true, evalResult: true },
    });
  }

  @Get('calls/:id/replay')
  async replayCall(@Param('id') id: string) {
    const call = await this.prisma.llmCall.findUnique({ where: { id } });
    if (!call) throw new NotFoundException(`LLM call ${id} not found`);

    const result = await this.gateway.call({
      promptTemplateId: call.promptTemplateId ?? 'gap-analysis',
      promptTemplateVersion: call.promptTemplateVersion ?? 'v1',
      orgId: call.orgId ?? undefined,
      agentName: call.taskType ?? undefined,
      taskType: (call.taskType as any) ?? 'generic',
      workflowId: call.workflowId ?? undefined,
      model: call.model ?? undefined,
    });

    return {
      originalCallId: id,
      newCallId: result.llmCallId,
      content: result.content,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  }

  // ── Prompt Registry ────────────────────────────────────────────────────────

  @Get('prompts')
  async listPrompts() {
    return this.promptRegistry.listAll().map((t) => ({
      templateId: t.templateId,
      version: t.version,
      agentName: t.agentName,
      taskType: t.taskType,
      purpose: t.purpose,
      inputVariables: t.inputVariables,
      contentHash: t.contentHash,
    }));
  }

  @Get('prompts/:templateId/:version')
  async getPrompt(
    @Param('templateId') templateId: string,
    @Param('version') version: string,
  ) {
    return this.promptRegistry.get(templateId, version);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  @Get('stats')
  async getStats(@Req() req: any) {
    const [total, hallucinations, forbidden, totalCost] = await Promise.all([
      this.prisma.llmCall.count({ where: { orgId: req.user.orgId } }),
      this.prisma.llmCall.count({ where: { orgId: req.user.orgId, hallucinationDetected: true } }),
      this.prisma.llmCall.count({ where: { orgId: req.user.orgId, forbiddenLanguageDetected: true } }),
      this.prisma.llmCall.aggregate({
        where: { orgId: req.user.orgId },
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      }),
    ]);

    return {
      totalCalls: total,
      hallucinationsDetected: hallucinations,
      forbiddenLanguageBlocked: forbidden,
      totalCostUsd: totalCost._sum.costUsd ?? 0,
      totalInputTokens: totalCost._sum.inputTokens ?? 0,
      totalOutputTokens: totalCost._sum.outputTokens ?? 0,
    };
  }

  // ── Eval Harness ──────────────────────────────────────────────────────────

  @Get('evals')
  async listEvalCases(@Query('agent') agent?: string) {
    return {
      cases: this.evalHarness.listGoldenCases(agent),
    };
  }

  @Post('evals/run')
  async runEval(@Body() body: { agent?: string; mode?: 'static' | 'online' }) {
    if (body.mode === 'online') {
      return this.evalHarness.runOnlinEval();
    }
    return this.evalHarness.runStaticEval(body.agent);
  }

  @Get('evals/results')
  async listEvalResults() {
    return this.prisma.llmEvalResult.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
