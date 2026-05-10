import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ChecklistItem {
  id: string;
  category: 'controls' | 'evidence' | 'policies' | 'risks' | 'tasks' | 'documents' | 'scope';
  title: string;
  description: string;
  status: 'complete' | 'in_progress' | 'not_started' | 'warning';
  current: number;
  required: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  actionUrl?: string;
}

export interface AuditChecklist {
  framework: string;
  readinessScore: number;
  readinessGrade: string;
  completedItems: number;
  totalItems: number;
  completionPercentage: number;
  items: ChecklistItem[];
  estimatedDaysToReady: number;
}

@Injectable()
export class AuditChecklistService {
  private readonly logger = new Logger(AuditChecklistService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateChecklist(orgId: string, framework?: string): Promise<AuditChecklist> {
    // Determine target framework from org's applicable controls
    let targetFramework = framework;
    if (!targetFramework) {
      const orgFramework = await this.prisma.framework.findFirst({
        where: { controls: { some: { applicability: { some: { orgId, applicable: true } } } } },
        select: { name: true },
      });
      targetFramework = orgFramework?.name ?? 'SOC2';
    }

    // Gather all metrics in parallel
    const [
      controlStats,
      evidenceStats,
      policyStats,
      riskStats,
      taskStats,
      documentStats,
      scopeStats,
      readinessScore,
    ] = await Promise.all([
      this.getControlStats(orgId, targetFramework),
      this.getEvidenceStats(orgId),
      this.getPolicyStats(orgId),
      this.getRiskStats(orgId),
      this.getTaskStats(orgId),
      this.getDocumentStats(orgId),
      this.getScopeStats(orgId),
      this.getLatestReadiness(orgId, targetFramework),
    ]);

    const items: ChecklistItem[] = [];

    // ── Controls ────────────────────────────────────────────────────────

    items.push({
      id: 'controls-implemented',
      category: 'controls',
      title: 'Implement all applicable controls',
      description: `${controlStats.implemented} of ${controlStats.applicable} controls are implemented. ${controlStats.inProgress} are in progress.`,
      status: controlStats.implemented >= controlStats.applicable ? 'complete'
        : controlStats.implemented + controlStats.inProgress > 0 ? 'in_progress' : 'not_started',
      current: controlStats.implemented,
      required: controlStats.applicable,
      priority: 'critical',
      actionUrl: '/controls',
    });

    items.push({
      id: 'controls-assigned',
      category: 'controls',
      title: 'Assign owners to all controls',
      description: `${controlStats.assigned} of ${controlStats.applicable} controls have an assigned owner.`,
      status: controlStats.assigned >= controlStats.applicable ? 'complete'
        : controlStats.assigned > 0 ? 'in_progress' : 'not_started',
      current: controlStats.assigned,
      required: controlStats.applicable,
      priority: 'high',
      actionUrl: '/controls',
    });

    // ── Evidence ────────────────────────────────────────────────────────

    items.push({
      id: 'evidence-collected',
      category: 'evidence',
      title: 'Collect evidence for all controls',
      description: `${evidenceStats.controlsWithEvidence} of ${controlStats.applicable} controls have at least one evidence item.`,
      status: evidenceStats.controlsWithEvidence >= controlStats.applicable ? 'complete'
        : evidenceStats.controlsWithEvidence > 0 ? 'in_progress' : 'not_started',
      current: evidenceStats.controlsWithEvidence,
      required: controlStats.applicable,
      priority: 'critical',
      actionUrl: '/evidence',
    });

    items.push({
      id: 'evidence-valid',
      category: 'evidence',
      title: 'Ensure all evidence is current (not stale)',
      description: evidenceStats.stale > 0
        ? `${evidenceStats.stale} evidence items have expired and need refresh.`
        : 'All evidence items are current.',
      status: evidenceStats.stale === 0 ? 'complete' : 'warning',
      current: evidenceStats.valid - evidenceStats.stale,
      required: evidenceStats.valid,
      priority: 'high',
      actionUrl: '/evidence',
    });

    // ── Policies ────────────────────────────────────────────────────────

    items.push({
      id: 'policies-created',
      category: 'policies',
      title: 'Create policies for all required controls',
      description: `${policyStats.total} policies created. ${policyStats.controlsWithPolicy} controls have at least one policy.`,
      status: policyStats.controlsWithPolicy >= controlStats.applicable ? 'complete'
        : policyStats.controlsWithPolicy > 0 ? 'in_progress' : 'not_started',
      current: policyStats.controlsWithPolicy,
      required: controlStats.applicable,
      priority: 'critical',
      actionUrl: '/policies',
    });

    items.push({
      id: 'policies-approved',
      category: 'policies',
      title: 'Get all policies approved',
      description: `${policyStats.approved} of ${policyStats.total} policies are approved. ${policyStats.draft} remain in draft.`,
      status: policyStats.draft === 0 && policyStats.approved > 0 ? 'complete'
        : policyStats.approved > 0 ? 'in_progress' : 'not_started',
      current: policyStats.approved,
      required: policyStats.total || 1,
      priority: 'high',
      actionUrl: '/policies',
    });

    // ── Risks ───────────────────────────────────────────────────────────

    items.push({
      id: 'risks-assessed',
      category: 'risks',
      title: 'Complete risk assessment',
      description: riskStats.total > 0
        ? `${riskStats.total} risks identified. ${riskStats.treated} have treatment plans.`
        : 'No risks have been documented. Complete a risk assessment.',
      status: riskStats.total > 0 && riskStats.untreated === 0 ? 'complete'
        : riskStats.total > 0 ? 'in_progress' : 'not_started',
      current: riskStats.treated,
      required: Math.max(riskStats.total, 1),
      priority: 'high',
      actionUrl: '/risks',
    });

    items.push({
      id: 'risks-critical-resolved',
      category: 'risks',
      title: 'Address all critical and high risks',
      description: riskStats.openCriticalHigh > 0
        ? `${riskStats.openCriticalHigh} critical/high risks remain open.`
        : 'All critical and high risks have been addressed.',
      status: riskStats.openCriticalHigh === 0 ? 'complete' : 'warning',
      current: riskStats.criticalHighTotal - riskStats.openCriticalHigh,
      required: Math.max(riskStats.criticalHighTotal, 1),
      priority: 'critical',
      actionUrl: '/risks',
    });

    // ── Tasks ───────────────────────────────────────────────────────────

    items.push({
      id: 'tasks-overdue',
      category: 'tasks',
      title: 'Resolve all overdue tasks',
      description: taskStats.overdue > 0
        ? `${taskStats.overdue} tasks are past their due date.`
        : 'No overdue tasks.',
      status: taskStats.overdue === 0 ? 'complete' : 'warning',
      current: taskStats.completed,
      required: taskStats.total || 1,
      priority: 'high',
      actionUrl: '/tasks',
    });

    // ── Documents ───────────────────────────────────────────────────────

    items.push({
      id: 'documents-imported',
      category: 'documents',
      title: 'Import and organize compliance documents',
      description: `${documentStats.total} documents in the library. ${documentStats.withControls} are linked to controls.`,
      status: documentStats.total > 0 && documentStats.withControls > 0 ? 'complete'
        : documentStats.total > 0 ? 'in_progress' : 'not_started',
      current: documentStats.withControls,
      required: Math.max(documentStats.total, 1),
      priority: 'medium',
      actionUrl: '/documents',
    });

    // ── Scope ───────────────────────────────────────────────────────────

    items.push({
      id: 'scope-defined',
      category: 'scope',
      title: 'Define audit scope and boundaries',
      description: scopeStats.defined
        ? 'Scope has been defined with systems and TSC categories.'
        : 'Audit scope has not been defined yet.',
      status: scopeStats.defined ? 'complete' : 'not_started',
      current: scopeStats.defined ? 1 : 0,
      required: 1,
      priority: 'critical',
      actionUrl: '/scope',
    });

    // Sort by priority then status
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { not_started: 0, warning: 1, in_progress: 2, complete: 3 };
    items.sort((a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      statusOrder[a.status] - statusOrder[b.status],
    );

    const completedItems = items.filter((i) => i.status === 'complete').length;
    const completionPercentage = Math.round((completedItems / items.length) * 100);

    // Estimate days based on incomplete critical/high items
    const incompleteCritical = items.filter((i) => i.status !== 'complete' && i.priority === 'critical').length;
    const incompleteHigh = items.filter((i) => i.status !== 'complete' && i.priority === 'high').length;
    const incompleteMedium = items.filter((i) => i.status !== 'complete' && i.priority === 'medium').length;
    const estimatedDaysToReady = incompleteCritical * 14 + incompleteHigh * 7 + incompleteMedium * 3;

    const grade = readinessScore >= 90 ? 'A' : readinessScore >= 75 ? 'B' : readinessScore >= 60 ? 'C' : readinessScore >= 40 ? 'D' : 'F';

    return {
      framework: targetFramework,
      readinessScore,
      readinessGrade: grade,
      completedItems,
      totalItems: items.length,
      completionPercentage,
      items,
      estimatedDaysToReady,
    };
  }

  private async getControlStats(orgId: string, framework: string) {
    const applicable = await this.prisma.controlApplicability.count({
      where: { orgId, applicable: true },
    });
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      select: { status: true, assignedTo: true },
    });
    return {
      applicable,
      implemented: orgControls.filter((c) => c.status === 'implemented').length,
      inProgress: orgControls.filter((c) => c.status === 'in_progress').length,
      assigned: orgControls.filter((c) => c.assignedTo != null).length,
    };
  }

