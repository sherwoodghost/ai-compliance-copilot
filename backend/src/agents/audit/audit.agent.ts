import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class AuditAgent extends BaseAgent {
  protected readonly agentName = 'audit';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile, inputPayload } = jobData;
    const { reviewOutput } = inputPayload as { reviewOutput?: any };

    // ── Step 1: Load complete control state ──────────────────────────────────
    const auditData = await this.recordStep(runId, 'load_audit_data', 0, { orgId }, async () => {
      const [orgControls, evidence, openTasks, riskItems] = await Promise.all([
        this.prisma.organizationControl.findMany({
          where: { orgId },
          include: {
            control: { include: { framework: true } },
          },
        }),
        this.prisma.evidence.findMany({ where: { orgId } }),
        this.prisma.task.count({ where: { orgId, status: { in: ['open', 'in_progress'] } } }),
        this.prisma.riskItem.findMany({ where: { orgId, status: 'open' }, take: 20 }),
      ]);

      return {
        controls: orgControls,
        evidenceSummary: {
          total: evidence.length,
          valid: evidence.filter((e) => e.isValid).length,
          expired: evidence.filter((e) => e.expiresAt && e.expiresAt < new Date()).length,
          simulated: evidence.filter((e) => (e.metadata as any)?.simulated).length,
        },
        openTasks,
        openRisks: riskItems.length,
      };
    });

    // ── Step 2: Generate full audit report ──────────────────────────────────
    const report = await this.recordStep(runId, 'generate_audit_report', 1, {
      orgId,
      controlCount: (auditData as any).controls.length,
    }, async () => {
      const controls = (auditData as any).controls;
      const controlSummary = controls.map((oc: any) => ({
        code: oc.control.code,
        title: oc.control.title,
        category: oc.control.category,
        framework: oc.control.framework.type,
        status: oc.status,
        score: oc.score,
        reviewStatus: oc.reviewStatus,
        confidence: oc.confidence,
        hasPolicy: oc.policies.length > 0,
        policyApproved: oc.policies[0]?.status === 'approved',
        evidenceCount: oc.evidence.length,
      }));

      const prompt = `Generate a complete audit-ready compliance report:

ORGANIZATION: ${businessProfile.companyName}
INDUSTRY: ${businessProfile.industry}
FRAMEWORKS: ${businessProfile.complianceGoals.frameworks.join(', ')}
REPORT DATE: ${new Date().toISOString().split('T')[0]}
RISK LEVEL: ${businessProfile.riskProfile.riskLevel}

CONTROL STATUS SUMMARY:
${JSON.stringify(controlSummary, null, 2)}

EVIDENCE SUMMARY:
${JSON.stringify((auditData as any).evidenceSummary, null, 2)}

OPEN TASKS: ${(auditData as any).openTasks}
OPEN RISK ITEMS: ${(auditData as any).openRisks}

REVIEW OUTPUT:
${JSON.stringify(reviewOutput?.reviewSummary ?? 'Not available')}

Generate a complete, professional audit report. Return JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'audit-report', userMessage: prompt, taskType: 'audit_export', orgId, workflowId: jobData?.workflowId, maxTokens: 12000, requiresControlValidation: true });

      return this.llm.parseJSON<any>(response.content);
    });

    // ── Step 3: Save report to workflow output ──────────────────────────────
    await this.recordStep(runId, 'save_report', 2, { orgId }, async () => {
      if (jobData.workflowId) {
        await this.prisma.workflow.update({
          where: { id: jobData.workflowId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            outputPayload: { auditReport: report } as any,
          },
        });
      }
      return { saved: true };
    });

    return {
      success: true,
      data: { report },
    };
  }
}
