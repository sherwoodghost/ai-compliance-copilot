import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ScoreInputs,
  ReadinessScoreOutput,
  computeSoc2Score,
  computeIso27001Score,
  computeGenericScore,
  FORMULA_VERSION,
  FRAMEWORK_SLUG_LABELS,
} from './scoring-formulas';

@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate and persist readiness scores for an org.
   * Pure deterministic math — no LLM calls ever.
   */
  async calculate(orgId: string, frameworks?: string[]): Promise<ReadinessScoreOutput> {
    const inputs = await this.gatherInputs(orgId);

    // Determine which frameworks to score
    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    const targetFrameworks = frameworks ??
      ((profile?.complianceGoals as any)?.frameworks ?? []);

    const result: ReadinessScoreOutput = {
      overall: 0,
      overallGrade: 'F',
      formulaVersion: FORMULA_VERSION,
      scoreInputs: inputs,
      computedAt: new Date(),
    };

    const scores: number[] = [];

    if (targetFrameworks.includes('soc2')) {
      result.soc2 = computeSoc2Score(inputs);
      scores.push(result.soc2.overall);
    }

    if (targetFrameworks.includes('iso27001')) {
      result.iso27001 = computeIso27001Score(inputs);
      scores.push(result.iso27001.overall);
    }

    // All other frameworks use the generic risk-based formula (same weights as ISO 27001).
    // This covers HIPAA, PCI-DSS, FedRAMP, NIST CSF, ISO 9001, ISO 14001, ISO 45001, GDPR.
    const GENERIC_FRAMEWORKS = ['hipaa', 'pci-dss', 'fedramp', 'nist-csf', 'iso9001', 'iso14001', 'iso45001', 'gdpr'];
    const hasGeneric = targetFrameworks.some((f: string) => GENERIC_FRAMEWORKS.includes(f.toLowerCase()));
    if (hasGeneric && !targetFrameworks.includes('iso27001')) {
      // Store in iso27001 slot for DB compatibility (persist() reads from there)
      result.iso27001 = computeGenericScore(inputs);
      scores.push(result.iso27001.overall);
    }

    result.overall = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    result.overallGrade = result.soc2?.grade ?? result.iso27001?.grade ?? 'F';

    // Persist to DB
    await this.persist(orgId, result, targetFrameworks);

    this.logger.log(
      `Readiness scores for org ${orgId}: overall=${result.overall}% | frameworks=${targetFrameworks.join(',')} | soc2=${result.soc2?.overall ?? 'N/A'} | iso/generic=${result.iso27001?.overall ?? 'N/A'}`,
    );

    return result;
  }

  /**
   * Get the latest stored scores for an org.
   */
  async getLatest(orgId: string) {
    return this.prisma.readinessScore.findFirst({
      where: { orgId },
      orderBy: { snapshotAt: 'desc' },
    });
  }

  /**
   * Get score history for trending.
   */
  async getHistory(orgId: string, limit = 30) {
    return this.prisma.readinessScore.findMany({
      where: { orgId },
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    });
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async gatherInputs(orgId: string): Promise<ScoreInputs> {
    const [
      controlCounts,
      evidenceCounts,
      policyCounts,
      riskCounts,
      taskCounts,
      openCheckpoints,
    ] = await Promise.all([
      this.getControlCounts(orgId),
      this.getEvidenceCounts(orgId),
      this.getPolicyCounts(orgId),
      this.getRiskCounts(orgId),
      this.getTaskCounts(orgId),
      this.getOpenCheckpoints(orgId),
    ]);

    return {
      ...controlCounts,
      ...evidenceCounts,
      ...policyCounts,
      ...riskCounts,
      ...taskCounts,
      openCheckpoints,
    };
  }

  private async getControlCounts(orgId: string) {
    const [applicable, implemented, inProgress] = await Promise.all([
      this.prisma.controlApplicability.count({ where: { orgId, applicable: true } }),
      this.prisma.organizationControl.count({ where: { orgId, status: 'implemented' } }),
      this.prisma.organizationControl.count({ where: { orgId, status: 'in_progress' } }),
    ]);
    return { applicableControls: applicable, implementedControls: implemented, inProgressControls: inProgress };
  }

  private async getEvidenceCounts(orgId: string) {
    const [valid, stale] = await Promise.all([
      this.prisma.evidence.count({ where: { orgId, isValid: true } }),
      this.prisma.evidence.count({
        where: { orgId, isValid: true, expiresAt: { lt: new Date() } },
      }),
    ]);

    // Required evidence = sum of mandatory evidence requirements for applicable controls
    const applicableControlIds = await this.prisma.controlApplicability.findMany({
      where: { orgId, applicable: true },
      select: { controlId: true },
    });
    const controlIds = applicableControlIds.map((a) => a.controlId);
    const required = await this.prisma.controlEvidenceRequirement.count({
      where: { controlId: { in: controlIds }, isMandatory: true },
    });

    return {
      requiredEvidenceItems: required,
      validEvidenceItems: valid,
      staleEvidenceItems: stale,
    };
  }

  private async getPolicyCounts(orgId: string) {
    const [approved, draft] = await Promise.all([
      this.prisma.policy.count({ where: { orgId, status: 'approved' } }),
      this.prisma.policy.count({ where: { orgId, status: 'draft' } }),
    ]);

    // Required policies = sum of policy requirements for applicable controls
    const applicableControlIds = await this.prisma.controlApplicability.findMany({
      where: { orgId, applicable: true },
      select: { controlId: true },
    });
    const controlIds = applicableControlIds.map((a) => a.controlId);
    const required = await this.prisma.controlPolicyRequirement.count({
      where: { controlId: { in: controlIds } },
    });

    return {
      requiredPolicies: required,
      approvedPolicies: approved,
      draftPolicies: draft,
    };
  }

  private async getRiskCounts(orgId: string) {
    const [total, openHigh, totalHigh, openCritical, accepted] = await Promise.all([
      this.prisma.riskItem.count({ where: { orgId } }),
      this.prisma.riskItem.count({ where: { orgId, severity: 'high', status: 'open' } }),
      this.prisma.riskItem.count({ where: { orgId, severity: 'high' } }),
      this.prisma.riskItem.count({ where: { orgId, severity: 'critical', status: 'open' } }),
      this.prisma.riskTreatment.count({ where: { orgId, treatmentType: 'accept', status: 'open' } }),
    ]);

    return {
      totalRisks: total,
      openHighRisks: openHigh,
      totalHighRisks: totalHigh,
      openCriticalRisks: openCritical,
      riskTreatmentsAccepted: accepted,
    };
  }

  private async getTaskCounts(orgId: string) {
    const now = new Date();
    const [total, overdue] = await Promise.all([
      this.prisma.task.count({ where: { orgId, status: { not: 'done' } } }),
      this.prisma.task.count({
        where: { orgId, status: { not: 'done' }, dueDate: { lt: now } },
      }),
    ]);
    return { totalTasks: total, overdueTasks: overdue };
  }

  private async getOpenCheckpoints(orgId: string): Promise<number> {
    return this.prisma.humanCheckpoint.count({ where: { orgId, status: 'pending' } });
  }

  private async persist(orgId: string, result: ReadinessScoreOutput, frameworks: string[]) {
    const frameworkLabel = frameworks.length > 1
      ? 'MULTI'
      : (FRAMEWORK_SLUG_LABELS[frameworks[0]?.toLowerCase() ?? ''] ?? 'UNKNOWN');

    await this.prisma.readinessScore.create({
      data: {
        orgId,
        framework: frameworkLabel,
        overallScore: result.overall,
        policyScore: result.soc2?.policy ?? result.iso27001?.policy ?? 0,
        evidenceScore: result.soc2?.evidence ?? result.iso27001?.evidence ?? 0,
        controlDesignScore: result.soc2?.controlDesign ?? result.iso27001?.controlDesign ?? 0,
        operationalScore: result.soc2?.operational ?? result.iso27001?.operational ?? 0,
        riskManagementScore: result.iso27001?.riskManagement ?? 0,
        scoreInputs: result.scoreInputs as any,
        formulaVersion: FORMULA_VERSION,
      },
    });
  }
}
