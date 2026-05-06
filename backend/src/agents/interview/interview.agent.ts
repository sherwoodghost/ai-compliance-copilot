import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class InterviewAgent extends BaseAgent {
  protected readonly agentName = 'interview';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    const weakControls = await this.recordStep(runId, 'load_weak_controls', 0, { orgId }, async () => {
      return this.prisma.organizationControl.findMany({
        where: { orgId, status: { in: ['failed', 'in_progress', 'not_started'] } },
        include: { control: { select: { code: true, title: true, category: true } } },
        take: 15,
      });
    });

    const interviewPrep = await this.recordStep(runId, 'generate_interview_questions', 1, {
      weakControlCount: (weakControls as any[]).length,
    }, async () => {
      const prompt = `Generate auditor interview questions for this company:

COMPANY PROFILE:
- Company: ${businessProfile.companyName}
- Industry: ${businessProfile.industry}
- Size: ${businessProfile.employeeCount} employees
- Frameworks: ${businessProfile.complianceGoals.frameworks.join(', ')}
- Tools: ${JSON.stringify(businessProfile.tools)}
- Data types: ${businessProfile.dataHandling.dataTypes.join(', ')}
- Risk factors: ${businessProfile.riskProfile.riskFactors.join(', ')}
- Current posture: ${JSON.stringify(businessProfile.currentPosture)}

CONTROLS WHERE THIS COMPANY IS WEAKEST:
${JSON.stringify((weakControls as any[]).map((oc) => ({ code: oc.control.code, title: oc.control.title, status: oc.status })))}

Generate realistic auditor questions. Focus on their specific weak areas.
Return JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'compliance-interview', userMessage: prompt, taskType: 'onboarding', orgId, workflowId: jobData?.workflowId, maxTokens: 6000 });
      return this.llm.parseJSON<any>(response.content);
    });

    return {
      success: true,
      data: { interviewPrep },
    };
  }
}
