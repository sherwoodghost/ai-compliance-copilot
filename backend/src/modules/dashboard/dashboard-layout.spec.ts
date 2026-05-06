/**
 * DashboardLayoutService Tests
 * DL01–DL10: Verify all 10 layout rules fire correctly
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DashboardLayoutService, LayoutInput } from './dashboard-layout.service';

function makeInput(overrides: Partial<LayoutInput> = {}): LayoutInput {
  return {
    roleView: 'executive',
    riskLevel: 'MEDIUM',
    overallScore: 55,
    openHighRisks: 2,
    pendingTasks: 3,
    overdueEvidenceCount: 0,
    frameworks: ['SOC2'],
    ...overrides,
  };
}

describe('DashboardLayoutService', () => {
  let service: DashboardLayoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardLayoutService],
    }).compile();
    service = module.get(DashboardLayoutService);
  });

  it('DL01 — R-D01: HIGH risk puts risk_heatmap at position 0', () => {
    const config = service.buildLayout(makeInput({ riskLevel: 'HIGH', roleView: 'admin' }));
    expect(config.widgets[0].id).toBe('risk_heatmap');
    expect(config.rulesApplied).toContain('R-D01');
  });

  it('DL02 — R-D02: LOW risk puts readiness_gauge at position 0', () => {
    const config = service.buildLayout(makeInput({ riskLevel: 'LOW', roleView: 'executive' }));
    expect(config.widgets[0].id).toBe('readiness_gauge');
    expect(config.rulesApplied).toContain('R-D02');
  });

  it('DL03 — R-D03: MEDIUM risk puts readiness_gauge at 0, risk_summary at 1', () => {
    const config = service.buildLayout(makeInput({ riskLevel: 'MEDIUM', roleView: 'admin' }));
    expect(config.widgets[0].id).toBe('readiness_gauge');
    expect(config.widgets[1].id).toBe('risk_summary');
    expect(config.rulesApplied).toContain('R-D03');
  });

  it('DL04 — R-D04: executive role hides raw control list, shows score + roadmap', () => {
    const config = service.buildLayout(makeInput({ roleView: 'executive' }));
    const ids = config.widgets.map((w) => w.id);
    expect(ids).not.toContain('control_matrix');
    expect(ids).toContain('readiness_gauge');
    expect(ids).toContain('compliance_roadmap');
    expect(config.rulesApplied).toContain('R-D04');
  });

  it('DL05 — R-D05: auditor role shows control_matrix and evidence_freshness first-ish', () => {
    const config = service.buildLayout(makeInput({ roleView: 'auditor' }));
    const ids = config.widgets.map((w) => w.id);
    expect(ids).toContain('control_matrix');
    expect(ids).toContain('evidence_freshness');
    expect(config.rulesApplied).toContain('R-D05');
  });

  it('DL06 — R-D06: contributor role shows task_list and evidence_upload', () => {
    const config = service.buildLayout(makeInput({ roleView: 'contributor' }));
    const ids = config.widgets.map((w) => w.id);
    expect(ids).toContain('task_list');
    expect(ids).toContain('evidence_upload');
    expect(config.rulesApplied).toContain('R-D06');
  });

  it('DL07 — R-D07: security role shows risk_heatmap and drift_alerts prominently', () => {
    const config = service.buildLayout(makeInput({ roleView: 'security', riskLevel: 'LOW' }));
    const ids = config.widgets.map((w) => w.id);
    expect(ids).toContain('risk_heatmap');
    expect(ids).toContain('drift_alerts');
    expect(config.rulesApplied).toContain('R-D07');
  });

  it('DL08 — R-D08: admin role has full widget set', () => {
    const config = service.buildLayout(makeInput({ roleView: 'admin', riskLevel: 'MEDIUM' }));
    const ids = config.widgets.map((w) => w.id);
    // Admin should have the most widgets
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(config.rulesApplied).toContain('R-D08');
  });

  it('DL09 — R-D09: pendingTasks > 5 shows task_urgency_banner alert', () => {
    const config = service.buildLayout(makeInput({ pendingTasks: 10 }));
    const alert = config.alerts.find((a) => a.id === 'task_urgency_banner');
    expect(alert).toBeDefined();
    expect(alert!.type).toBe('warning');
    expect(config.rulesApplied).toContain('R-D09');
  });

  it('DL10 — R-D10: overdueEvidenceCount > 0 shows evidence_freshness_warning alert', () => {
    const config = service.buildLayout(makeInput({ overdueEvidenceCount: 3 }));
    const alert = config.alerts.find((a) => a.id === 'evidence_freshness_warning');
    expect(alert).toBeDefined();
    expect(alert!.type).toBe('error');
    expect(config.rulesApplied).toContain('R-D10');
  });

  it('DL11 — HIGH risk also adds high_risk_banner alert', () => {
    const config = service.buildLayout(makeInput({ riskLevel: 'HIGH' }));
    const alert = config.alerts.find((a) => a.id === 'high_risk_banner');
    expect(alert).toBeDefined();
    expect(alert!.type).toBe('error');
  });

  it('DL12 — deterministic: same input produces identical output across runs', () => {
    const input = makeInput({ roleView: 'security', riskLevel: 'HIGH', pendingTasks: 8 });
    const config1 = service.buildLayout(input);
    const config2 = service.buildLayout(input);
    expect(JSON.stringify(config1)).toBe(JSON.stringify(config2));
  });

  it('DL13 — widget positions are zero-indexed and sequential', () => {
    const config = service.buildLayout(makeInput({ roleView: 'admin' }));
    config.widgets.forEach((w, i) => {
      expect(w.position).toBe(i);
    });
  });

  it('DL14 — navigation contains /dashboard for all roles', () => {
    const roles: Array<LayoutInput['roleView']> = ['executive', 'security', 'auditor', 'admin', 'contributor'];
    for (const roleView of roles) {
      const config = service.buildLayout(makeInput({ roleView }));
      expect(config.navigation).toContain('/dashboard');
    }
  });

  it('DL15 — generatedBy is always deterministic-layout-service (never LLM)', () => {
    const config = service.buildLayout(makeInput());
    expect(config.generatedBy).toBe('deterministic-layout-service');
  });
});
