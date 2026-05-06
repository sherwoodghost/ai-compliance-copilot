import { Injectable } from '@nestjs/common';
import { RiskLevel } from '../../inference/inference.types';

/**
 * DashboardLayoutService
 *
 * DETERMINISTIC ONLY. Zero LLM calls.
 * Applies explicit layout rules to produce a DashboardConfig structure.
 *
 * Rules:
 *   R-D01: risk_level=HIGH  → risk_heatmap widget at position 0 (top-left)
 *   R-D02: risk_level=LOW   → readiness_gauge at position 0
 *   R-D03: MEDIUM           → readiness_gauge at 0, risk_summary at 1
 *   R-D04: executive role   → hide raw control list, show score + roadmap
 *   R-D05: auditor role     → show control matrix + evidence freshness first
 *   R-D06: contributor role → show assigned tasks + evidence upload widget
 *   R-D07: security role    → show risk_heatmap + drift_alerts prominently
 *   R-D08: admin role       → full widget set, no omissions
 *   R-D09: pending tasks > 5 → task_urgency_banner alert always shown
 *   R-D10: overdue evidence → evidence_freshness_warning alert shown
 *
 * Same inputs → same output guaranteed.
 */

export type RoleView = 'executive' | 'security' | 'auditor' | 'admin' | 'contributor';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  position: number;
  size: 'small' | 'medium' | 'large' | 'full';
  dataSource: string;
  visible: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface DashboardAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  actionLabel?: string;
  actionRoute?: string;
}

export interface DashboardConfig {
  roleView: RoleView;
  riskLevel: RiskLevel;
  widgets: DashboardWidget[];
  alerts: DashboardAlert[];
  navigation: string[];
  recommendedActions: string[];
  generatedBy: 'deterministic-layout-service';
  rulesApplied: string[];
}

export interface LayoutInput {
  roleView: RoleView;
  riskLevel: RiskLevel;
  overallScore: number;
  openHighRisks: number;
  pendingTasks: number;
  overdueEvidenceCount: number;
  frameworks: string[];
}

// All available widget definitions — layout rules pick and order subsets
const WIDGET_CATALOGUE: Record<string, Omit<DashboardWidget, 'position'>> = {
  readiness_gauge:        { id: 'readiness_gauge',        type: 'gauge',         title: 'Overall Readiness',         size: 'medium', dataSource: '/api/v1/readiness',                   visible: true, priority: 'high'     },
  risk_heatmap:           { id: 'risk_heatmap',           type: 'heatmap',       title: 'Risk Heatmap',              size: 'large',  dataSource: '/api/v1/risks',                       visible: true, priority: 'critical' },
  risk_summary:           { id: 'risk_summary',           type: 'summary_card',  title: 'Open High Risks',           size: 'small',  dataSource: '/api/v1/risks?severity=high,critical', visible: true, priority: 'high'     },
  control_status_pie:     { id: 'control_status_pie',     type: 'pie_chart',     title: 'Control Status',            size: 'medium', dataSource: '/api/v1/controls',                    visible: true, priority: 'medium'   },
  evidence_freshness:     { id: 'evidence_freshness',     type: 'freshness_bar', title: 'Evidence Freshness',        size: 'medium', dataSource: '/api/v1/evidence',                    visible: true, priority: 'high'     },
  task_list:              { id: 'task_list',              type: 'list',          title: 'My Tasks',                  size: 'medium', dataSource: '/api/v1/tasks?assigned=me',            visible: true, priority: 'medium'   },
  evidence_upload:        { id: 'evidence_upload',        type: 'upload_widget', title: 'Upload Evidence',           size: 'small',  dataSource: '/api/v1/evidence/upload',              visible: true, priority: 'medium'   },
  policy_status:          { id: 'policy_status',          type: 'status_list',   title: 'Policy Compliance',         size: 'medium', dataSource: '/api/v1/policies',                    visible: true, priority: 'medium'   },
  control_matrix:         { id: 'control_matrix',         type: 'table',         title: 'Control Matrix',            size: 'full',   dataSource: '/api/v1/controls/library/applicability', visible: true, priority: 'high'  },
  drift_alerts:           { id: 'drift_alerts',           type: 'alert_feed',    title: 'Drift Alerts',              size: 'medium', dataSource: '/api/v1/workflows?type=drift',         visible: true, priority: 'high'     },
  compliance_roadmap:     { id: 'compliance_roadmap',     type: 'timeline',      title: 'Compliance Roadmap',        size: 'large',  dataSource: '/api/v1/tasks?type=roadmap',           visible: true, priority: 'medium'   },
  audit_readiness_score:  { id: 'audit_readiness_score',  type: 'score_card',    title: 'Audit Readiness Score',     size: 'medium', dataSource: '/api/v1/readiness/breakdown',          visible: true, priority: 'critical' },
  vendor_risk_summary:    { id: 'vendor_risk_summary',    type: 'summary_card',  title: 'Vendor Risk Status',        size: 'small',  dataSource: '/api/v1/vendor-risk',                  visible: true, priority: 'medium'   },
  framework_coverage:     { id: 'framework_coverage',     type: 'progress_bars', title: 'Framework Coverage',        size: 'medium', dataSource: '/api/v1/readiness/breakdown',          visible: true, priority: 'high'     },
};

