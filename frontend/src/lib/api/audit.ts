/**
 * Audit API — typed client for audit-memory, audit-exports, and control-tests endpoints.
 *
 * Covers:
 *  - Audit history (cycles + findings)
 *  - Audit exports (SOC2, ISO SoA, control matrix, executive summary)
 *  - Control health tests (summary, results, run)
 *  - Org stats for the overview dashboard
 */

import { apiClient } from './client';

// ─── Audit History Types ──────────────────────────────────────────────────────

export interface AuditCycle {
  id:           string;
  framework:    string;
  label:        string;
  status:       string;
  startDate:    string;
  endDate?:     string;
  auditorName?: string;
  auditorFirm?: string;
  notes?:       string;
  outcome?:     string;
  createdAt:    string;
  creator:      { id: string; fullName: string };
  _count:       { findings: number };
}

export interface AuditFinding {
  id:           string;
  cycleId?:     string;
  auditCycleId?: string;
  controlId?:   string;
  findingType?: string;
  title:        string;
  description:  string;
  severity:     string;
  status:       string;
  remediation?: string;
  lessonLearned?: string;
  resolvedAt?:  string;
  createdAt?:   string;
  updatedAt?:   string;
  auditCycle?:  { id: string; label: string; framework: string };
  control?:     { id?: string; code: string; title: string };
  resolver?:    { id: string; fullName: string };
}

export interface AuditStats {
  totalCycles:   number;
  openFindings:  number;
  resolvedRate:  number;
  lastAuditDate: string | null;
}

export interface AuditDebrief {
  summary:      string;
  keyFindings:  string[];
  nextSteps:    string[];
  generatedAt:  string;
}

export interface FindingRemediation {
  steps:        string[];
  references:   string[];
  generatedAt:  string;
}

// ─── Audit Export Types ───────────────────────────────────────────────────────

export interface AuditExport {
  id:                 string;
  exportType:         string;
  framework:          string;
  status:             string;
  disclaimerIncluded: boolean;
  createdAt:          string;
  dataSnapshotAt:     string;
}

export interface AuditExportDetail extends AuditExport {
  content: Record<string, unknown>;
}

export interface ExecSummary {
  headline:                  string;
  executiveSummary:          string;
  auditReadinessStatement:   string;
  keyStrengths:              string[];
  keyRisks:                  string[];
  managementAttestation:     string;
  nextSteps:                 string[];
  metadata: {
    score:           number | string;
    implemented:     number;
    total:           number;
    openHighRisks:   number;
    overdueTasks:    number;
  };
  generatedAt: string;
}

// ─── Control Test Types ───────────────────────────────────────────────────────

export interface ControlTestSummary {
  total:    number;
  pass:     number;
  fail:     number;
  warning:  number;
  error?:   number;
  skipped?: number;
  passRate: number;
  lastRunAt?: string | null;
}

export interface ControlTestResult {
  id:          string;
  testId:      string;
  testName:    string;
  controlCode: string;
  outcome:     'pass' | 'fail' | 'warning' | 'skipped';
  details:     string;
  runAt:       string;
}

// ─── Org Stats Type ───────────────────────────────────────────────────────────

export interface OrgStats {
  complianceScore:     number;
  totalControls:       number;
  implementedControls: number;
  openRisks:           number;
  openTasks?:          number;
  expiredEvidence?:    number;
  totalEvidence?:      number;
  frameworks?:         string[];
  [key: string]:       unknown;  // allow extra fields from backend
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const auditApi = {
  // ── Audit History ─────────────────────────────────────────────────────────

  getStats(): Promise<AuditStats> {
    return apiClient.get('/audit-memory/stats').then((r) => r.data);
  },

  getCycles(): Promise<AuditCycle[]> {
    return apiClient.get('/audit-memory/cycles').then((r) => r.data);
  },

  getCycle(id: string): Promise<AuditCycle & { findings: AuditFinding[] }> {
    return apiClient.get(`/audit-memory/cycles/${id}`).then((r) => r.data);
  },

  createCycle(data: Partial<AuditCycle>): Promise<AuditCycle> {
    return apiClient.post('/audit-memory/cycles', data).then((r) => r.data);
  },

  getFindings(): Promise<AuditFinding[]> {
    return apiClient.get('/audit-memory/findings').then((r) => r.data);
  },

  createFinding(data: Partial<AuditFinding>): Promise<AuditFinding> {
    return apiClient.post('/audit-memory/findings', data).then((r) => r.data);
  },

  resolveFinding(id: string): Promise<AuditFinding> {
    return apiClient.patch(`/audit-memory/findings/${id}`, { status: 'resolved' }).then((r) => r.data);
  },

  aiDebrief(cycleId: string): Promise<AuditDebrief> {
    return apiClient.post(`/audit-memory/cycles/${cycleId}/ai-debrief`).then((r) => r.data);
  },

  aiFindingRemediation(findingId: string): Promise<FindingRemediation> {
    return apiClient.post(`/audit-memory/findings/${findingId}/ai-remediation`).then((r) => r.data);
  },

  // ── Audit Exports ─────────────────────────────────────────────────────────

  listExports(): Promise<AuditExport[]> {
    return apiClient.get('/audit-exports').then((r) => r.data);
  },

  getExport(id: string): Promise<AuditExportDetail> {
    return apiClient.get(`/audit-exports/${id}`).then((r) => r.data);
  },

  generateExport(endpoint: string): Promise<AuditExport> {
    return apiClient.post(endpoint).then((r) => r.data);
  },

  aiExecutiveSummary(): Promise<ExecSummary> {
    return apiClient.post('/audit-exports/ai-executive-summary').then((r) => r.data);
  },

  // ── Control Tests ─────────────────────────────────────────────────────────

  getControlTestSummary(): Promise<ControlTestSummary> {
    return apiClient.get('/control-tests/summary').then((r) => r.data);
  },

  getControlTestResults(): Promise<ControlTestResult[]> {
    return apiClient.get('/control-tests/results').then((r) => r.data);
  },

  runAllControlTests(): Promise<void> {
    return apiClient.post('/control-tests/run').then(() => undefined);
  },

  runControlTest(testId: string): Promise<ControlTestResult> {
    return apiClient.post(`/control-tests/run/${testId}`).then((r) => r.data);
  },

  // ── Org Stats ─────────────────────────────────────────────────────────────

  getOrgStats(): Promise<OrgStats> {
    return apiClient.get('/organizations/me/stats').then((r) => r.data);
  },

  triggerAssessment(frameworkType: string): Promise<{ jobId: string }> {
    return apiClient.post('/orchestrator/assess', { frameworkType }).then((r) => r.data);
  },

  /**
   * Download the full audit package as a ZIP file.
   * Returns a Blob (client should trigger browser download).
   */
  async downloadAuditPackage(): Promise<Blob> {
    const response = await apiClient.post('/audit-exports/audit-package', {}, { responseType: 'blob' });
    return response.data as Blob;
  },
};
