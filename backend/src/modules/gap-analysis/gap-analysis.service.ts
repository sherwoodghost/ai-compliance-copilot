import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ControlGap {
  controlId: string;
  controlCode: string;
  controlTitle: string;
  controlCategory: string;
  frameworkId: string;
  frameworkName: string;
  status: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  gapTypes: GapType[];
  evidenceCount: number;
  evidenceRequired: number;
  policyCount: number;
  policyRequired: number;
  hasApprovedPolicy: boolean;
  hasValidEvidence: boolean;
  staleEvidenceCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
  remediationActions: RemediationAction[];
  coverageScore: number; // 0-100 per control
}

export type GapType =
  | 'no_evidence'
  | 'insufficient_evidence'
  | 'stale_evidence'
  | 'no_policy'
  | 'draft_policy_only'
  | 'control_not_implemented'
  | 'overdue_tasks'
  | 'no_document_coverage';

export interface RemediationAction {
  type: 'create_policy' | 'collect_evidence' | 'implement_control' | 'review_evidence' | 'approve_policy' | 'create_task' | 'link_document';
  label: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: number; // 1 = highest
}

export interface GapSummary {
  totalApplicableControls: number;
  totalGaps: number;
  criticalGaps: number;
  highGaps: number;
  mediumGaps: number;
  lowGaps: number;
  coveragePercentage: number;
  gapsByCategory: Record<string, number>;
  gapsByType: Record<GapType, number>;
  topRemediations: RemediationAction[];
}

export interface CoverageMatrix {
  framework: string;
  categories: CategoryCoverage[];
}

export interface CategoryCoverage {
  category: string;
  totalControls: number;
  implemented: number;
  withEvidence: number;
  withPolicy: number;
  withDocument: number;
  coverageScore: number;
}

@Injectable()
export class GapAnalysisService {
  private readonly logger = new Logger(GapAnalysisService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full gap analysis: per-control gaps with severity, remediation actions, and summary
   */
  async analyze(orgId: string, frameworkId?: string): Promise<{ summary: GapSummary; gaps: ControlGap[] }> {
    // 1. Get all applicable controls for this org
    const applicableControls = await this.prisma.controlApplicability.findMany({
      where: {
        orgId,
        applicable: true,
        ...(frameworkId && { control: { frameworkId } }),
      },
      include: {
        control: {
          include: {
            framework: { select: { id: true, name: true } },
            evidence: {
              where: { orgId },
              select: { id: true, isValid: true, expiresAt: true, collectedAt: true },
            },
            policies: {
              where: { orgId },
              select: { id: true, status: true },
            },
            tasks: {
              where: { orgId },
              select: { id: true, status: true, dueDate: true },
            },
          },
        },
      },
    });

    // 2. Get org controls status
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      select: { controlId: true, status: true },
    });
    const controlStatusMap = new Map(orgControls.map((oc) => [oc.controlId, oc.status]));

    // 3. Get documents with control mappings
    const documents = await this.prisma.document.findMany({
      where: { orgId, activeForOrg: true },
      select: { id: true, controlIds: true, docType: true },
    });

    // Build control→document map
    const controlDocMap = new Map<string, number>();
    for (const doc of documents) {
      for (const cid of doc.controlIds) {
        controlDocMap.set(cid, (controlDocMap.get(cid) ?? 0) + 1);
      }
    }

    // 4. Get evidence requirements
    const evidenceReqs = await this.prisma.controlEvidenceRequirement.findMany({
      where: { control: { applicability: { some: { orgId, applicable: true } } } },
      select: { controlId: true },
    });
    const evidenceReqCounts = new Map<string, number>();
    for (const r of evidenceReqs) {
      evidenceReqCounts.set(r.controlId, (evidenceReqCounts.get(r.controlId) ?? 0) + 1);
    }

    // 5. Get policy requirements
    const policyReqs = await this.prisma.controlPolicyRequirement.findMany({
      where: { control: { applicability: { some: { orgId, applicable: true } } } },
      select: { controlId: true },
    });
    const policyReqCounts = new Map<string, number>();
    for (const r of policyReqs) {
      policyReqCounts.set(r.controlId, (policyReqCounts.get(r.controlId) ?? 0) + 1);
    }

    // 6. Analyze each control for gaps
    const now = new Date();
    const gaps: ControlGap[] = [];