  private async getEvidenceStats(orgId: string) {
    const now = new Date();
    const evidence = await this.prisma.evidence.findMany({
      where: { orgId },
      select: { isValid: true, expiresAt: true, controlId: true },
    });
    const controlsWithEvidence = new Set(evidence.filter((e) => e.isValid).map((e) => e.controlId)).size;
    const valid = evidence.filter((e) => e.isValid).length;
    const stale = evidence.filter((e) => e.isValid && e.expiresAt && new Date(e.expiresAt) < now).length;
    return { total: evidence.length, valid, stale, controlsWithEvidence };
  }

  private async getPolicyStats(orgId: string) {
    const policies = await this.prisma.policy.findMany({
      where: { orgId },
      select: { status: true, controlId: true },
    });
    const controlsWithPolicy = new Set(policies.map((p) => p.controlId)).size;
    return {
      total: policies.length,
      approved: policies.filter((p) => p.status === 'approved').length,
      draft: policies.filter((p) => p.status === 'draft').length,
      controlsWithPolicy,
    };
  }

  private async getRiskStats(orgId: string) {
    const risks = await this.prisma.riskItem.findMany({
      where: { orgId },
      select: { severity: true, status: true, _count: { select: { riskTreatments: true } } },
    });
    const openCriticalHigh = risks.filter(
      (r) => (r.severity === 'critical' || r.severity === 'high') && r.status === 'open',
    ).length;
    const criticalHighTotal = risks.filter(
      (r) => r.severity === 'critical' || r.severity === 'high',
    ).length;
    const treated = risks.filter((r) => r._count.riskTreatments > 0).length;
    return {
      total: risks.length,
      treated,
      untreated: risks.length - treated,
      openCriticalHigh,
      criticalHighTotal,
    };
  }

  private async getTaskStats(orgId: string) {
    const now = new Date();
    const tasks = await this.prisma.task.findMany({
      where: { orgId },
      select: { status: true, dueDate: true },
    });
    return {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'done').length,
      overdue: tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now).length,
    };
  }

  private async getDocumentStats(orgId: string) {
    const docs = await this.prisma.document.findMany({
      where: { orgId, activeForOrg: true },
      select: { controlIds: true },
    });
    return {
      total: docs.length,
      withControls: docs.filter((d) => d.controlIds.length > 0).length,
    };
  }

  private async getScopeStats(orgId: string) {
    const soc2Scope = await this.prisma.soc2Scope.findFirst({
      where: { orgId },
      select: { id: true },
    });
    const isoScope = await this.prisma.iso27001Scope.findFirst({
      where: { orgId },
      select: { id: true },
    });
    return { defined: !!(soc2Scope || isoScope) };
  }

  private async getLatestReadiness(orgId: string, framework: string): Promise<number> {
    const score = await this.prisma.readinessScore.findFirst({
      where: { orgId, framework },
      orderBy: { snapshotAt: 'desc' },
      select: { overallScore: true },
    });
    return score?.overallScore ?? 0;
  }
}
