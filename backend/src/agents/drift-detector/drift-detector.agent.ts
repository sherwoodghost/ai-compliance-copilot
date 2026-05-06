import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

@Injectable()
export class DriftDetectorAgent extends BaseAgent {
  protected readonly agentName = 'drift-detector';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    // ── Step 1: Load current evidence vs. previous snapshot ─────────────────
    const snapshot = await this.recordStep(runId, 'load_evidence_snapshot', 0, { orgId }, async () => {
      const evidence = await this.prisma.evidence.findMany({
        where: { orgId },
        include: { control: { select: { code: true, title: true } } },
        orderBy: { collectedAt: 'desc' },
      });

      // Detect stale evidence (>90 days for critical controls, >180 days for standard)
      const now = new Date();
      const driftItems = evidence.map((e) => {
        const ageInDays = Math.floor((now.getTime() - new Date(e.collectedAt).getTime()) / 86400000);
        const isCritical = ['CC6.1', 'CC6.3', 'CC7.4', 'A.9.2', 'A.16.1'].includes(e.control.code);
        const staleThreshold = isCritical ? 90 : 180;
        return {
          evidenceId: e.id,
          controlCode: e.control.code,
          title: e.title,
          source: e.source,
          ageInDays,
          isStale: ageInDays > staleThreshold,
          staleThreshold,
          isCritical,
        };
      });

      return { driftItems };
    });

    const driftItems = (snapshot as any).driftItems as any[];
    const staleItems = driftItems.filter((d) => d.isStale);

    // ── Step 2: Analyze drift significance ──────────────────────────────────
    const driftAnalysis = await this.recordStep(runId, 'analyze_drift', 1, {
      staleCount: staleItems.length,
    }, async () => {
      if (staleItems.length === 0) {
        return { driftDetected: false, driftItems: [], summary: 'No drift detected. All evidence is current.' };
      }

      const response = await this.callGateway(runId, {
        promptTemplateId: 'drift-detector',
        userMessage: `Company: ${businessProfile.companyName}, Industry: ${businessProfile.industry}
Stale evidence items: ${JSON.stringify(staleItems)}`,
        taskType: 'compliance',
        orgId,
        workflowId: jobData?.workflowId,
        maxTokens: 2000,
      });

      return this.llm.parseJSON<any>(response.content);
    });

    // ── Step 3: Mark stale evidence as invalid ──────────────────────────────
    if (staleItems.length > 0) {
      await this.recordStep(runId, 'update_stale_evidence', 2, { staleCount: staleItems.length }, async () => {
        const criticalStale = staleItems.filter((d) => d.isCritical);
        for (const item of criticalStale) {
          await this.prisma.evidence.update({
            where: { id: item.evidenceId },
            data: { isValid: false },
          });
        }
        return { invalidated: criticalStale.length };
      });
    }

    return {
      success: true,
      data: { driftAnalysis, staleCount: staleItems.length },
      nextAgentInput: { driftAnalysis },
    };
  }
}