    for (const ca of applicableControls) {
      const { control } = ca;
      const status = controlStatusMap.get(control.id) ?? 'not_started';
      const gapTypes: GapType[] = [];
      const remediationActions: RemediationAction[] = [];

      // Evidence analysis
      const validEvidence = control.evidence.filter((e) => e.isValid);
      const staleEvidence = control.evidence.filter(
        (e) => e.isValid && e.expiresAt && new Date(e.expiresAt) < now,
      );
      const evidenceRequired = evidenceReqCounts.get(control.id) ?? 1; // default 1

      if (validEvidence.length === 0) {
        gapTypes.push('no_evidence');
        remediationActions.push({
          type: 'collect_evidence',
          label: `Collect evidence for ${control.code}`,
          effort: 'medium',
          impact: 'high',
          priority: 1,
        });
      } else if (validEvidence.length < evidenceRequired) {
        gapTypes.push('insufficient_evidence');
        remediationActions.push({
          type: 'collect_evidence',
          label: `Collect ${evidenceRequired - validEvidence.length} more evidence items for ${control.code}`,
          effort: 'medium',
          impact: 'medium',
          priority: 3,
        });
      }

      if (staleEvidence.length > 0) {
        gapTypes.push('stale_evidence');
        remediationActions.push({
          type: 'review_evidence',
          label: `Review ${staleEvidence.length} stale evidence items for ${control.code}`,
          effort: 'low',
          impact: 'medium',
          priority: 2,
        });
      }

      // Policy analysis
      const approvedPolicies = control.policies.filter((p) => p.status === 'approved');
      const draftPolicies = control.policies.filter((p) => p.status === 'draft');
      const policyRequired = policyReqCounts.get(control.id) ?? 1;

      if (control.policies.length === 0) {
        gapTypes.push('no_policy');
        remediationActions.push({
          type: 'create_policy',
          label: `Create policy for ${control.code}`,
          effort: 'high',
          impact: 'high',
          priority: 1,
        });
      } else if (approvedPolicies.length === 0 && draftPolicies.length > 0) {
        gapTypes.push('draft_policy_only');
        remediationActions.push({
          type: 'approve_policy',
          label: `Approve draft policy for ${control.code}`,
          effort: 'low',
          impact: 'high',
          priority: 1,
        });
      }

      // Control implementation
      if (status === 'not_started' || status === 'failed') {
        gapTypes.push('control_not_implemented');
        remediationActions.push({
          type: 'implement_control',
          label: `Implement control ${control.code}: ${control.title}`,
          effort: 'high',
          impact: 'high',
          priority: 1,
        });
      }

      // Task analysis
      const openTasks = control.tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
      const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);

      if (overdueTasks.length > 0) {
        gapTypes.push('overdue_tasks');
        remediationActions.push({
          type: 'create_task',
          label: `Address ${overdueTasks.length} overdue tasks for ${control.code}`,
          effort: 'medium',
          impact: 'medium',
          priority: 2,
        });
      }

      // Document coverage
      const docCount = controlDocMap.get(control.id) ?? 0;
      if (docCount === 0) {
        gapTypes.push('no_document_coverage');
        remediationActions.push({
          type: 'link_document',
          label: `Link or upload document for ${control.code}`,
          effort: 'low',
          impact: 'medium',
          priority: 3,
        });
      }

      // Only include controls with gaps
      if (gapTypes.length === 0) continue;

      // Calculate coverage score (0-100)
      let coverageScore = 0;
      if (status === 'implemented') coverageScore += 30;
      else if (status === 'in_progress') coverageScore += 15;
      if (approvedPolicies.length >= policyRequired) coverageScore += 25;
      else if (draftPolicies.length > 0) coverageScore += 8;
      if (validEvidence.length >= evidenceRequired) coverageScore += 25;
      else if (validEvidence.length > 0) coverageScore += Math.round(10 * validEvidence.length / evidenceRequired);
      if (staleEvidence.length === 0) coverageScore += 10;
      if (docCount > 0) coverageScore += 10;

      // Determine severity
      const severity = this.calculateSeverity(gapTypes, control.weight);

      // Sort remediations by priority
      remediationActions.sort((a, b) => a.priority - b.priority);

