import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';
import { DashboardLayoutService, LayoutInput, RoleView } from '../../modules/dashboard/dashboard-layout.service';
import { RiskLevel } from '../../inference/inference.types';
import { AUDIT_DISCLAIMER } from '../base/agent-contract.interfaces';

/**
 * DashboardAgent
 *
 * Pipeline position: last stage (position 18).
 *
 * Responsibilities:
 * 1. Gather org posture snapshot from DB
 * 2. Determine risk level (from inference memory or readiness score)
 * 3. Generate dashboard config via DashboardLayoutService (DETERMINISTIC — zero LLM)
 * 4. Persist to dashboard_configs table
 * 5. Optionally generate LLM narrative summary (separate, non-structural step)
 *
 * Layout decisions are NEVER made by an LLM — see DashboardLayoutService for
 * the explicit rule set (R-D01 through R-D10).
 */
@Injectable()
export class DashboardAgent extends BaseAgent {
  protected readonly agentName = 'dashboard';

  constructor(
    prisma: PrismaService,
    llm: LlmService,
    journeyService: ComplianceJourneyService,
    gateway: LlmGatewayService,
    private readonly layoutService: DashboardLayoutService,
  ) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId } = jobData;
    const roleView: RoleView = (jobData as any).roleView ?? 'executive';

    // ── Step 1: Gather current org posture snapshot ─────────────────────────
    const posture = await this.recordStep(runId, 'gather_posture', 0, { orgId }, async () => {
      const [readiness, openHighRisks, controlStats, pendingTasks, overdueEvidence] = await Promise.all([
        this.prisma.readinessScore.findFirst({
          where: { orgId },
          orderBy: { snapshotAt: 'desc' },
          select: { overallScore: true, framework: true, snapshotAt: true },
        }),
        this.prisma.riskItem.count({
          where: { orgId, status: 'open', severity: { in: ['critical', 'high'] } },
        }),
        this.prisma.organizationControl.groupBy({
          by: ['status'],
          where: { orgId },
          _count: true,
        }),
        this.prisma.task.count({ where: { orgId, status: { not: 'done' } } }),
        this.prisma.evidence.count({
          where: {
            orgId,
            expiresAt: { lt: new Date() },
          },
        }),
      ]);

      return { readiness, openHighRisks, controlStats, pendingTasks, overdueEvidence };
    });

    const p = posture as any;

    // ── Step 2: Determine risk level — from inference output if present ──────
    const inferenceInput = jobData.inputPayload as any;
    const riskLevel: RiskLevel =
      inferenceInput?.inferenceOutput?.risk_level ??
      inferenceInput?.risk_level ??
      this.scoreToRiskLevel(p.readiness?.overallScore ?? 0);

    const frameworks: string[] = inferenceInput?.inferenceOutput?.inferred_frameworks
      ?.map((f: any) => f.framework) ?? [];

    // ── Step 3: Build layout config (DETERMINISTIC — zero LLM) ─────────────
    const layoutInput: LayoutInput = {
      roleView,
      riskLevel,
      overallScore: p.readiness?.overallScore ?? 0,
      openHighRisks: p.openHighRisks ?? 0,
      pendingTasks: p.pendingTasks ?? 0,
      overdueEvidenceCount: p.overdueEvidence ?? 0,
      frameworks,
    };

    const config = await this.recordStep(runId, 'build_layout', 1, layoutInput as unknown as Record<string, unknown>, () =>
      Promise.resolve(this.layoutService.buildLayout(layoutInput)),
    );

    // ── Step 4: Persist to dashboard_configs table ──────────────────────────
    await this.recordStep(runId, 'persist_config', 2, { orgId, roleView }, async () => {
      const existing = await this.prisma.dashboardConfig.findFirst({
        where: { orgId, roleView },
        orderBy: { version: 'desc' },
      });

      return this.prisma.dashboardConfig.create({
        data: {
          orgId,
          roleView,
          widgets: (config as any).widgets ?? [],
          navigation: (config as any).navigation ?? [],
          alerts: (config as any).alerts ?? [],
          recommendedActions: (config as any).recommendedActions ?? [],
          generatedBy: 'dashboard-agent',
          version: (existing?.version ?? 0) + 1,
        },
      });
    });

    return {
      success: true,
      data: {
        config,
        roleView,
        riskLevel,
        auditDisclaimer: AUDIT_DISCLAIMER,
        agentName: this.agentName,
        runId,
      },
      nextAgentInput: {},
    };
  }

  /** Convert readiness score to risk level as a fallback when inference data is absent */
  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 70) return 'LOW';
    if (score >= 40) return 'MEDIUM';
    return 'HIGH';
  }
}
