import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

const LIKELIHOOD_SCORES: Record<string, number> = {
  rare: 1, unlikely: 2, possible: 3, likely: 4, almost_certain: 5,
};
const IMPACT_SCORES: Record<string, number> = {
  negligible: 1, minor: 2, moderate: 3, major: 4, catastrophic: 5,
};

@Injectable()
export class RiskScoringAgent extends BaseAgent {
  protected readonly agentName = 'risk-scoring';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    const failedControls = await this.recordStep(runId, 'load_failed_controls', 0, { orgId }, async () => {
      return this.prisma.organizationControl.findMany({
        where: { orgId, status: { in: ['failed', 'in_progress', 'not_started'] } },
        include: { control: { include: { framework: true } } },
      });
    });

    const scoredRisks = await this.recordStep(runId, 'score_risks', 1, {
      controlCount: (failedControls as any[]).length,
    }, async () => {
      const response = await this.callGateway(runId, {
        promptTemplateId: 'risk-register',
        userMessage: `Company: ${businessProfile.companyName}, Industry: ${businessProfile.industry}, Risk factors: ${businessProfile.riskProfile.riskFactors.join(', ')}
Failed/partial controls: ${JSON.stringify((failedControls as any[]).map((c) => ({ controlId: c.controlId, code: c.control.code, status: c.status })))}`,
        taskType: 'risk',
        orgId,
        workflowId: jobData?.workflowId,
        maxTokens: 3000,
        requiresControlValidation: true,
      });

      return this.llm.parseJSON<any>(response.content);
    });

    // Persist risk items
    await this.recordStep(runId, 'persist_risk_items', 2, { orgId }, async () => {
      const risks = (scoredRisks as any).risks ?? [];
      for (const risk of risks) {
        const riskScore =
          (LIKELIHOOD_SCORES[risk.likelihood] ?? 3) *
          (IMPACT_SCORES[risk.impact] ?? 3) *
          (risk.industryMultiplier ?? 1);

        const rounded = Math.round(riskScore);
        const severity =
          rounded >= 20 ? 'critical' :
          rounded >= 12 ? 'high' :
          rounded >= 6 ? 'medium' : 'low';

        const existing = await this.prisma.riskItem.findFirst({
          where: { orgId, controlId: risk.controlId, status: 'open' },
        });

        await this.prisma.riskItem.upsert({
          where: { id: existing?.id ?? 'new' },
          create: {
            orgId,
            controlId: risk.controlId,
            title: `Risk: ${risk.controlCode} control gap`,
            description: risk.rationale,
            likelihood: risk.likelihood,
            impact: risk.impact,
            riskScore: rounded,
            severity,
            status: 'open',
            identifiedBy: 'agent',
          },
          update: {
            likelihood: risk.likelihood,
            impact: risk.impact,
            riskScore: rounded,
            severity,
          },
        });
      }
      return { upserted: risks.length };
    });

    return {
      success: true,
      data: { scoredRisks },
      nextAgentInput: { scoredRisks },
    };
  }
}