      gaps.push({
        controlId: control.id,
        controlCode: control.code,
        controlTitle: control.title,
        controlCategory: control.category,
        frameworkId: control.framework.id,
        frameworkName: control.framework.name,
        status,
        severity,
        gapTypes,
        evidenceCount: validEvidence.length,
        evidenceRequired,
        policyCount: control.policies.length,
        policyRequired,
        hasApprovedPolicy: approvedPolicies.length > 0,
        hasValidEvidence: validEvidence.length > 0,
        staleEvidenceCount: staleEvidence.length,
        openTaskCount: openTasks.length,
        overdueTaskCount: overdueTasks.length,
        remediationActions,
        coverageScore,
      });
    }

    // Sort gaps: critical first, then by coverage (lowest first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.coverageScore - b.coverageScore);

    // Build summary
    const gapsByCategory: Record<string, number> = {};
    const gapsByType: Record<string, number> = {};

    for (const gap of gaps) {
      gapsByCategory[gap.controlCategory] = (gapsByCategory[gap.controlCategory] ?? 0) + 1;
      for (const gt of gap.gapTypes) {
        gapsByType[gt] = (gapsByType[gt] ?? 0) + 1;
      }
    }

    // Aggregate top remediation actions (deduplicate by type)
    const remediationsByType = new Map<string, RemediationAction & { count: number }>();
    for (const gap of gaps) {
      for (const action of gap.remediationActions) {
        const existing = remediationsByType.get(action.type);
        if (!existing || action.priority < existing.priority) {
          remediationsByType.set(action.type, { ...action, count: (existing?.count ?? 0) + 1 });
        } else {
          existing.count++;
        }
      }
    }

    const topRemediations: RemediationAction[] = Array.from(remediationsByType.values())
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5)
      .map(({ count, ...action }) => ({
        ...action,
        label: `${action.label.split(' for ')[0]} (${count} controls)`,
      }));

    const totalApplicable = applicableControls.length;
    const coveragePercentage = totalApplicable > 0
      ? Math.round(((totalApplicable - gaps.length) / totalApplicable) * 100)
      : 100;

    const summary: GapSummary = {
      totalApplicableControls: totalApplicable,
      totalGaps: gaps.length,
      criticalGaps: gaps.filter((g) => g.severity === 'critical').length,
      highGaps: gaps.filter((g) => g.severity === 'high').length,
      mediumGaps: gaps.filter((g) => g.severity === 'medium').length,
      lowGaps: gaps.filter((g) => g.severity === 'low').length,
      coveragePercentage,
      gapsByCategory,
      gapsByType: gapsByType as Record<GapType, number>,
      topRemediations,
    };

    return { summary, gaps };
  }

  /**
   * Coverage matrix: framework × category breakdown showing document/evidence/policy coverage
   */
  async getCoverageMatrix(orgId: string): Promise<CoverageMatrix[]> {
    const applicableControls = await this.prisma.controlApplicability.findMany({
      where: { orgId, applicable: true },
      include: {
        control: {
          include: {
            framework: { select: { id: true, name: true } },
            evidence: { where: { orgId, isValid: true }, select: { id: true } },
            policies: { where: { orgId }, select: { id: true, status: true } },
          },
        },
      },
    });

    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      select: { controlId: true, status: true },
    });
    const statusMap = new Map(orgControls.map((oc) => [oc.controlId, oc.status]));

    const documents = await this.prisma.document.findMany({
      where: { orgId, activeForOrg: true },
      select: { controlIds: true },
    });
    const docControlSet = new Set<string>();
    for (const d of documents) {
      for (const cid of d.controlIds) docControlSet.add(cid);
    }

    // Group by framework → category
    const frameworkMap = new Map<string, Map<string, { total: number; implemented: number; withEvidence: number; withPolicy: number; withDocument: number }>>();

    for (const ca of applicableControls) {
      const { control } = ca;
      const fwKey = `${control.framework.id}|${control.framework.name}`;

      if (!frameworkMap.has(fwKey)) frameworkMap.set(fwKey, new Map());
      const categoryMap = frameworkMap.get(fwKey)!;

      if (!categoryMap.has(control.category)) {
        categoryMap.set(control.category, { total: 0, implemented: 0, withEvidence: 0, withPolicy: 0, withDocument: 0 });
      }

      const cat = categoryMap.get(control.category)!;
      cat.total++;

      const status = statusMap.get(control.id);
      if (status === 'implemented') cat.implemented++;

      if (control.evidence.length > 0) cat.withEvidence++;

      const hasApproved = control.policies.some((p) => p.status === 'approved');
      if (hasApproved || control.policies.length > 0) cat.withPolicy++;

      if (docControlSet.has(control.id)) cat.withDocument++;
    }

    const matrices: CoverageMatrix[] = [];
    for (const [fwKey, categoryMap] of frameworkMap) {
      const [, frameworkName] = fwKey.split('|');
      const categories: CategoryCoverage[] = [];

      for (const [category, counts] of categoryMap) {
        const coverageScore = counts.total > 0
          ? Math.round(
              ((counts.implemented / counts.total) * 30 +
                (counts.withEvidence / counts.total) * 30 +
                (counts.withPolicy / counts.total) * 25 +
                (counts.withDocument / counts.total) * 15),
            )
          : 0;

        categories.push({
          category,
          totalControls: counts.total,
          implemented: counts.implemented,
          withEvidence: counts.withEvidence,
          withPolicy: counts.withPolicy,
          withDocument: counts.withDocument,
          coverageScore,
        });
      }

      categories.sort((a, b) => a.coverageScore - b.coverageScore);
      matrices.push({ framework: frameworkName, categories });
    }

    return matrices;
  }

  /**
   * Framework crosswalk: show how controls map across frameworks,
   * highlighting shared effort opportunities
   */
  async getFrameworkCrosswalk(orgId: string) {
    // Get all crosswalk mappings for controls applicable to this org
    const crosswalks = await this.prisma.frameworkCrosswalk.findMany({
      where: {
        sourceControl: { applicability: { some: { orgId, applicable: true } } },
      },
      include: {
        sourceControl: {
          include: { framework: { select: { id: true, name: true } } },
        },
        targetControl: {
          include: { framework: { select: { id: true, name: true } } },
        },
      },
    });

    // Get org control statuses
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      select: { controlId: true, status: true },
    });
    const statusMap = new Map(orgControls.map((oc) => [oc.controlId, oc.status]));

    // Build crosswalk entries
    const entries = crosswalks.map((cw) => ({
      id: cw.id,
      sourceControl: {
        id: cw.sourceControl.id,
        code: cw.sourceControl.code,
        title: cw.sourceControl.title,
        framework: cw.sourceControl.framework.name,
        status: statusMap.get(cw.sourceControl.id) ?? 'not_started',
      },
      targetControl: {
        id: cw.targetControl.id,
        code: cw.targetControl.code,
        title: cw.targetControl.title,
        framework: cw.targetControl.framework.name,
        status: statusMap.get(cw.targetControl.id) ?? 'not_started',
      },
      mappingType: cw.mappingType,
      confidence: cw.confidence,
      rationale: cw.rationale,
      automatable: cw.automatable,
    }));

    // Compute summary stats
    const frameworkPairs = new Map<string, { total: number; equivalent: number; partial: number; related: number; bothImplemented: number }>();

    for (const entry of entries) {
      const pairKey = [entry.sourceControl.framework, entry.targetControl.framework].sort().join(' ↔ ');
      if (!frameworkPairs.has(pairKey)) {
        frameworkPairs.set(pairKey, { total: 0, equivalent: 0, partial: 0, related: 0, bothImplemented: 0 });
      }
      const pair = frameworkPairs.get(pairKey)!;
      pair.total++;
      if (entry.mappingType === 'equivalent') pair.equivalent++;
      else if (entry.mappingType === 'partial') pair.partial++;
      else pair.related++;

      if (entry.sourceControl.status === 'implemented' && entry.targetControl.status === 'implemented') {
        pair.bothImplemented++;
      }
    }

    const summary = Array.from(frameworkPairs.entries()).map(([pair, stats]) => ({
      frameworkPair: pair,
      ...stats,
      sharedEffortPercentage: stats.total > 0 ? Math.round(((stats.equivalent + stats.partial * 0.5) / stats.total) * 100) : 0,
    }));

    return { summary, crosswalks: entries };
  }

  private calculateSeverity(gapTypes: GapType[], weight: number): 'critical' | 'high' | 'medium' | 'low' {
    const hasCriticalGap =
      gapTypes.includes('control_not_implemented') &&
      (gapTypes.includes('no_evidence') || gapTypes.includes('no_policy'));

    if (hasCriticalGap && weight >= 3) return 'critical';
    if (hasCriticalGap || (gapTypes.includes('no_evidence') && gapTypes.includes('no_policy'))) return 'high';
    if (gapTypes.includes('no_evidence') || gapTypes.includes('no_policy') || gapTypes.includes('control_not_implemented')) return 'medium';
    return 'low';
  }
}
