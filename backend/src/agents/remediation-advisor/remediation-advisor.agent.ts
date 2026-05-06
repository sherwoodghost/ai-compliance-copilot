import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class RemediationAdvisorAgent extends BaseAgent {
  protected readonly agentName = 'remediation-advisor';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile, inputPayload } = jobData;

    const failedControls = await this.recordStep(runId, 'load_failed_controls', 0, { orgId }, async () => {
      return this.prisma.organizationControl.findMany({
        where: { orgId, status: { in: ['failed', 'in_progress'] } },
        include: { control: { include: { framework: true } } },
        orderBy: [{ control: { weight: 'desc' } }],
        take: 15,
      });
    });

    const remediations = await this.recordStep(runId, 'generate_remediations', 1, {
      failedCount: (failedControls as any[]).length,
    }, async () => {
      const stackContext = `
TECH STACK:
- Cloud: ${businessProfile.infrastructure.cloudProviders.join(', ')}
- IDP: ${businessProfile.tools.identityProvider ?? 'none'}
- Version Control: ${businessProfile.tools.versionControl ?? 'none'}
- CI/CD: ${businessProfile.infrastructure.ciCd?.join(', ') ?? 'none'}
- Monitoring: ${businessProfile.tools.monitoring ?? 'none'}
- Secret Management: ${businessProfile.tools.secretMgmt ?? 'none'}
- IaC: ${businessProfile.infrastructure.usesTerraform ? 'Terraform' : 'none'}
- Endpoint: ${businessProfile.tools.endpointMgmt ?? 'none'}`;

      const prompt = `Generate stack-specific remediation instructions:

COMPANY: ${businessProfile.companyName}
INDUSTRY: ${businessProfile.industry}
${stackContext}

FAILED/PARTIAL CONTROLS TO REMEDIATE:
${JSON.stringify((failedControls as any[]).map((oc) => ({
  controlId: oc.controlId,
  code: oc.control.code,
  title: oc.control.title,
  category: oc.control.category,
  status: oc.status,
  guidance: oc.control.guidance,
})), null, 2)}

Generate specific, actionable steps using their actual tools. Return JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'remediation-advisor', userMessage: prompt, taskType: 'compliance', orgId, workflowId: jobData?.workflowId, maxTokens: 8192, requiresControlValidation: true });
      return this.llm.parseJSON<any>(response.content);
    });

    return {
      success: true,
      data: { remediations },
      nextAgentInput: { remediations },
    };
  }
}
