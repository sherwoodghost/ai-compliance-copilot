import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'quick_win' | 'strategic' | 'maintenance' | 'foundation';
  type: 'implement_control' | 'create_policy' | 'collect_evidence' | 'approve_policy' | 'review_evidence' | 'resolve_task' | 'link_document' | 'treat_risk';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priorityScore: number; // 0-100, higher = do first
  frameworkName: string;
  controlCode: string | null;
  controlTitle: string | null;
  relatedEntityId: string | null; // policy/evidence/task ID
  relatedEntityType: string | null;
  status: 'pending' | 'in_progress' | 'blocked';
  estimatedHours: number;
  dueDate: string | null;
}

export interface ActionPlanSummary {
  totalActions: number;
  quickWins: number;
  strategic: number;
  maintenance: number;
  foundation: number;
  estimatedTotalHours: number;
  estimatedWeeksToComplete: number;
  complianceLiftPercentage: number; // estimated coverage improvement if all done
  byFramework: { framework: string; actions: number; estimatedHours: number }[];
  byEffort: { effort: string; count: number }[];
}

export interface ActionPlan {
  summary: ActionPlanSummary;
  actions: ActionItem[];
}

@Injectable()
export class ActionPlanService {
  private readonly logger = new Logger(ActionPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generateActionPlan(orgId: string, frameworkId?: string): Promise<ActionPlan> {
    // 1. Get applicable controls with all related data
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
              select: { id: true, isValid: true, expiresAt: true, title: true },
            },
            policies: {
              where: { orgId },
              select: { id: true, status: true, title: true },
            },
            tasks: {
              where: { orgId },
              select: { id: true, status: true, title: true, dueDate: true, priority: true },
            },
          },
        },
      },
    });

    // Get org control statuses
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      select: { controlId: true, status: true },
    });
    const controlStatusMap = new Map(orgControls.map((oc) => [oc.controlId, oc.status]));

    // Get documents with control mappings
    const documents = await this.prisma.document.findMany({
      where: { orgId, activeForOrg: true },
      select: { id: true, controlIds: true },
    });
    const controlDocSet = new Set<string>();
    for (const doc of documents) {
      for (const cid of doc.controlIds) controlDocSet.add(cid);
    }

    // Get untreated risks
    const risks = await this.prisma.riskItem.findMany({
      where: { orgId },
      select: {
        id: true,
        title: true,
        riskScore: true,
        controlId: true,
        _count: { select: { riskTreatments: true } },
      },
    });

    // Get evidence requirements
    const evidenceReqs = await this.prisma.controlEvidenceRequirement.findMany({
      where: { control: { applicability: { some: { orgId, applicable: true } } } },
      select: { controlId: true },
    });
    const evidenceReqCounts = new Map<string, number>();
    for (const r of evidenceReqs) {
      evidenceReqCounts.set(r.controlId, (evidenceReqCounts.get(r.controlId) ?? 0) + 1);
    }

    // Build action items
    const actions: ActionItem[] = [];
    const now = new Date();
    let idCounter = 0;

    for (const ca of applicableControls) {
      const { control } = ca;
      const status = controlStatusMap.get(control.id) ?? 'not_started';

      // 1. Control not implemented → implement it
      if (status === 'not_started' || status === 'failed') {
        const hasPolicy = control.policies.length > 0;
        const hasEvidence = control.evidence.some((e) => e.isValid);
        actions.push({
          id: `action-${++idCounter}`,
          title: `Implement ${control.code}: ${control.title}`,
          description: `This control is not yet implemented. ${!hasPolicy ? 'No policy exists yet. ' : ''}${!hasEvidence ? 'No evidence collected yet.' : ''}`,
          category: control.weight >= 3 ? 'foundation' : 'strategic',
          type: 'implement_control',
          effort: 'high',
          impact: control.weight >= 3 ? 'high' : 'medium',
          priorityScore: this.calcPriority('high', control.weight >= 3 ? 'high' : 'medium', control.weight),
          frameworkName: control.framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          relatedEntityId: control.id,
          relatedEntityType: 'control',
          status: 'pending',
          estimatedHours: control.weight >= 3 ? 8 : 4,
          dueDate: null,
        });
      }

      // 2. No policy → create one
      if (control.policies.length === 0) {
        actions.push({
          id: `action-${++idCounter}`,
          title: `Create policy for ${control.code}`,
          description: `Control "${control.title}" requires a policy document. Use the AI policy generator to draft one quickly.`,
          category: 'strategic',
          type: 'create_policy',
          effort: 'medium',
          impact: 'high',
          priorityScore: this.calcPriority('medium', 'high', control.weight),
          frameworkName: control.framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          relatedEntityId: null,
          relatedEntityType: null,
          status: 'pending',
          estimatedHours: 3,
          dueDate: null,
        });
      }

      // 3. Draft policy → approve it (quick win!)
      const draftPolicies = control.policies.filter((p) => p.status === 'draft');
      for (const policy of draftPolicies) {
        actions.push({
          id: `action-${++idCounter}`,
          title: `Approve policy: ${policy.title}`,
          description: `Review and approve the draft policy for ${control.code}. This is a quick win that immediately improves compliance posture.`,
          category: 'quick_win',
          type: 'approve_policy',
          effort: 'low',
          impact: 'high',
          priorityScore: this.calcPriority('low', 'high', control.weight),
          frameworkName: control.framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          relatedEntityId: policy.id,
          relatedEntityType: 'policy',
          status: 'pending',
          estimatedHours: 0.5,
          dueDate: null,
        });
      }

      // 4. No evidence → collect it
      const validEvidence = control.evidence.filter((e) => e.isValid);
      const requiredCount = evidenceReqCounts.get(control.id) ?? 1;
      if (validEvidence.length < requiredCount) {
        const missing = requiredCount - validEvidence.length;
        actions.push({
          id: `action-${++idCounter}`,
          title: `Collect ${missing} evidence item${missing > 1 ? 's' : ''} for ${control.code}`,
          description: `${control.title} needs ${missing} more evidence item${missing > 1 ? 's' : ''} to meet requirements. Upload screenshots, logs, or reports.`,
          category: validEvidence.length > 0 ? 'maintenance' : 'strategic',
          type: 'collect_evidence',
          effort: missing > 2 ? 'high' : 'medium',
          impact: 'high',
          priorityScore: this.calcPriority(missing > 2 ? 'high' : 'medium', 'high', control.weight),
          frameworkName: control.framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          relatedEntityId: control.id,
          relatedEntityType: 'control',
          status: 'pending',
          estimatedHours: missing * 1.5,
          dueDate: null,
        });
      }

      // 5. Stale evidence → review it (quick win)
      const staleEvidence = control.evidence.filter(
        (e) => e.isValid && e.expiresAt && new Date(e.expiresAt) < now,
      );
      for (const evidence of staleEvidence) {
        actions.push({
          id: `action-${++idCounter}`,
          title: `Refresh stale evidence: ${evidence.title}`,
          description: `Evidence for ${control.code} has expired. Re-collect or re-validate it.`,
          category: 'quick_win',
          type: 'review_evidence',
          effort: 'low',
          impact: 'medium',
          priorityScore: this.calcPriority('low', 'medium', control.weight),
          frameworkName: control.framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          relatedEntityId: evidence.id,
          relatedEntityType: 'evidence',
          status: 'pending',
          estimatedHours: 0.5,
          dueDate: null,
        });
      }

      // 6. Overdue tasks → resolve them
      const overdueTasks = control.tasks.filter(
        (t) => (t.status === 'open' || t.status === 'in_progress') && t.dueDate && new Date(t.dueDate) < now,
      );
      for (const task of overdueTasks) {
        actions.push({
          id: `action-${++idCounter}`,
          title: `Resolve overdue: ${task.title}`,
          description: `This task for ${control.code} is past its due date. Complete or reschedule it.`,
          category: 'quick_win',
          type: 'resolve_task',
          effort: 'low',
          impact: 'medium',
          priorityScore: this.calcPriority('low', 'medium', control.weight) + 5, // bonus for overdue
          frameworkName: control.framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          relatedEntityId: task.id,
          relatedEntityType: 'task',
          status: 'in_progress',
          estimatedHours: 1,
          dueDate: task.dueDate?.toISOString() ?? null,
        });
      }

      // 7. No document linked → link one
      if (!controlDocSet.has(control.id)) {
        actions.push({
          id: `action-${++idCounter}`,
          title: `Link document to ${control.code}`,
          description: `Control "${control.title}" has no supporting document. Upload or link a relevant document.`,
          category: 'maintenance',
          type: 'link_document',
          effort: 'low',
          impact: 'low',
          priorityScore: this.calcPriority('low', 'low', control.weight),
          frameworkName: control.framework.name,
          controlCode: control.code,
          controlTitle: control.title,
          relatedEntityId: control.id,
          relatedEntityType: 'control',
          status: 'pending',
          estimatedHours: 0.25,
          dueDate: null,
        });
      }
    }

    // 8. Untreated risks
    for (const risk of risks) {
      if (risk._count.riskTreatments === 0) {
        const score = risk.riskScore;
        actions.push({
          id: `action-${++idCounter}`,
          title: `Treat risk: ${risk.title}`,
          description: `This risk has no treatment plan. Define mitigation, transfer, or acceptance strategy.`,
          category: score >= 12 ? 'foundation' : 'strategic',
          type: 'treat_risk',
          effort: 'medium',
          impact: score >= 12 ? 'high' : 'medium',
          priorityScore: this.calcPriority('medium', score >= 12 ? 'high' : 'medium', Math.min(score / 3, 5)),
          frameworkName: '',
          controlCode: null,
          controlTitle: null,
          relatedEntityId: risk.id,
          relatedEntityType: 'risk',
          status: 'pending',
          estimatedHours: 2,
          dueDate: null,
        });
      }
    }

    // Sort by priority score (highest first)
    actions.sort((a, b) => b.priorityScore - a.priorityScore);

    // Build summary
    const quickWins = actions.filter((a) => a.category === 'quick_win');
    const strategic = actions.filter((a) => a.category === 'strategic');
    const maintenance = actions.filter((a) => a.category === 'maintenance');
    const foundation = actions.filter((a) => a.category === 'foundation');

    const totalHours = actions.reduce((sum, a) => sum + a.estimatedHours, 0);

    // Group by framework
    const frameworkGroups = new Map<string, { actions: number; hours: number }>();
    for (const action of actions) {
      const fw = action.frameworkName || 'General';
      const existing = frameworkGroups.get(fw) ?? { actions: 0, hours: 0 };
      existing.actions++;
      existing.hours += action.estimatedHours;
      frameworkGroups.set(fw, existing);
    }

    // Estimate compliance lift: how much coverage would improve if all actions completed
    const totalApplicable = applicableControls.length;
    const controlsWithGaps = new Set(actions.filter((a) => a.controlCode).map((a) => a.controlCode));
    const complianceLift = totalApplicable > 0
      ? Math.round((controlsWithGaps.size / totalApplicable) * 100)
      : 0;

    const summary: ActionPlanSummary = {
      totalActions: actions.length,
      quickWins: quickWins.length,
      strategic: strategic.length,
      maintenance: maintenance.length,
      foundation: foundation.length,
      estimatedTotalHours: Math.round(totalHours),
      estimatedWeeksToComplete: Math.ceil(totalHours / 20), // assuming 20 hrs/week on compliance
      complianceLiftPercentage: complianceLift,
      byFramework: Array.from(frameworkGroups.entries()).map(([framework, data]) => ({
        framework,
        actions: data.actions,
        estimatedHours: Math.round(data.hours),
      })),
      byEffort: [
        { effort: 'low', count: actions.filter((a) => a.effort === 'low').length },
        { effort: 'medium', count: actions.filter((a) => a.effort === 'medium').length },
        { effort: 'high', count: actions.filter((a) => a.effort === 'high').length },
      ],
    };

    return { summary, actions };
  }

  /**
   * Priority score: higher = do first.
   * Low effort + high impact = highest priority (quick wins).
   * High effort + low impact = lowest priority.
   */
  private calcPriority(effort: string, impact: string, weight: number): number {
    const effortMultiplier = effort === 'low' ? 3 : effort === 'medium' ? 2 : 1;
    const impactMultiplier = impact === 'high' ? 3 : impact === 'medium' ? 2 : 1;
    const weightBonus = Math.min(weight * 2, 10);
    return Math.min(effortMultiplier * impactMultiplier * 8 + weightBonus, 100);
  }
}
