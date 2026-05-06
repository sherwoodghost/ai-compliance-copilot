import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class ReviewAgent extends BaseAgent {
  protected readonly agentName = 'review';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile, inputPayload } = jobData;
    const { validationResults } = inputPayload as { validationResults?: any };

    // ── Step 1: Load all controls with policies, evidence, and validation ───
    const fullData = await this.recordStep(runId, 'load_full_control_data', 0, { orgId }, async () => {
      const orgControls = await this.prisma.organizationControl.findMany({
        where: { orgId },
        include: { control: { include: { framework: true } } },
      });

      const controlIds = orgControls.map((oc) => oc.controlId);
      const [evidenceItems, policies] = await Promise.all([
        this.prisma.evidence.findMany({ where: { orgId, controlId: { in: controlIds } } }),
        this.prisma.policy.findMany({ where: { orgId, controlId: { in: controlIds } }, orderBy: { version: 'desc' } }),
      ]);
      const evMap: Record<string, typeof evidenceItems> = {};
      for (const e of evidenceItems) { (evMap[e.controlId] ??= []).push(e); }
      const polMap: Record<string, (typeof policies)[0]> = {};
      for (const p of policies) { if (p.controlId && !polMap[p.controlId]) polMap[p.controlId] = p; }

      return orgControls.map((oc) => {
        const pol = polMap[oc.controlId];
        const evList = evMap[oc.controlId] ?? [];
        return {
          controlId: oc.controlId,
          controlCode: oc.control.code,
          controlTitle: oc.control.title,
          category: oc.control.category,
          framework: oc.control.framework.type,
          currentStatus: oc.status,
          currentScore: oc.score,
          policy: pol ? { status: pol.status, generatedBy: pol.generatedBy, hasApproval: pol.status === 'approved' } : null,
          evidence: evList.map((e) => ({
            title: e.title,
            type: e.type,
            source: e.source,
            isValid: e.isValid,
            isSimulated: (e.metadata as any)?.simulated === true,
            collectedAt: e.collectedAt,
            expiresAt: e.expiresAt,
            ageInDays: Math.floor((Date.now() - new Date(e.collectedAt).getTime()) / 86400000),
          })),
          validationResult: validationResults?.results?.find(
            (r: any) => r.controlId === oc.controlId,
          ) ?? null,
        };
      });
    });

    // ── Step 2: Run cross-system review via LLM ─────────────────────────────
    const reviewOutput = await this.recordStep(runId, 'cross_system_review', 1, {
      controlCount: (fullData as any[]).length,
    }, async () => {
      const prompt = `Perform a comprehensive cross-system compliance review for this company:

COMPANY PROFILE:
- Name: ${businessProfile.companyName}
- Industry: ${businessProfile.industry}
- Risk Level: ${businessProfile.riskProfile.riskLevel}
- Risk Factors: ${businessProfile.riskProfile.riskFactors.join(', ')}
- Data Types: ${businessProfile.dataHandling.dataTypes.join(', ')}
- Compliance Goals: ${businessProfile.complianceGoals.frameworks.join(', ')}
- Has Security Team: ${businessProfile.currentPosture.hasSecurityTeam}

CONTROLS WITH POLICIES, EVIDENCE, AND VALIDATION RESULTS:
${JSON.stringify(fullData, null, 2)}

IMPORTANT: Cross-check all three systems (policy, evidence, validation) against each other.
Flag contradictions. Never assume compliance. Apply auditor-level scrutiny.
Return JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'compliance-review', userMessage: prompt, taskType: 'compliance', orgId, workflowId: jobData?.workflowId, maxTokens: 8192, requiresControlValidation: true });

      return this.llm.parseJSON<any>(response.content);
    });

    // ── Step 3: Persist review results to org_controls ─────────────────────
    await this.recordStep(runId, 'persist_review_results', 2, { orgId }, async () => {
      const reviews = (reviewOutput as any).controlReviews ?? [];
      for (const review of reviews) {
        await this.prisma.organizationControl.update({
          where: { orgId_controlId: { orgId, controlId: review.controlId } },
          data: {
            reviewStatus: review.status as any,
            confidence: review.confidence as any,
            score: review.auditReadinessScore ?? 0,
            lastReviewedAt: new Date(),
          },
        });
      }
      return { reviewed: reviews.length };
    });

    // ── Step 4: Create risk items for critical failures ─────────────────────
    await this.recordStep(runId, 'create_risk_items', 3, { orgId }, async () => {
      const criticalFindings = (reviewOutput as any).criticalFindings ?? [];
      const reviews = (reviewOutput as any).controlReviews ?? [];

      for (const review of reviews.filter((r: any) => r.riskLevel === 'critical' || r.riskLevel === 'high')) {
        const existing = await this.prisma.riskItem.findFirst({
          where: { orgId, controlId: review.controlId, status: 'open' },
        });
        if (!existing) {
          await this.prisma.riskItem.create({
            data: {
              orgId,
              controlId: review.controlId,
              title: `${review.controlCode}: ${review.riskLevel.toUpperCase()} risk identified`,
              description: review.recommendation ?? review.gaps?.join('; '),
              likelihood: 'possible',
              impact: review.riskLevel === 'critical' ? 'catastrophic' : 'major',
              riskScore: review.riskLevel === 'critical' ? 20 : 12,
              status: 'open',
              identifiedBy: 'agent',
            },
          });
        }
      }

      return { riskItemsCreated: reviews.filter((r: any) => ['critical', 'high'].includes(r.riskLevel)).length };
    });

    return {
      success: true,
      data: { reviewOutput },
      nextAgentInput: { reviewOutput },
    };
  }
}
