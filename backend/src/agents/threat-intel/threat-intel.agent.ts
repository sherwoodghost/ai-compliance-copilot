import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

@Injectable()
export class ThreatIntelAgent extends BaseAgent {
  protected readonly agentName = 'threat-intel';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    const threatAnalysis = await this.recordStep(runId, 'analyze_threats', 0, {
      industry: businessProfile.industry,
      stack: businessProfile.infrastructure.cloudProviders,
    }, async () => {
      const response = await this.callGateway(runId, {
        promptTemplateId: 'threat-intel',
        userMessage: `Company tech stack:
- Cloud: ${businessProfile.infrastructure.cloudProviders.join(', ')}
- IDP: ${businessProfile.tools.identityProvider ?? 'none'}
- Version control: ${businessProfile.tools.versionControl ?? 'none'}
- Monitoring: ${businessProfile.tools.monitoring ?? 'none'}
- Industry: ${businessProfile.industry}
- Data types: ${businessProfile.dataHandling.dataTypes.join(', ')}
- Risk factors: ${businessProfile.riskProfile.riskFactors.join(', ')}

Based on your training data and knowledge of common threat patterns, identify the most relevant threats for this specific stack. Focus on threats affecting their compliance posture.`,
        taskType: 'risk',
        orgId,
        workflowId: jobData?.workflowId,
        maxTokens: 3000,
      });

      return this.llm.parseJSON<any>(response.content);
    });

    return {
      success: true,
      data: { threatAnalysis },
      nextAgentInput: { threatAnalysis },
    };
  }
}