// Navigation items by role
const ROLE_NAV: Record<RoleView, string[]> = {
  executive:   ['/dashboard', '/readiness', '/risks', '/audit-exports'],
  security:    ['/dashboard', '/risks', '/controls', '/evidence', '/drift', '/integrations'],
  auditor:     ['/dashboard', '/controls', '/evidence', '/audit-exports', '/scoping'],
  admin:       ['/dashboard', '/risks', '/controls', '/evidence', '/policies', '/tasks', '/integrations', '/llm-gateway', '/onboarding'],
  contributor: ['/dashboard', '/tasks', '/evidence', '/policies'],
};

@Injectable()
export class DashboardLayoutService {

  /**
   * Build a deterministic dashboard configuration.
   * Applies rules R-D01 through R-D10 in order.
   */
  buildLayout(input: LayoutInput): DashboardConfig {
    const { roleView, riskLevel, pendingTasks, overdueEvidenceCount } = input;
    const rulesApplied: string[] = [];

    // ── Step 1: Base widget stack by role ──────────────────────────────────
    const widgetIds = this.baseWidgetsForRole(roleView, rulesApplied);

    // ── Step 2: Risk-level ordering rules (R-D01 / R-D02 / R-D03) ─────────
    if (riskLevel === 'HIGH') {
      rulesApplied.push('R-D01');
      // Force risk_heatmap to front
      const idx = widgetIds.indexOf('risk_heatmap');
      if (idx > 0) widgetIds.splice(idx, 1);
      widgetIds.unshift('risk_heatmap');
    } else if (riskLevel === 'LOW') {
      rulesApplied.push('R-D02');
      // Readiness gauge leads
      const idx = widgetIds.indexOf('readiness_gauge');
      if (idx > 0) widgetIds.splice(idx, 1);
      widgetIds.unshift('readiness_gauge');
    } else {
      rulesApplied.push('R-D03');
      // MEDIUM: readiness first, risk summary second
      this.bringToFront(widgetIds, 'readiness_gauge', 0);
      this.bringToFront(widgetIds, 'risk_summary', 1);
    }

    // ── Step 3: Build positioned widget objects ────────────────────────────
    const widgets: DashboardWidget[] = widgetIds.map((id, position) => ({
      ...WIDGET_CATALOGUE[id],
      position,
    }));

    // ── Step 4: Build alerts (R-D09, R-D10) ───────────────────────────────
    const alerts: DashboardAlert[] = [];

    if (pendingTasks > 5) {
      rulesApplied.push('R-D09');
      alerts.push({
        id: 'task_urgency_banner',
        type: 'warning',
        message: `${pendingTasks} tasks are pending — action required to maintain compliance posture`,
        actionLabel: 'View Tasks',
        actionRoute: '/tasks',
      });
    }

    if (overdueEvidenceCount > 0) {
      rulesApplied.push('R-D10');
      alerts.push({
        id: 'evidence_freshness_warning',
        type: 'error',
        message: `${overdueEvidenceCount} evidence item${overdueEvidenceCount > 1 ? 's are' : ' is'} stale and must be refreshed before audit`,
        actionLabel: 'Review Evidence',
        actionRoute: '/evidence',
      });
    }

    if (riskLevel === 'HIGH') {
      alerts.push({
        id: 'high_risk_banner',
        type: 'error',
        message: 'High risk level detected — immediate remediation required. This report requires human review.',
        actionLabel: 'View Risks',
        actionRoute: '/risks',
      });
    }

    // ── Step 5: Recommended actions ───────────────────────────────────────
    const recommendedActions = this.buildRecommendedActions(input, rulesApplied);

    return {
      roleView,
      riskLevel,
      widgets,
      alerts,
      navigation: ROLE_NAV[roleView],
      recommendedActions,
      generatedBy: 'deterministic-layout-service',
      rulesApplied: [...new Set(rulesApplied)],
    };
  }

