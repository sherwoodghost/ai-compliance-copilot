import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class ValidatorAgent extends BaseAgent {
  protected readonly agentName = 'validator';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    // ── Step 1: Load controls with their evidence and policies ──────────────
    const controlsWithEvidence = await this.recordStep(runId, 'load_controls_with_evidence', 0, { orgId }, async () => {
      const orgControls = await this.prisma.organizationControl.findMany({
        where: { orgId },
        include: { control: { include: { framework: true } } },
      });
      const cids = orgControls.map((oc) => oc.controlId);
      const [evidenceItems, policies] = await Promise.all([
        this.prisma.evidence.findMany({ where: { orgId, controlId: { in: cids }, isValid: true } }),
        this.prisma.policy.findMany({ where: { orgId, controlId: { in: cids }, status: { not: 'archived' as any } }, orderBy: { version: 'desc' } }),
      ]);
      const evMap: Record<string, any[]> = {};
      for (const e of evidenceItems) { (evMap[e.controlId] ??= []).push(e); }
      const polMap: Record<string, any> = {};
      for (const p of policies) { if (p.controlId && !polMap[p.controlId]) polMap[p.controlId] = p; }
      return orgControls.map((oc) => ({
        ...oc,
        evidence: evMap[oc.controlId] ?? [],
        policies: polMap[oc.controlId] ? [polMap[oc.controlId]] : [],
      }));
    });

    // ── Step 2: Run validation ──────────────────────────────────────────────
    const validationResults = await this.recordStep(runId, 'validate_controls', 1, {
      controlCount: (controlsWithEvidence as any[]).length,
    }, async () => {
      const controlSummaries = (controlsWithEvidence as any[]).map((oc) => ({
        controlId: oc.controlId,
        controlCode: oc.control.code,
        controlTitle: oc.control.title,
        category: oc.control.category,
        framework: oc.control.framework.type,
        guidance: oc.control.guidance,
        hasPolicy: oc.policies.length > 0,
        policyStatus: oc.policies[0]?.status ?? 'none',
        evidenceCount: oc.evidence.length,
        evidence: oc.evidence.map((e: any) => ({
          title: e.title,
          type: e.type,
          source: e.source,
          collectedAt: e.collectedAt,
          expiresAt: e.expiresAt,
        })),
      }));

      const prompt = `Validate these compliance controls for a ${businessProfile.industry} company:

COMPANY CONTEXT:
- Risk Level: ${businessProfile.riskProfile.riskLevel}
- Industry: ${businessProfile.industry}
- Data types: ${businessProfile.dataHandling.dataTypes.join(', ')}
- MFA Status: ${businessProfile.currentPosture.usesMfa}
- Has Security Team: ${businessProfile.currentPosture.hasSecurityTeam}
- Cloud providers: ${businessProfile.infrastructure.cloudProviders.join(', ')}

CONTROLS TO VALIDATE:
${JSON.stringify(controlSummaries, null, 2)}

Apply ${businessProfile.riskProfile.riskLevel === 'critical' ? 'STRICT' : businessProfile.riskProfile.riskLevel === 'high' ? 'HIGH' : 'STANDARD'} validation criteria given the risk level.

Return JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'evidence-validator', userMessage: prompt, taskType: 'evidence_validation', orgId, workflowId: jobData?.workflowId, maxTokens: 8192, requiresControlValidation: true });
      return this.llm.parseJSON<any>(response.content);
    });

    // ── Step 3: Update org control statuses in DB ───────────────────────────
    await this.recordStep(runId, 'persist_validation', 2, { orgId }, async () => {
      const results = (validationResults as any).results ?? [];
      for (const result of results) {
        const statusMap: Record<string, string> = {
          passed: 'implemented',
          partial: 'in_progress',
          failed: 'failed',
        };

        await this.prisma.organizationControl.update({
          where: { orgId_controlId: { orgId, controlId: result.controlId } },
          data: {
            status: statusMap[result.validationStatus] as any ?? 'in_progress',
            score: result.score ?? 0,
            lastReviewedAt: new Date(),
          },
        });
      }
      return { updated: results.length };
    });

    return {
      success: true,
      data: { validationResults },
      nextAgentInput: { validationResults },
    };
  }
}
