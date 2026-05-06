import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { ControlApplicabilityEngine, BusinessProfileSnapshot } from '../../control-library/applicability-engine.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

/**
 * ControlMapperAgent — deterministic, no LLM calls.
 * Runs the ControlApplicabilityEngine for an org based on their BusinessProfile.
 */
@Injectable()
export class ControlMapperAgent extends BaseAgent {
  protected readonly agentName = 'control-mapper';

  constructor(
    prisma: PrismaService,
    llm: LlmService,
    journeyService: ComplianceJourneyService,
    gateway: LlmGatewayService,
    private readonly applicabilityEngine: ControlApplicabilityEngine,
  ) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    // ── Step 1: Load business profile ──────────────────────────────────────
    const profile = await this.recordStep(runId, 'load_profile', 0, { orgId }, async () => {
      const p = businessProfile ?? await this.prisma.businessProfile.findUnique({ where: { orgId } });
      if (!p) throw new Error(`No business profile for org ${orgId}`);
      return p;
    });

    // ── Step 2: Build profile snapshot ─────────────────────────────────────
    const snapshot: BusinessProfileSnapshot = this.buildSnapshot(profile as any);

    // ── Step 3: Run applicability engine (no LLM — pure deterministic) ─────
    const results = await this.recordStep(runId, 'run_applicability_engine', 1, {
      frameworks: snapshot.frameworks,
    }, async () => {
      return this.applicabilityEngine.runForOrg(orgId, snapshot, (profile as any).version ?? 1);
    });

    const applicable = results.filter((r: any) => r.applicable);
    const needsReview = results.filter((r: any) => r.requiresHumanReview);

    this.logger.log(
      `ControlMapper: ${applicable.length}/${results.length} controls applicable, ${needsReview.length} need human review`,
    );

    return {
      success: true,
      data: {
        totalControls: results.length,
        applicableControls: applicable.length,
        notApplicableControls: results.length - applicable.length,
        needsHumanReview: needsReview.length,
        results: results.slice(0, 100), // cap output payload size
        summary: `Mapped ${applicable.length} applicable controls across ${snapshot.frameworks.join(', ').toUpperCase()}`,
      },
      warnings: needsReview.length > 0
        ? [`${needsReview.length} controls require human review for applicability determination`]
        : [],
    };
  }

  private buildSnapshot(profile: any): BusinessProfileSnapshot {
    const infra = profile.infrastructure ?? {};
    const data = profile.dataHandling ?? {};
    const posture = profile.currentPosture ?? {};
    const goals = profile.complianceGoals ?? {};
    const scope = goals.soc2Scope ?? {};

    return {
      frameworks: goals.frameworks ?? ['soc2'],
      soc2TrustServiceCategories: scope.trustServiceCategories ?? ['security'],
      industry: profile.industry ?? 'saas',
      dataTypes: data.dataTypes ?? [],
      cloudProviders: infra.cloudProviders ?? [],
      hasPhysicalOffice: !!profile.hqCountry && !infra.cloudOnly,
      operatesIn: profile.operatesIn ?? (profile.hqCountry ? [profile.hqCountry] : []),
      employeeCount: profile.employeeCount,
      usesMfa: posture.usesMfa,
      hasSecurityTeam: posture.hasSecurityTeam ?? false,
      hasIncidentResponsePlan: posture.hasIncidentResponsePlan ?? false,
      hasSso: posture.hasSso ?? false,
      hasVulnScanning: posture.hasVulnScanning ?? false,
    };
  }
}
