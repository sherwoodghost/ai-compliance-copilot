import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TimelineMilestone {
  id: string;
  title: string;
  description: string;
  category: 'controls' | 'policies' | 'evidence' | 'risks' | 'audit' | 'general';
  status: 'completed' | 'in_progress' | 'upcoming' | 'at_risk';
  completedDate: string | null;
  projectedDate: string | null;
  progress: number; // 0-100
  framework: string | null;
  blockers: string[];
}

export interface ComplianceVelocity {
  period: string; // e.g., "2026-W18"
  controlsImplemented: number;
  evidenceCollected: number;
  policiesApproved: number;
  tasksCompleted: number;
}

export interface ComplianceTimeline {
  milestones: TimelineMilestone[];
  velocity: ComplianceVelocity[];
  projectedCompletionDate: string | null;
  currentPhase: string;
  overallProgress: number; // 0-100
  weeksActive: number;
  avgWeeklyVelocity: number;
}

@Injectable()
export class ComplianceTimelineService {
  private readonly logger = new Logger(ComplianceTimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(orgId: string): Promise<ComplianceTimeline> {
    // Gather all data in parallel
    const [
      applicableControls,
      orgControls,
      policies,
      evidence,
      tasks,
      documents,
      risks,
      org,
    ] = await Promise.all([
      this.prisma.controlApplicability.findMany({
        where: { orgId, applicable: true },
        include: {
          control: {
            include: {
              framework: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.organizationControl.findMany({
        where: { orgId },
        select: { controlId: true, status: true, updatedAt: true },
      }),
      this.prisma.policy.findMany({
        where: { orgId },
        select: { id: true, status: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.evidence.findMany({
        where: { orgId },
        select: { id: true, isValid: true, collectedAt: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        where: { orgId },
        select: { id: true, status: true, createdAt: true, updatedAt: true, dueDate: true },
      }),
      this.prisma.document.findMany({
        where: { orgId, activeForOrg: true },
        select: { id: true, createdAt: true },
      }),
      this.prisma.riskItem.findMany({
        where: { orgId },
        select: {
          id: true,
          _count: { select: { riskTreatments: true } },
        },
      }),
      this.prisma.organization.findFirst({
        where: { id: orgId },
        select: { createdAt: true },
      }),
    ]);

    const controlStatusMap = new Map(orgControls.map((oc) => [oc.controlId, oc]));
    const now = new Date();

    // Compute velocity: group activities by ISO week
    const velocity = this.computeVelocity(orgControls, evidence, policies, tasks);

    // Compute milestones
    const milestones = this.computeMilestones(
      applicableControls,
      controlStatusMap,
      policies,
      evidence,
      tasks,
      documents,
      risks,
      now,
    );

    // Overall progress
    const totalApplicable = applicableControls.length;
    const implemented = orgControls.filter((oc) => oc.status === 'implemented').length;
    const approvedPolicies = policies.filter((p) => p.status === 'approved').length;
    const validEvidence = evidence.filter((e) => e.isValid).length;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const treatedRisks = risks.filter((r) => r._count.riskTreatments > 0).length;

    // Weighted progress
    const overallProgress = totalApplicable > 0
      ? Math.round(
          (implemented / totalApplicable) * 35 +
          (approvedPolicies / Math.max(totalApplicable * 0.3, 1)) * 25 +
          (validEvidence / Math.max(totalApplicable, 1)) * 25 +
          (treatedRisks / Math.max(risks.length, 1)) * 15,
        )
      : 0;

    // Weeks active
    const startDate = org?.createdAt ?? now;
    const weeksActive = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));

    // Average weekly velocity (controls implemented per week)
    const avgWeeklyVelocity = velocity.length > 0
      ? Math.round((velocity.reduce((s, v) => s + v.controlsImplemented + v.policiesApproved + v.evidenceCollected, 0) / velocity.length) * 10) / 10
      : 0;

    // Project completion date
    const remaining = totalApplicable - implemented;
    let projectedCompletionDate: string | null = null;
    if (avgWeeklyVelocity > 0 && remaining > 0) {
      const weeksRemaining = Math.ceil(remaining / avgWeeklyVelocity);
      const projected = new Date(now);
      projected.setDate(projected.getDate() + weeksRemaining * 7);
      projectedCompletionDate = projected.toISOString();
    }

    // Current phase
    const currentPhase = this.determinePhase(overallProgress, milestones);

    return {
      milestones: milestones.sort((a, b) => {
        const statusOrder = { completed: 0, in_progress: 1, at_risk: 2, upcoming: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      }),
      velocity,
      projectedCompletionDate,
      currentPhase,
      overallProgress: Math.min(overallProgress, 100),
      weeksActive,
      avgWeeklyVelocity,
    };
  }

  private computeVelocity(
    orgControls: { controlId: string; status: string; updatedAt: Date }[],
    evidence: { id: string; createdAt: Date }[],
    policies: { id: string; status: string; updatedAt: Date }[],
    tasks: { id: string; status: string; updatedAt: Date }[],
  ): ComplianceVelocity[] {
    const weekMap = new Map<string, ComplianceVelocity>();

    const getWeekKey = (date: Date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      return `${year}-W${String(week).padStart(2, '0')}`;
    };

    const ensureWeek = (key: string): ComplianceVelocity => {
      if (!weekMap.has(key)) {
        weekMap.set(key, { period: key, controlsImplemented: 0, evidenceCollected: 0, policiesApproved: 0, tasksCompleted: 0 });
      }
      return weekMap.get(key)!;
    };

    // Count implemented controls by week
    for (const oc of orgControls) {
      if (oc.status === 'implemented') {
        ensureWeek(getWeekKey(oc.updatedAt)).controlsImplemented++;
      }
    }

    // Count evidence by collection week
    for (const e of evidence) {
      ensureWeek(getWeekKey(e.createdAt)).evidenceCollected++;
    }

    // Count approved policies
    for (const p of policies) {
      if (p.status === 'approved') {
        ensureWeek(getWeekKey(p.updatedAt)).policiesApproved++;
      }
    }

    // Count completed tasks
    for (const t of tasks) {
      if (t.status === 'done') {
        ensureWeek(getWeekKey(t.updatedAt)).tasksCompleted++;
      }
    }

    // Sort by week and take last 12
    return Array.from(weekMap.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12);
  }

  private computeMilestones(
    applicableControls: any[],
    controlStatusMap: Map<string, { controlId: string; status: string; updatedAt: Date }>,
    policies: { id: string; status: string; createdAt: Date }[],
    evidence: { id: string; isValid: boolean; createdAt: Date }[],
    tasks: { id: string; status: string; dueDate: Date | null }[],
    documents: { id: string; createdAt: Date }[],
    risks: { id: string; _count: { riskTreatments: number } }[],
    now: Date,
  ): TimelineMilestone[] {
    const milestones: TimelineMilestone[] = [];
    const totalApplicable = applicableControls.length;

    // Group controls by framework
    const frameworkGroups = new Map<string, typeof applicableControls>();
    for (const ca of applicableControls) {
      const fw = ca.control.framework.name;
      if (!frameworkGroups.has(fw)) frameworkGroups.set(fw, []);
      frameworkGroups.get(fw)!.push(ca);
    }

    // Per-framework control milestones
    for (const [framework, controls] of frameworkGroups) {
      const implemented = controls.filter((c) => controlStatusMap.get(c.control.id)?.status === 'implemented').length;
      const total = controls.length;
      const progress = total > 0 ? Math.round((implemented / total) * 100) : 0;

      const blockers: string[] = [];
      if (implemented === 0) blockers.push('No controls implemented yet');
      const notStarted = controls.filter((c) => {
        const s = controlStatusMap.get(c.control.id)?.status;
        return !s || s === 'not_started';
      }).length;
      if (notStarted > total * 0.5) blockers.push(`${notStarted} controls not started`);

      milestones.push({
        id: `ms-ctrl-${framework.toLowerCase().replace(/\s+/g, '-')}`,
        title: `${framework} Controls Implementation`,
        description: `${implemented} of ${total} controls implemented`,
        category: 'controls',
        status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'upcoming',
        completedDate: progress === 100 ? new Date().toISOString() : null,
        projectedDate: null,
        progress,
        framework,
        blockers,
      });
    }

    // Policy milestone
    const approvedPolicies = policies.filter((p) => p.status === 'approved').length;
    const draftPolicies = policies.filter((p) => p.status === 'draft').length;
    const policyTarget = Math.max(Math.ceil(totalApplicable * 0.3), 1); // rough: 1 policy per ~3 controls
    const policyProgress = Math.min(Math.round((approvedPolicies / policyTarget) * 100), 100);
    const policyBlockers: string[] = [];
    if (draftPolicies > 0) policyBlockers.push(`${draftPolicies} draft policies pending approval`);
    if (approvedPolicies === 0) policyBlockers.push('No approved policies yet');

    milestones.push({
      id: 'ms-policies',
      title: 'Policy Documentation Complete',
      description: `${approvedPolicies} approved, ${draftPolicies} in draft`,
      category: 'policies',
      status: policyProgress >= 100 ? 'completed' : policyProgress > 0 ? 'in_progress' : 'upcoming',
      completedDate: null,
      projectedDate: null,
      progress: policyProgress,
      framework: null,
      blockers: policyBlockers,
    });

    // Evidence milestone
    const validEvidence = evidence.filter((e) => e.isValid).length;
    const evidenceProgress = totalApplicable > 0
      ? Math.min(Math.round((validEvidence / totalApplicable) * 100), 100)
      : 0;
    milestones.push({
      id: 'ms-evidence',
      title: 'Evidence Collection Complete',
      description: `${validEvidence} valid evidence items collected`,
      category: 'evidence',
      status: evidenceProgress >= 100 ? 'completed' : evidenceProgress > 0 ? 'in_progress' : 'upcoming',
      completedDate: null,
      projectedDate: null,
      progress: evidenceProgress,
      framework: null,
      blockers: validEvidence === 0 ? ['No evidence collected yet'] : [],
    });

    // Risk treatment milestone
    const treatedRisks = risks.filter((r) => r._count.riskTreatments > 0).length;
    const riskProgress = risks.length > 0
      ? Math.round((treatedRisks / risks.length) * 100)
      : 100; // no risks = complete
    milestones.push({
      id: 'ms-risks',
      title: 'Risk Treatments Defined',
      description: `${treatedRisks} of ${risks.length} risks treated`,
      category: 'risks',
      status: riskProgress >= 100 ? 'completed' : riskProgress > 0 ? 'in_progress' : 'upcoming',
      completedDate: null,
      projectedDate: null,
      progress: riskProgress,
      framework: null,
      blockers: risks.length > 0 && treatedRisks === 0 ? ['No risk treatments defined'] : [],
    });

    // Task completion milestone
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
    const overdueTasks = tasks.filter(
      (t) => (t.status === 'open' || t.status === 'in_progress') && t.dueDate && new Date(t.dueDate) < now,
    ).length;
    const taskProgress = tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : 100;
    const taskBlockers: string[] = [];
    if (overdueTasks > 0) taskBlockers.push(`${overdueTasks} overdue tasks`);

    milestones.push({
      id: 'ms-tasks',
      title: 'Task Backlog Clear',
      description: `${completedTasks} completed, ${openTasks} remaining`,
      category: 'general',
      status: overdueTasks > 0 ? 'at_risk' : taskProgress >= 100 ? 'completed' : taskProgress > 0 ? 'in_progress' : 'upcoming',
      completedDate: null,
      projectedDate: null,
      progress: taskProgress,
      framework: null,
      blockers: taskBlockers,
    });

    // Document coverage milestone
    const docProgress = documents.length > 0 ? Math.min(Math.round((documents.length / Math.max(totalApplicable * 0.5, 1)) * 100), 100) : 0;
    milestones.push({
      id: 'ms-documents',
      title: 'Documentation Complete',
      description: `${documents.length} documents uploaded`,
      category: 'general',
      status: docProgress >= 100 ? 'completed' : docProgress > 0 ? 'in_progress' : 'upcoming',
      completedDate: null,
      projectedDate: null,
      progress: docProgress,
      framework: null,
      blockers: documents.length === 0 ? ['No documents uploaded yet'] : [],
    });

    return milestones;
  }

  private determinePhase(overallProgress: number, milestones: TimelineMilestone[]): string {
    if (overallProgress >= 90) return 'Audit Ready';
    if (overallProgress >= 70) return 'Final Review';
    if (overallProgress >= 40) return 'Implementation';
    if (overallProgress >= 15) return 'Foundation Building';
    return 'Getting Started';
  }
}