  private baseWidgetsForRole(role: RoleView, rulesApplied: string[]): string[] {
    switch (role) {
      case 'executive':
        rulesApplied.push('R-D04');
        return ['readiness_gauge', 'audit_readiness_score', 'framework_coverage', 'risk_summary', 'compliance_roadmap'];

      case 'security':
        rulesApplied.push('R-D07');
        return ['risk_heatmap', 'drift_alerts', 'control_status_pie', 'evidence_freshness', 'vendor_risk_summary', 'policy_status'];

      case 'auditor':
        rulesApplied.push('R-D05');
        return ['control_matrix', 'evidence_freshness', 'audit_readiness_score', 'policy_status', 'framework_coverage'];

      case 'contributor':
        rulesApplied.push('R-D06');
        return ['task_list', 'evidence_upload', 'control_status_pie', 'policy_status'];

      case 'admin':
        rulesApplied.push('R-D08');
        return [
          'readiness_gauge', 'risk_heatmap', 'control_status_pie', 'evidence_freshness',
          'task_list', 'policy_status', 'drift_alerts', 'framework_coverage',
          'vendor_risk_summary', 'audit_readiness_score', 'compliance_roadmap',
        ];

      default:
        return ['readiness_gauge', 'control_status_pie', 'task_list'];
    }
  }

  private buildRecommendedActions(input: LayoutInput, _rulesApplied: string[]): string[] {
    const actions: string[] = [];

    if (input.riskLevel === 'HIGH') {
      actions.push('Immediate: Address critical and high risks in the risk register');
    }
    if (input.overdueEvidenceCount > 0) {
      actions.push(`Upload ${input.overdueEvidenceCount} stale evidence item${input.overdueEvidenceCount > 1 ? 's' : ''}`);
    }
    if (input.overallScore < 50) {
      actions.push('Prioritise control implementation — readiness below 50%');
    }
    if (input.pendingTasks > 10) {
      actions.push('Assign overdue tasks to team members');
    }
    if (input.openHighRisks > 0) {
      actions.push(`Review ${input.openHighRisks} open high-severity risk${input.openHighRisks > 1 ? 's' : ''}`);
    }

    return actions;
  }

  private bringToFront(ids: string[], id: string, targetIndex: number): void {
    const idx = ids.indexOf(id);
    if (idx === -1) {
      ids.splice(targetIndex, 0, id);
    } else if (idx !== targetIndex) {
      ids.splice(idx, 1);
      ids.splice(targetIndex, 0, id);
    }
  }
}
