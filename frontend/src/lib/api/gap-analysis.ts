import { apiClient } from './client';

export interface ControlGap {
  controlId: string;
  controlCode: string;
  controlTitle: string;
  controlCategory: string;
  frameworkId: string;
  frameworkName: string;
  status: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  gapTypes: string[];
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
  coverageScore: number;
}

export interface RemediationAction {
  type: string;
  label: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: number;
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
  gapsByType: Record<string, number>;
  topRemediations: RemediationAction[];
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

export interface CoverageMatrix {
  framework: string;
  categories: CategoryCoverage[];
}

export interface ChecklistItem {
  id: string;
  category: string;
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

export interface CrosswalkEntry {
  id: string;
  sourceControl: { id: string; code: string; title: string; framework: string; status: string };
  targetControl: { id: string; code: string; title: string; framework: string; status: string };
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: string;
  rationale: string | null;
  automatable: boolean;
}

export interface CrosswalkSummary {
  frameworkPair: string;
  total: number;
  equivalent: number;
  partial: number;
  related: number;
  bothImplemented: number;
  sharedEffortPercentage: number;
}

// Action Plan types
export interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'quick_win' | 'strategic' | 'maintenance' | 'foundation';
  type: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priorityScore: number;
  frameworkName: string;
  controlCode: string | null;
  controlTitle: string | null;
  relatedEntityId: string | null;
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
  complianceLiftPercentage: number;
  byFramework: { framework: string; actions: number; estimatedHours: number }[];
  byEffort: { effort: string; count: number }[];
}

export interface ActionPlan {
  summary: ActionPlanSummary;
  actions: ActionItem[];
}

// Timeline types
export interface TimelineMilestone {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'completed' | 'in_progress' | 'upcoming' | 'at_risk';
  completedDate: string | null;
  projectedDate: string | null;
  progress: number;
  framework: string | null;
  blockers: string[];
}

export interface ComplianceVelocity {
  period: string;
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
  overallProgress: number;
  weeksActive: number;
  avgWeeklyVelocity: number;
}

export const gapAnalysisApi = {
  analyze: (frameworkId?: string) =>
    apiClient.get<{ summary: GapSummary; gaps: ControlGap[] }>('/gap-analysis', {
      params: frameworkId ? { frameworkId } : {},
    }).then((r) => r.data),

  getCoverageMatrix: () =>
    apiClient.get<CoverageMatrix[]>('/gap-analysis/coverage').then((r) => r.data),

  getAuditChecklist: (framework?: string) =>
    apiClient.get<AuditChecklist>('/gap-analysis/checklist', {
      params: framework ? { framework } : {},
    }).then((r) => r.data),

  getCrosswalk: () =>
    apiClient.get<{ summary: CrosswalkSummary[]; crosswalks: CrosswalkEntry[] }>('/gap-analysis/crosswalk').then((r) => r.data),

  getActionPlan: (frameworkId?: string) =>
    apiClient.get<ActionPlan>('/gap-analysis/action-plan', {
      params: frameworkId ? { frameworkId } : {},
    }).then((r) => r.data),

  getTimeline: () =>
    apiClient.get<ComplianceTimeline>('/gap-analysis/timeline').then((r) => r.data),
};
