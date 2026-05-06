/**
 * FILE 2: Readiness Scoring Formula Tests
 * Tests the deterministic scoring formulas — no LLM, pure math.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  computeSoc2Score,
  computeIso27001Score,
  ScoreInputs,
  FORMULA_VERSION,
} from './scoring-formulas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseInputs(overrides: Partial<ScoreInputs> = {}): ScoreInputs {
  return {
    applicableControls: 50,
    implementedControls: 25,
    inProgressControls: 0,
    requiredEvidenceItems: 40,
    validEvidenceItems: 20,
    staleEvidenceItems: 0,
    requiredPolicies: 10,
    approvedPolicies: 5,
    draftPolicies: 0,
    openHighRisks: 0,
    totalHighRisks: 0,
    openCriticalRisks: 0,
    riskTreatmentsAccepted: 0,
    totalRisks: 0,
    overdueTasks: 0,
    totalTasks: 10,
    openCheckpoints: 0,
    ...overrides,
  };
}

function perfectInputs(): ScoreInputs {
  return {
    applicableControls: 50,
    implementedControls: 50,
    inProgressControls: 0,
    requiredEvidenceItems: 40,
    validEvidenceItems: 40,
    staleEvidenceItems: 0,
    requiredPolicies: 10,
    approvedPolicies: 10,
    draftPolicies: 0,
    openHighRisks: 0,
    totalHighRisks: 0,
    openCriticalRisks: 0,
    riskTreatmentsAccepted: 0,
    totalRisks: 10,
    overdueTasks: 0,
    totalTasks: 10,
    openCheckpoints: 0,
  };
}

function zeroInputs(): ScoreInputs {
  return {
    applicableControls: 50,
    implementedControls: 0,
    inProgressControls: 0,
    requiredEvidenceItems: 40,
    validEvidenceItems: 0,
    staleEvidenceItems: 0,
    requiredPolicies: 10,
    approvedPolicies: 0,
    draftPolicies: 0,
    openHighRisks: 0,
    totalHighRisks: 0,
    openCriticalRisks: 0,
    riskTreatmentsAccepted: 0,
    totalRisks: 0,
    overdueTasks: 0,
    totalTasks: 10,
    openCheckpoints: 0,
  };
}

// ─── SOC 2 scoring ───────────────────────────────────────────────────────────

describe('computeSoc2Score', () => {
  it('is deterministic — same inputs produce same score', () => {
    const inputs = baseInputs();
    const result1 = computeSoc2Score(inputs);
    const result2 = computeSoc2Score(inputs);
    expect(result1.overall).toBe(result2.overall);
    expect(result1.controlDesign).toBe(result2.controlDesign);
    expect(result1.evidence).toBe(result2.evidence);
    expect(result1.policy).toBe(result2.policy);
    expect(result1.operational).toBe(result2.operational);
  });

  it('returns controlDesign = 0 when zero controls implemented', () => {
    const inputs = baseInputs({ implementedControls: 0, inProgressControls: 0 });
    const result = computeSoc2Score(inputs);
    expect(result.controlDesign).toBe(0);
  });

  it('returns controlDesign = 100 when all controls implemented', () => {
    const inputs = baseInputs({ implementedControls: 50, inProgressControls: 0 });
    const result = computeSoc2Score(inputs);
    expect(result.controlDesign).toBe(100);
  });

  it('returns evidence = 0 when no valid evidence and evidence required', () => {
    const inputs = baseInputs({ validEvidenceItems: 0, staleEvidenceItems: 0, requiredEvidenceItems: 10 });
    const result = computeSoc2Score(inputs);
    expect(result.evidence).toBe(0);
  });

  it('returns evidence = 100 when all evidence is valid and not stale', () => {
    const inputs = baseInputs({ validEvidenceItems: 40, staleEvidenceItems: 0, requiredEvidenceItems: 40 });
    const result = computeSoc2Score(inputs);
    expect(result.evidence).toBe(100);
  });

  it('stale evidence reduces evidence score', () => {
    const baseResult = computeSoc2Score(
      baseInputs({ validEvidenceItems: 40, staleEvidenceItems: 0, requiredEvidenceItems: 40 }),
    );
    const staleResult = computeSoc2Score(
      baseInputs({ validEvidenceItems: 40, staleEvidenceItems: 20, requiredEvidenceItems: 40 }),
    );
    expect(staleResult.evidence).toBeLessThan(baseResult.evidence);
  });

  it('returns policy = 100 when all policies approved', () => {
    const inputs = baseInputs({ approvedPolicies: 10, requiredPolicies: 10, draftPolicies: 0 });
    const result = computeSoc2Score(inputs);
    expect(result.policy).toBe(100);
  });

  it('returns policy = 0 when no policies approved and no drafts', () => {
    const inputs = baseInputs({ approvedPolicies: 0, draftPolicies: 0, requiredPolicies: 10 });
    const result = computeSoc2Score(inputs);
    expect(result.policy).toBe(0);
  });

  it('overall score is bounded between 0 and 100', () => {
    const worstResult = computeSoc2Score(zeroInputs());
    const bestResult = computeSoc2Score(perfectInputs());
    expect(worstResult.overall).toBeGreaterThanOrEqual(0);
    expect(worstResult.overall).toBeLessThanOrEqual(100);
    expect(bestResult.overall).toBeGreaterThanOrEqual(0);
    expect(bestResult.overall).toBeLessThanOrEqual(100);
  });

  it('component scores are bounded between 0 and 100', () => {
    const result = computeSoc2Score(zeroInputs());
    expect(result.controlDesign).toBeGreaterThanOrEqual(0);
    expect(result.controlDesign).toBeLessThanOrEqual(100);
    expect(result.evidence).toBeGreaterThanOrEqual(0);
    expect(result.evidence).toBeLessThanOrEqual(100);
    expect(result.policy).toBeGreaterThanOrEqual(0);
    expect(result.policy).toBeLessThanOrEqual(100);
    expect(result.operational).toBeGreaterThanOrEqual(0);
    expect(result.operational).toBeLessThanOrEqual(100);
  });

  it('uses SOC 2 formula weights: controls 35%, evidence 30%, policy 25%, operational 10%', () => {
    // Perfect score: each sub-score = 100
    // overall = 100*0.35 + 100*0.30 + 100*0.25 + 100*0.10 = 100
    const perfect = computeSoc2Score(perfectInputs());
    expect(perfect.overall).toBe(100);

    // Only controls at 100, rest 0 → should be ~35
    // We need to force the other sub-scores to 0 to verify weight
    // All controls done, zero evidence, zero policy, no overdue tasks
    const controlsOnly = computeSoc2Score({
      applicableControls: 10,
      implementedControls: 10,
      inProgressControls: 0,
      requiredEvidenceItems: 10,
      validEvidenceItems: 0,
      staleEvidenceItems: 0,
      requiredPolicies: 10,
      approvedPolicies: 0,
      draftPolicies: 0,
      openHighRisks: 0,
      totalHighRisks: 0,
      openCriticalRisks: 0,
      riskTreatmentsAccepted: 0,
      totalRisks: 0,
      overdueTasks: 0,
      totalTasks: 0, // no tasks → operational = 100 (no penalty)
      openCheckpoints: 0,
    });
    // controlDesign=100, evidence=0, policy=0, operational=100
    // overall = 100*0.35 + 0*0.30 + 0*0.25 + 100*0.10 = 35 + 10 = 45
    expect(controlsOnly.controlDesign).toBe(100);
    expect(controlsOnly.evidence).toBe(0);
    expect(controlsOnly.policy).toBe(0);
    expect(controlsOnly.operational).toBe(100);
    expect(controlsOnly.overall).toBe(45);
  });

  it('returns grade A for score >= 90', () => {
    const result = computeSoc2Score(perfectInputs());
    expect(result.overall).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('returns readinessLabel "audit-ready" for score >= 85', () => {
    const result = computeSoc2Score(perfectInputs());
    expect(result.readinessLabel).toBe('audit-ready');
  });

  it('returns readinessLabel "not-started" for very low scores', () => {
    // Force all scores to 0 except operational which starts at 100
    const result = computeSoc2Score({
      ...zeroInputs(),
      openCheckpoints: 10, // -100 operational penalty
    });
    // operational = max(0, 100 - 10*10) = 0
    // overall = 0*0.35 + 0*0.30 + 0*0.25 + 0*0.10 = 0
    expect(result.overall).toBe(0);
    expect(result.readinessLabel).toBe('not-started');
  });

  it('returns grade F for score < 40', () => {
    const result = computeSoc2Score({
      ...zeroInputs(),
      openCheckpoints: 10,
    });
    expect(result.grade).toBe('F');
  });

  it('partial credit: in-progress controls contribute 0.5 weight', () => {
    const inProgress = computeSoc2Score(
      baseInputs({ implementedControls: 0, inProgressControls: 50, applicableControls: 50 }),
    );
    const halfImplemented = computeSoc2Score(
      baseInputs({ implementedControls: 25, inProgressControls: 0, applicableControls: 50 }),
    );
    // Both should give controlDesign = 50
    expect(inProgress.controlDesign).toBe(50);
    expect(halfImplemented.controlDesign).toBe(50);
  });
});

// ─── ISO 27001 scoring ────────────────────────────────────────────────────────

describe('computeIso27001Score', () => {
  it('is deterministic — same inputs produce same score', () => {
    const inputs = baseInputs({ totalRisks: 5, openHighRisks: 1, totalHighRisks: 2 });
    const r1 = computeIso27001Score(inputs);
    const r2 = computeIso27001Score(inputs);
    expect(r1.overall).toBe(r2.overall);
  });

  it('includes riskManagement field in output', () => {
    const result = computeIso27001Score(baseInputs({ totalRisks: 5 }));
    expect(result.riskManagement).toBeDefined();
  });

  it('overall score is bounded between 0 and 100', () => {
    const worstResult = computeIso27001Score({
      ...zeroInputs(),
      totalRisks: 5,
      openCriticalRisks: 5,
      openHighRisks: 5,
      totalHighRisks: 5,
      openCheckpoints: 10,
    });
    const bestResult = computeIso27001Score(perfectInputs());
    expect(worstResult.overall).toBeGreaterThanOrEqual(0);
    expect(worstResult.overall).toBeLessThanOrEqual(100);
    expect(bestResult.overall).toBeGreaterThanOrEqual(0);
    expect(bestResult.overall).toBeLessThanOrEqual(100);
  });

  it('perfect ISO inputs score 100 overall', () => {
    const result = computeIso27001Score(perfectInputs());
    expect(result.overall).toBe(100);
  });
});

// ─── No LLM imports ──────────────────────────────────────────────────────────

describe('readinessScoringNeverCallsLLM', () => {
  it('scoring-formulas.ts does not import LlmService or LlmGatewayService', () => {
    const filePath = path.resolve(__dirname, 'scoring-formulas.ts');
    const source = fs.readFileSync(filePath, 'utf-8');
    expect(source).not.toContain('LlmService');
    expect(source).not.toContain('LlmGatewayService');
  });
});

// ─── FORMULA_VERSION ─────────────────────────────────────────────────────────

describe('FORMULA_VERSION', () => {
  it('is a valid semver string', () => {
    expect(FORMULA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
