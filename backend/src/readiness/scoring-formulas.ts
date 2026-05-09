/**
 * Deterministic readiness scoring formulas.
 * LLMs NEVER generate scores — pure math only.
 *
 * SOC 2 formula:
 *   soc2 = controlDesign*0.35 + evidence*0.30 + policy*0.25 + operational*0.10
 *
 * ISO 27001 formula:
 *   iso = controlDesign*0.30 + evidence*0.25 + policy*0.20 + riskManagement*0.15 + operational*0.10
 */

export interface ScoreInputs {
  // Control design
  applicableControls: number;
  implementedControls: number;
  inProgressControls: number;

  // Evidence
  requiredEvidenceItems: number;
  validEvidenceItems: number;
  staleEvidenceItems: number;

  // Policy
  requiredPolicies: number;
  approvedPolicies: number;
  draftPolicies: number;

  // Risk management (ISO 27001 specific)
  openHighRisks: number;
  totalHighRisks: number;
  openCriticalRisks: number;
  riskTreatmentsAccepted: number;
  totalRisks: number;

  // Operational
  overdueTasks: number;
  totalTasks: number;
  openCheckpoints: number;
}

export interface FrameworkScore {
  overall: number;
  controlDesign: number;
  evidence: number;
  policy: number;
  operational: number;
  riskManagement?: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readinessLabel: 'audit-ready' | 'near-ready' | 'in-progress' | 'early-stage' | 'not-started';
}

export interface ReadinessScoreOutput {
  soc2?: FrameworkScore;
  iso27001?: FrameworkScore;
  overall: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  formulaVersion: string;
  scoreInputs: ScoreInputs;
  computedAt: Date;
}

export const FORMULA_VERSION = '1.0.0';

/** Slug-to-label map for all 10 supported frameworks */
export const FRAMEWORK_SLUG_LABELS: Record<string, string> = {
  soc2:     'SOC2',
  iso27001: 'ISO27001',
  hipaa:    'HIPAA',
  'pci-dss': 'PCI_DSS',
  fedramp:  'FEDRAMP',
  'nist-csf': 'NIST_CSF',
  iso9001:  'ISO9001',
  iso14001: 'ISO14001',
  iso45001: 'ISO45001',
  gdpr:     'GDPR',
};

/**
 * Calculate control design score.
 * Partial credit (0.5) for in-progress controls.
 */
function controlDesignScore(inputs: ScoreInputs): number {
  if (inputs.applicableControls === 0) return 0;
  const effective = inputs.implementedControls + inputs.inProgressControls * 0.5;
  return Math.round((effective / inputs.applicableControls) * 100);
}

/**
 * Calculate evidence score with staleness penalty.
 * Stale items count as 0, valid items count as 1, missing = 0.
 */
function evidenceScore(inputs: ScoreInputs): number {
  if (inputs.requiredEvidenceItems === 0) return 100; // no evidence required → full score
  const validNonStale = Math.max(0, inputs.validEvidenceItems - inputs.staleEvidenceItems);
  const stalenessPenalty = inputs.staleEvidenceItems * 0.5; // stale = half credit
  const effective = validNonStale + stalenessPenalty;
  return Math.min(100, Math.round((effective / inputs.requiredEvidenceItems) * 100));
}

/**
 * Calculate policy score.
 * Draft policies get 0.3 partial credit (exist but not approved).
 */
function policyScore(inputs: ScoreInputs): number {
  if (inputs.requiredPolicies === 0) return 100;
  const effective = inputs.approvedPolicies + inputs.draftPolicies * 0.3;
  return Math.min(100, Math.round((effective / inputs.requiredPolicies) * 100));
}

/**
 * Calculate operational score.
 * Penalizes overdue tasks and open checkpoints.
 */
function operationalScore(inputs: ScoreInputs): number {
  let score = 100;

  // Task overdue penalty
  if (inputs.totalTasks > 0) {
    const overduePct = inputs.overdueTasks / inputs.totalTasks;
    score -= overduePct * 40; // up to -40 for all tasks overdue
  }

  // Open checkpoint penalty
  score -= inputs.openCheckpoints * 10; // -10 per unresolved checkpoint

  return Math.max(0, Math.round(score));
}

/**
 * Calculate risk management score (ISO 27001 specific).
 */
function riskManagementScore(inputs: ScoreInputs): number {
  if (inputs.totalRisks === 0) return 0; // no risks identified = early stage

  let score = 100;

  // Critical risks not addressed
  score -= inputs.openCriticalRisks * 15;

  // High risks not addressed
  if (inputs.totalHighRisks > 0) {
    const highRiskPct = inputs.openHighRisks / inputs.totalHighRisks;
    score -= highRiskPct * 30;
  }

  return Math.max(0, Math.round(score));
}

/**
 * Compute full SOC 2 readiness score.
 */
export function computeSoc2Score(inputs: ScoreInputs): FrameworkScore {
  const cd = controlDesignScore(inputs);
  const ev = evidenceScore(inputs);
  const po = policyScore(inputs);
  const op = operationalScore(inputs);

  const overall = Math.round(
    cd * 0.35 +
    ev * 0.30 +
    po * 0.25 +
    op * 0.10,
  );

  return {
    overall,
    controlDesign: cd,
    evidence: ev,
    policy: po,
    operational: op,
    grade: toGrade(overall),
    readinessLabel: toLabel(overall),
  };
}

/**
 * Compute full ISO 27001 readiness score.
 * Also used as the generic risk-based scoring formula for HIPAA, PCI-DSS,
 * FedRAMP, NIST CSF, ISO 9001, ISO 14001, ISO 45001, and GDPR — all of
 * which include risk management as a core compliance domain.
 */
export function computeIso27001Score(inputs: ScoreInputs): FrameworkScore {
  const cd = controlDesignScore(inputs);
  const ev = evidenceScore(inputs);
  const po = policyScore(inputs);
  const rm = riskManagementScore(inputs);
  const op = operationalScore(inputs);

  const overall = Math.round(
    cd * 0.30 +
    ev * 0.25 +
    po * 0.20 +
    rm * 0.15 +
    op * 0.10,
  );

  return {
    overall,
    controlDesign: cd,
    evidence: ev,
    policy: po,
    riskManagement: rm,
    operational: op,
    grade: toGrade(overall),
    readinessLabel: toLabel(overall),
  };
}

/**
 * Generic risk-based scoring formula — alias for computeIso27001Score.
 * Used for HIPAA, PCI-DSS, FedRAMP, NIST CSF, ISO 9001, ISO 14001, ISO 45001, GDPR.
 */
export const computeGenericScore = computeIso27001Score;

function toGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function toLabel(score: number): 'audit-ready' | 'near-ready' | 'in-progress' | 'early-stage' | 'not-started' {
  if (score >= 85) return 'audit-ready';
  if (score >= 70) return 'near-ready';
  if (score >= 40) return 'in-progress';
  if (score >= 10) return 'early-stage';
  return 'not-started';
}
