import { Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { LlmGatewayService, LlmGatewayRequest } from '../../llm-gateway/llm-gateway.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { AgentJobData, AgentOutput, AgentJobDataSchema } from './agent.interfaces';

export abstract class BaseAgent {
  protected abstract readonly agentName: string;
  protected readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly llm: LlmService,
    protected readonly journeyService?: ComplianceJourneyService,
    protected readonly gateway?: LlmGatewayService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  // ─── Main execution entry point ─────────────────────────────────────────────
  async execute(jobData: AgentJobData): Promise<AgentOutput> {
    // ── Runtime input validation (Zod) ──────────────────────────────────────
    const parsed = AgentJobDataSchema.safeParse(jobData);
    if (!parsed.success) {
      const issues = (parsed.error as ZodError).issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      this.logger.error(`[${this.agentName}] Invalid job data: ${issues}`);
      throw new Error(`Agent job data validation failed: ${issues}`);
    }

    const startedAt = new Date();
    let runId = jobData.runId;

    // Emit enqueued event
    await this.recordEvent(jobData, 'job_started', { startedAt: startedAt.toISOString() });

    if (!runId) {
      const run = await this.prisma.agentRun.create({
        data: {
          workflowId: jobData.workflowId,
          orgId: jobData.orgId,
          agentName: this.agentName,
          status: 'running',
          inputPayload: jobData.inputPayload as any,
          startedAt,
        },
      });
      runId = run.id;
    } else {
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: { status: 'running', startedAt },
      });
    }

    this.logger.log(`[${this.agentName}] Starting | run: ${runId} | org: ${jobData.orgId} | journey: ${jobData.journeyId}`);

    try {
      const output = await this.process(jobData, runId);
      const durationMs = Date.now() - startedAt.getTime();

      await this.prisma.agentRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          outputPayload: output.data as any,
          completedAt: new Date(),
          durationMs,
        },
      });

      // Write to compliance journey — central state
      if (this.journeyService && jobData.journeyId) {
        await this.journeyService.recordAgentOutput(
          jobData.journeyId,
          this.agentName,
          output.data,
          durationMs,
        );

        // Check if this agent should trigger a human checkpoint
        const needsCheckpoint = await this.journeyService.shouldCreateCheckpoint(
          jobData.journeyId,
          this.agentName,
        );

        if (needsCheckpoint) {
          await this.createCheckpointFromOutput(jobData, output);
        }
      }

      await this.recordEvent(jobData, 'job_completed', { durationMs, runId });

      this.logger.log(`[${this.agentName}] Completed | ${durationMs}ms | run: ${runId}`);
      return { ...output, runId } as any;
    } catch (error: any) {
      const durationMs = Date.now() - startedAt.getTime();

      await this.prisma.agentRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
          durationMs,
          retryCount: { increment: 1 },
        },
      });

      await this.recordEvent(jobData, 'job_failed', { error: error.message, durationMs, runId });

      this.logger.error(`[${this.agentName}] Failed | run: ${runId} | ${error.message}`);
      throw error;
    }
  }

  // ─── Each agent implements this ─────────────────────────────────────────────
  protected abstract process(jobData: AgentJobData, runId: string): Promise<AgentOutput>;

  // ─── Record an individual step (full replay support) ────────────────────────
  protected async recordStep(
    runId: string,
    stepName: string,
    stepIndex: number,
    input: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executeFn: () => Promise<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const step = await this.prisma.agentStep.create({
      data: {
        runId,
        stepName,
        stepIndex,
        status: 'running',
        inputSnapshot: input as any,
        startedAt: new Date(),
      },
    });

    try {
      const output = await executeFn();
      await this.prisma.agentStep.update({
        where: { id: step.id },
        data: {
          status: 'completed',
          outputSnapshot: output as any,
          completedAt: new Date(),
          durationMs: Date.now() - step.startedAt!.getTime(),
        },
      });
      return output;
    } catch (error: any) {
      await this.prisma.agentStep.update({
        where: { id: step.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  // ─── LLM helper (legacy path — direct to LlmService) ───────────────────────
  protected async callLLM(
    runId: string,
    systemPrompt: string,
    userPrompt: string,
    options: { maxTokens?: number; temperature?: number } = {},
  ) {
    const response = await this.llm.completeWithRetry(
      [{ role: 'user', content: userPrompt }],
      {
        agentName: this.agentName,
        systemPrompt,
        maxTokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
      },
    );

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        llmTokensUsed: { increment: response.tokensIn + response.tokensOut },
        llmCostUsd: { increment: response.costUsd },
      },
    });

    return response;
  }

  // ─── LLM gateway helper (preferred path — uses compliance-aware gateway) ─────
  protected async callGateway(
    runId: string,
    request: Omit<LlmGatewayRequest, 'agentRunId'>,
  ) {
    // If gateway not injected, fall through to legacy LLM call
    if (!this.gateway) {
      this.logger.warn(`[${this.agentName}] LlmGatewayService not injected — falling back to LlmService`);
      const template = { systemPrompt: '', userMessage: request.userMessage ?? '' };
      return this.callLLM(runId, template.systemPrompt, template.userMessage, {
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });
    }

    const response = await this.gateway.call({
      ...request,
      agentRunId: runId,
      agentName: request.agentName ?? this.agentName,
    });

    // Keep agent_runs token/cost tracking in sync
    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        llmTokensUsed: { increment: (response.inputTokens ?? 0) + (response.outputTokens ?? 0) },
        llmCostUsd: { increment: 0 }, // cost tracked in llm_calls table
      },
    });

    return { content: response.content, tokensIn: response.inputTokens, tokensOut: response.outputTokens, costUsd: 0 };
  }

  // ─── Record an agent event for traceability ──────────────────────────────────
  private async recordEvent(
    jobData: AgentJobData,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.agentEvent.create({
        data: {
          orgId: jobData.orgId,
          workflowId: jobData.workflowId,
          journeyId: jobData.journeyId,
          agentName: this.agentName,
          eventType: eventType as any,
          payload: payload as any,
        },
      });
    } catch {
      // Non-blocking — don't fail the agent if event logging fails
    }
  }

  // ─── Create checkpoint from agent output ────────────────────────────────────
  private async createCheckpointFromOutput(
    jobData: AgentJobData,
    output: AgentOutput,
  ): Promise<void> {
    if (!this.journeyService) return;

    const checkpointTypeMap: Record<string, string> = {
      onboarding: 'after_onboarding',
      policy: 'after_policy_generation',
      audit: 'before_audit',
    };

    const checkpointType = checkpointTypeMap[this.agentName] ?? 'manual';

    const summary = (output.data.summary as string) ??
      `${this.agentName} agent completed. Human review required before proceeding.`;

    const findings = (output.data.findings as unknown[]) ?? [];
    const risks = (output.data.risks as unknown[]) ?? [];
    const uncertainties = (output.data.uncertainties as unknown[]) ?? output.warnings?.map((w) => ({ message: w })) ?? [];

    await this.journeyService.createCheckpoint(
      jobData.journeyId,
      jobData.orgId,
      jobData.workflowId,
      this.agentName,
      checkpointType,
      summary,
      findings,
      risks,
      uncertainties,
      {
        agentName: this.agentName,
        outputKeys: Object.keys(output.data),
        isReplay: jobData.isReplay ?? false,
      },
    );
  }
}
