import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class GapAnalysisAgent extends BaseAgent {
  protected readonly agentName = 'gap-analysis';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    const controls = await this.recordStep(runId, 'load_controls', 0, { orgId }, async () => {
      const orgControls = await this.prisma.organizationControl.findMany({
        where: { orgId },
        include: { control: { include: { framework: true } } },
      });
      // Enrich with evidence and policy counts via separate queries
      const controlIds = orgControls.map((oc) => oc.controlId);
      const [evidenceCounts, policyCounts] = await Promise.all([
        this.prisma.evidence.groupBy({ by: ['controlId'], where: { orgId, controlId: { in: controlIds }, isValid: true }, _count: true }),
        this.prisma.policy.groupBy({ by: ['controlId'], where: { orgId, controlId: { in: controlIds }, status: { not: 'archived' as any } }, _count: true }),
      ]);
      const evMap = Object.fromEntries(evidenceCounts.map((e) => [e.controlId, e._count]));
      const polMap = Object.fromEntries(policyCounts.map((p) => [p.controlId, p._count]));
      return orgControls.map((oc) => ({ ...oc, evidenceCount: evMap[oc.controlId] ?? 0, policyCount: polMap[oc.controlId] ?? 0 }));
    });

    const gapAnalysis = await this.recordStep(runId, 'analyze_gaps', 1, {
      controlCount: (controls as any[]).length,
    }, async () => {
      const controlData = (controls as any[]).map((oc) => ({
        controlId: oc.controlId,
        code: oc.control.code,
        title: oc.control.title,
        category: oc.control.category,
        status: oc.status,
        score: oc.score,
        hasPolicy: oc.policyCount > 0,
        evidenceCount: oc.evidenceCount,
      }));

      const prompt = `Perform a detailed gap analysis for this company:

BUSINESS PROFILE:
${JSON.stringify(businessProfile, null, 2)}

CURRENT CONTROL STATE:
${JSON.stringify(controlData, null, 2)}

Focus on:
- Industry-specific requirements for ${businessProfile.industry}
- Risk factors: ${businessProfile.riskProfile.riskFactors.join(', ')}
- Data types handled: ${businessProfile.dataHandling.dataTypes.join(', ')}

Return JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'gap-analysis', userMessage: prompt, taskType: 'compliance', orgId, workflowId: jobData?.workflowId, maxTokens: 6000, requiresControlValidation: true });
      return this.llm.parseJSON<any>(response.content);
    });

    return {
      success: true,
      data: { gapAnalysis },
      nextAgentInput: { gapAnalysis },
    };
  }
}
