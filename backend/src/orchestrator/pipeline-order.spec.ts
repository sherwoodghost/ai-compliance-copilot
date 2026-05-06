/**
 * Pipeline Order Invariant Tests
 *
 * PO01–PO10: Verify the pipeline ordering constraints that agents depend on.
 * These tests protect against accidental reordering during refactors.
 */

import { QUEUE_NAMES, FULL_PIPELINE } from './queue.config';

const RESOLVED = FULL_PIPELINE.map((key) => QUEUE_NAMES[key]);

function indexOf(queueName: (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]): number {
  return (RESOLVED as string[]).indexOf(queueName as string);
}

describe('Pipeline Order Invariants', () => {

  it('PO01 — inference must be stage 0 (nothing runs before inference)', () => {
    expect(RESOLVED[0]).toBe(QUEUE_NAMES.AGENT_INFERENCE);
  });

  it('PO02 — scoping must follow inference (needs risk level from inference output)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_INFERENCE)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_SCOPING));
  });

  it('PO03 — control_mapper must follow scoping (needs scope to determine applicability)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_SCOPING)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_CONTROL_MAPPER));
  });

  it('PO04 — planner must follow control_mapper (needs applicability to build roadmap)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_CONTROL_MAPPER)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_PLANNER));
  });

  it('PO05 — gap_analysis must follow planner (needs roadmap to identify gaps)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_PLANNER)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_GAP_ANALYSIS));
  });

  it('PO06 — evidence must follow policy (policies must exist before evidence is validated)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_POLICY)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_EVIDENCE));
  });

  it('PO07 — validator must follow evidence (validates evidence completeness)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_EVIDENCE)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_VALIDATOR));
  });

  it('PO08 — risk_scoring must follow validator (scores final validated control state)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_VALIDATOR)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_RISK_SCORING));
  });

  it('PO09 — audit must follow review (cannot compile audit package before review)', () => {
    expect(indexOf(QUEUE_NAMES.AGENT_REVIEW)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_AUDIT));
  });

  it('PO10 — dashboard is last (summarises final state of all prior stages)', () => {
    expect(RESOLVED[RESOLVED.length - 1]).toBe(QUEUE_NAMES.AGENT_DASHBOARD);
    expect(indexOf(QUEUE_NAMES.AGENT_AUDIT)).toBeLessThan(indexOf(QUEUE_NAMES.AGENT_DASHBOARD));
  });

  it('PO11 — pipeline has exactly 19 stages', () => {
    expect(FULL_PIPELINE).toHaveLength(19);
  });

  it('PO12 — no stage appears more than once in the pipeline', () => {
    // Note: AGENT_DRIFT and AGENT_DRIFT_DETECTOR resolve to same queue — only one should appear
    const seen = new Set<string>();
    for (const queueName of RESOLVED) {
      expect(seen.has(queueName)).toBe(false);
      seen.add(queueName);
    }
  });

  it('PO13 — drift_detector appears between evidence and validator', () => {
    const driftIdx = indexOf(QUEUE_NAMES.AGENT_DRIFT_DETECTOR);
    const evidenceIdx = indexOf(QUEUE_NAMES.AGENT_EVIDENCE);
    const validatorIdx = indexOf(QUEUE_NAMES.AGENT_VALIDATOR);
    expect(driftIdx).toBeGreaterThan(evidenceIdx);
    expect(driftIdx).toBeLessThan(validatorIdx);
  });

  it('PO14 — onboarding is NOT in the main pipeline (it is a utility)', () => {
    expect(RESOLVED).not.toContain(QUEUE_NAMES.AGENT_ONBOARDING);
  });
});
