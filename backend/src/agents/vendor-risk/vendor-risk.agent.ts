import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

@Injectable()
export class VendorRiskAgent extends BaseAgent {
  protected readonly agentName = 'vendor-risk';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    // Build vendor list from tools profile
    const vendors = [
      ...Object.values(businessProfile.tools ?? {}).filter((v) => v && v !== 'none'),
      ...businessProfile.infrastructure.cloudProviders,
    ].filter(Boolean) as string[];

    const vendorAssessments = await this.recordStep(runId, 'assess_vendors', 0, {
      vendorCount: vendors.length,
    }, async () => {
      if (vendors.length === 0) return { assessments: [] };

      const response = await this.callGateway(runId, {
        promptTemplateId: 'vendor-risk',
        userMessage: `Company: ${businessProfile.companyName}
Industry: ${businessProfile.industry}
Data types processed: ${businessProfile.dataHandling.dataTypes.join(', ')}

Vendors to assess: ${vendors.join(', ')}

For each vendor, assess based on your knowledge of their security practices, certifications, and incidents.`,
        taskType: 'risk',
        orgId,
        workflowId: jobData?.workflowId,
        maxTokens: 4000,
      });

      return this.llm.parseJSON<any>(response.content);
    });

    // Persist vendor risk assessments
    await this.recordStep(runId, 'persist_vendor_risks', 1, { orgId }, async () => {
      const assessments = (vendorAssessments as any).assessments ?? [];
      for (const assessment of assessments) {
        await this.prisma.vendorRisk.upsert({
          where: {
            id: (await this.prisma.vendorRisk.findFirst({
              where: { orgId, vendorName: assessment.vendor },
            }))?.id ?? 'new',
          },
          create: {
            orgId,
            vendorName: assessment.vendor,
            riskLevel: assessment.riskLevel,
            assessment: assessment as any,
            lastAssessedAt: new Date(),
          },
          update: {
            riskLevel: assessment.riskLevel,
            assessment: assessment as any,
            lastAssessedAt: new Date(),
          },
        });
      }
      return { assessed: assessments.length };
    });

    return {
      success: true,
      data: { vendorAssessments },
      nextAgentInput: { vendorAssessments },
    };
  }
}
