import { Injectable } from '@nestjs/common';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';
import { InferenceService } from '../../inference/inference.service';
import { AgentMemoryService } from '../../agent-memory/agent-memory.service';
import { AUDIT_DISCLAIMER } from '../base/agent-contract.interfaces';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';

/**
 * InferenceAgent
 *
 * Pipeline position: first stage (after onboarding, before scoping).
 *
 * Responsibilities:
 * 1. Read business profile from DB
 * 2. Run InferenceRulesService (deterministic — ZERO LLM calls for core output)
 * 3. Write results to agent memory (namespace: "inference")
 * 4. Pass structured inference output downstream as nextAgentInput
 *
 * Optionally generates LLM rationale if llm_rationale_in_inference feature is enabled.
 */
@Injectable()
export class InferenceAgent extends BaseAgent {
  protected readonly agentName = 'inference-agent';

  constructor(
    private readonly inferenceService: InferenceService,
    private readonly memory: AgentMemoryService,
    prisma: PrismaService,
    llm: LlmService,
    journeyService: ComplianceJourneyService,
    gateway: LlmGatewayService,
  ) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, workflowId } = jobData;

    // ── Step 1: Build profile input from business profile ─────────────────────
    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile) {
      throw new Error(`BusinessProfile not found for org ${orgId}`);
    }

    const profileInput = this.inferenceService.buildProfileInput(orgId, profile);

    // ── Step 2: Run deterministic inference (zero LLM) ────────────────────────
    const inferenceOutput = await this.recordStep(runId, 'run_inference_rules', 0, { orgId }, () =>
      this.inferenceService.infer(profileInput),
    );

    // ── Step 3: Write to shared memory ────────────────────────────────────────
    const memCtx = {
      organizationId: orgId,
      workflowRunId: workflowId,
      agentId: this.agentName,
    };

    await this.memory.write(memCtx, 'inference', 'inference_output', inferenceOutput, { step: 0 });
    await this.memory.write(memCtx, 'inference', 'risk_level', inferenceOutput.risk_level, { step: 0 });
    await this.memory.write(memCtx, 'inference', 'frameworks', inferenceOutput.inferred_frameworks, { step: 0 });
    await this.memory.write(memCtx, 'inference', 'required_controls', inferenceOutput.required_controls, { step: 0 });
    await this.memory.write(memCtx, 'inference', 'system_flags', inferenceOutput.system_flags, { step: 0 });

    // ── Step 4: Build downstream input ───────────────────────────────────────
    const nextAgentInput = {
      inferenceOutput,
      orgId,
      workflowId,
    };

    return {
      success: true,
      data: {
        ...inferenceOutput,
        auditDisclaimer: AUDIT_DISCLAIMER,
        agentName: this.agentName,
        runId,
      },
      nextAgentInput,
      warnings: inferenceOutput.risk_level === 'HIGH'
        ? [`High risk level detected (score: ${inferenceOutput.risk_score}) — requires immediate human review`]
        : [],
    };
  }
}
