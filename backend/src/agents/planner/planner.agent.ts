import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class PlannerAgent extends BaseAgent {
  protected readonly agentName = 'planner';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    // ── Step 1: Load org controls ──────────────────────────────────────────
    const controls = await this.recordStep(runId, 'load_controls', 0, { orgId }, async () => {
      const frameworkNames = businessProfile.complianceGoals.frameworks ?? ['soc2'];

      const orgControls = await this.prisma.organizationControl.findMany({
        where: {
          orgId,
          control: {
            framework: {
              type: { in: frameworkNames.map((f) => f.toUpperCase() as any) },
            },
          },
        },
        include: {
          control: {
            include: { framework: { select: { name: true, type: true } } },
          },
        },
      });

      return {
        total: orgControls.length,
        controls: orgControls.map((oc) => ({
          controlId: oc.controlId,
          code: oc.control.code,
          title: oc.control.title,
          category: oc.control.category,
          weight: oc.control.weight,
          framework: oc.control.framework.type,
          status: oc.status,
        })),
      };
    });

    // ── Step 2: Generate roadmap via LLM ─────────────────────────────────
    const roadmap = await this.recordStep(runId, 'generate_roadmap', 1, {
      controlCount: (controls as any).total,
    }, async () => {
      const prompt = `Generate a compliance roadmap for this company:

BUSINESS PROFILE:
${JSON.stringify(businessProfile, null, 2)}

CONTROLS TO PLAN (${(controls as any).total} total):
${JSON.stringify((controls as any).controls, null, 2)}

Create a phased roadmap. Prioritize based on:
1. Risk level: ${businessProfile.riskProfile.riskLevel}
2. Risk factors: ${businessProfile.riskProfile.riskFactors.join(', ')}
3. Team size: ${businessProfile.employeeCount} employees, ${businessProfile.engineeringCount ?? 'unknown'} engineers
4. Current posture: MFA=${businessProfile.currentPosture.usesMfa}, Security team=${businessProfile.currentPosture.hasSecurityTeam}
5. Compliance driver: ${businessProfile.complianceGoals.driver ?? 'not specified'}
6. Target date: ${businessProfile.complianceGoals.targetDate ?? 'not specified'}

For industry "${businessProfile.industry}", focus especially on: ${this.getIndustryFocus(businessProfile.industry)}

Return valid JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'compliance-roadmap', userMessage: prompt, taskType: 'compliance', orgId, workflowId: jobData?.workflowId, maxTokens: 8192, requiresControlValidation: true });
      const parsed = this.llm.parseJSON<any>(response.content);
      return parsed;
    });

    // ── Step 3: Save roadmap as workflow output ────────────────────────────
    await this.recordStep(runId, 'persist_roadmap', 2, { orgId }, async () => {
      if (jobData.workflowId) {
        await this.prisma.workflow.update({
          where: { id: jobData.workflowId },
          data: {
            outputPayload: {
              plannerOutput: roadmap,
            } as any,
          },
        });
      }
      return { saved: true };
    });

    return {
      success: true,
      data: { roadmap },
      nextAgentInput: {
        roadmap,
        controls: (controls as any).controls,
      },
    };
  }

  private getIndustryFocus(industry: string): string {
    const focusMap: Record<string, string> = {
      fintech: 'financial data controls, encryption, and fraud prevention',
      healthcare: 'PHI protection, access controls, and audit logging',
      saas: 'logical access, change management, and availability',
      ecommerce: 'payment card data, customer PII, and availability',
      edtech: 'student data protection and access controls',
    };
    return focusMap[industry] ?? 'logical access and risk management';
  }
}
