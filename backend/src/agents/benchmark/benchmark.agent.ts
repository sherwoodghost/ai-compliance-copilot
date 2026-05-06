import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

@Injectable()
export class BenchmarkAgent extends BaseAgent {
  protected readonly agentName = 'benchmark';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    const orgStats = await this.recordStep(runId, 'load_org_stats', 0, { orgId }, async () => {
      const [total, implemented, avgScore] = await Promise.all([
        this.prisma.organizationControl.count({ where: { orgId } }),
        this.prisma.organizationControl.count({ where: { orgId, status: 'implemented' } }),
        this.prisma.organizationControl.aggregate({ where: { orgId }, _avg: { score: true } }),
      ]);

      return {
        total,
        implemented,
        complianceRate: total > 0 ? Math.round((implemented / total) * 100) : 0,
        averageScore: Math.round(avgScore._avg.score ?? 0),
      };
    });

    const benchmark = await this.recordStep(runId, 'generate_benchmark', 1, {}, async () => {
      const response = await this.callGateway(runId, {
        promptTemplateId: 'benchmark',
        userMessage: `Company: ${businessProfile.companyName}
Industry: ${businessProfile.industry}
Size: ${businessProfile.employeeCount}
Frameworks: ${businessProfile.complianceGoals.frameworks.join(', ')}
Current metrics: ${JSON.stringify(orgStats)}

Based on industry benchmarks and your knowledge of compliance maturity in this sector, provide realistic peer comparison.`,
        taskType: 'compliance',
        orgId,
        workflowId: jobData?.workflowId,
        maxTokens: 2000,
      });

      return this.llm.parseJSON<any>(response.content);
    });

    return {
      success: true,
      data: { benchmark },
    };
  }
}
