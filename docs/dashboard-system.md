# Dashboard System

The Dashboard system generates **role-specific, risk-aware layout configurations** for the compliance platform UI. All layout decisions are made deterministically — no LLMs are involved in deciding which widgets to show or in what order.

---

## Architecture

```
DashboardAgent (BullMQ queue: agent.dashboard — pipeline stage 18)
       ↓
DashboardLayoutService.buildLayout(input)  ← DETERMINISTIC
       ↓
DashboardConfig { widgets, alerts, navigation, recommendedActions }
       ↓
prisma.dashboardConfig.create()
       ↓
GET /dashboard/config → frontend renderer
```

---

## Deterministic Layout Rules (R-D01 through R-D10)

| Rule | Trigger | Effect |
|------|---------|--------|
| R-D01 | `risk_level = HIGH` | `risk_heatmap` forced to widget position 0 |
| R-D02 | `risk_level = LOW` | `readiness_gauge` at position 0 |
| R-D03 | `risk_level = MEDIUM` | `readiness_gauge` at 0, `risk_summary` at 1 |
| R-D04 | `roleView = executive` | Hides `control_matrix`; shows `readiness_gauge`, `compliance_roadmap`, `framework_coverage` |
| R-D05 | `roleView = auditor` | Shows `control_matrix` and `evidence_freshness` prominently |
| R-D06 | `roleView = contributor` | Shows `task_list` and `evidence_upload` as primary widgets |
| R-D07 | `roleView = security` | Shows `risk_heatmap` and `drift_alerts` first |
| R-D08 | `roleView = admin` | Full widget set (all 11 widgets) |
| R-D09 | `pendingTasks > 5` | Adds `task_urgency_banner` alert (warning) |
| R-D10 | `overdueEvidenceCount > 0` | Adds `evidence_freshness_warning` alert (error) |

Additionally: `risk_level = HIGH` always adds a `high_risk_banner` error alert with link to risks.

---

## Widget Catalogue

| Widget ID | Type | Description | Roles |
|-----------|------|-------------|-------|
| `readiness_gauge` | gauge | Overall readiness % | all |
| `risk_heatmap` | heatmap | Risk heat map by category | security, admin, (HIGH forced) |
| `risk_summary` | summary_card | Open high+critical risk count | executive, admin |
| `control_status_pie` | pie_chart | Implemented / in-progress / not-started | all |
| `evidence_freshness` | freshness_bar | Evidence age vs. maximum allowed freshness | auditor, security |
| `task_list` | list | My assigned tasks | contributor, admin |
| `evidence_upload` | upload_widget | Upload evidence file | contributor |
| `policy_status` | status_list | Policy approval status | all |
| `control_matrix` | table | Full applicability matrix | auditor, admin |
| `drift_alerts` | alert_feed | Drift detection events | security, admin |
| `compliance_roadmap` | timeline | Roadmap milestones | executive, admin |
| `audit_readiness_score` | score_card | Per-category readiness breakdown | executive, auditor, admin |
| `vendor_risk_summary` | summary_card | Third-party risk status | security, admin |
| `framework_coverage` | progress_bars | Per-framework coverage % | executive, admin |

---

## Role Navigation

| Role | Navigation items |
|------|-----------------|
| `executive` | `/dashboard`, `/readiness`, `/risks`, `/audit-exports` |
| `security` | `/dashboard`, `/risks`, `/controls`, `/evidence`, `/drift`, `/integrations` |
| `auditor` | `/dashboard`, `/controls`, `/evidence`, `/audit-exports`, `/scoping` |
| `admin` | All pages |
| `contributor` | `/dashboard`, `/tasks`, `/evidence`, `/policies` |

---

## Dashboard Config Schema

```typescript
interface DashboardConfig {
  roleView: 'executive' | 'security' | 'auditor' | 'admin' | 'contributor';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  widgets: DashboardWidget[];     // position-ordered
  alerts: DashboardAlert[];
  navigation: string[];
  recommendedActions: string[];
  generatedBy: 'deterministic-layout-service';  // never 'llm'
  rulesApplied: string[];         // e.g. ['R-D01', 'R-D08', 'R-D09']
}
```

---

## Regenerating the Dashboard

```bash
# Via API (admin only)
POST /dashboard/regenerate

# Directly via workflow engine (spawns full pipeline)
POST /orchestrator/trigger   { orgId, name: "Dashboard Refresh" }
```

The `DashboardAgent` receives the `InferenceOutput` as its `inputPayload` (from the previous pipeline step) so it always uses the current risk level without an extra DB round-trip.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/modules/dashboard/dashboard-layout.service.ts` | All 10 layout rules — deterministic |
| `src/agents/dashboard/dashboard.agent.ts` | BullMQ handler — calls layout service, persists config |
| `src/modules/dashboard/dashboard.controller.ts` | API routes |
| `src/modules/dashboard/dashboard.module.ts` | NestJS module |
| `src/modules/dashboard/dashboard-layout.spec.ts` | 15 unit tests (DL01–DL15) |
