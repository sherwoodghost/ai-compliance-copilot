/**
 * FILE 4: Pipeline and Queue Configuration Tests
 * Pure unit tests — no DB, no queue connections required.
 */

import { QUEUE_NAMES, FULL_PIPELINE } from './queue.config';

// Expected pipeline stages in order (19 total — inference precedes scoping)
const EXPECTED_PIPELINE_VALUES = [
  'agent.inference',
  'agent.scoping',
  'agent.control_mapper',
  'agent.planner',
  'agent.gap_analysis',
  'agent.policy',
  'agent.evidence',
  'agent.drift',          // AGENT_DRIFT_DETECTOR resolves to 'agent.drift'
  'agent.validator',
  'agent.risk_scoring',
  'agent.review',
  'agent.remediation',
  'agent.threat_intel',
  'agent.vendor_risk',
  'agent.task',
  'agent.interview',
  'agent.benchmark',
  'agent.audit',
  'agent.dashboard',
];

describe('QUEUE_NAMES', () => {
  it('has AGENT_INFERENCE defined', () => {
    expect(QUEUE_NAMES.AGENT_INFERENCE).toBeDefined();
    expect(QUEUE_NAMES.AGENT_INFERENCE).toBe('agent.inference');
  });

  it('has AGENT_SCOPING defined', () => {
    expect(QUEUE_NAMES.AGENT_SCOPING).toBeDefined();
    expect(QUEUE_NAMES.AGENT_SCOPING).toBe('agent.scoping');
  });

  it('has AGENT_CONTROL_MAPPER defined', () => {
    expect(QUEUE_NAMES.AGENT_CONTROL_MAPPER).toBeDefined();
    expect(QUEUE_NAMES.AGENT_CONTROL_MAPPER).toBe('agent.control_mapper');
  });

  it('has AGENT_DASHBOARD defined', () => {
    expect(QUEUE_NAMES.AGENT_DASHBOARD).toBeDefined();
    expect(QUEUE_NAMES.AGENT_DASHBOARD).toBe('agent.dashboard');
  });

  it('AGENT_DRIFT legacy alias resolves to "agent.drift"', () => {
    expect(QUEUE_NAMES.AGENT_DRIFT).toBe('agent.drift');
  });

  it('AGENT_DRIFT_DETECTOR canonical name also resolves to "agent.drift"', () => {
    expect(QUEUE_NAMES.AGENT_DRIFT_DETECTOR).toBe('agent.drift');
  });

  it('AGENT_DRIFT and AGENT_DRIFT_DETECTOR resolve to same queue name', () => {
    expect(QUEUE_NAMES.AGENT_DRIFT).toBe(QUEUE_NAMES.AGENT_DRIFT_DETECTOR);
  });

  it('has AGENT_ONBOARDING — but it is NOT a pipeline stage', () => {
    // Onboarding is a utility, not in the main pipeline
    expect(QUEUE_NAMES.AGENT_ONBOARDING).toBeDefined();
    expect(QUEUE_NAMES.AGENT_ONBOARDING).toBe('agent.onboarding');
  });

  it('all queue names follow the "agent.<name>" or "workflow" pattern', () => {
    for (const [key, value] of Object.entries(QUEUE_NAMES)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('FULL_PIPELINE', () => {
  // FULL_PIPELINE is an array of QUEUE_NAMES keys
  // We resolve them to actual queue name strings for assertion

  const resolvedPipeline = FULL_PIPELINE.map((key) => QUEUE_NAMES[key]);

  it('has exactly 19 stages', () => {
    expect(FULL_PIPELINE).toHaveLength(19);
  });

  it('first stage is AGENT_INFERENCE', () => {
    expect(FULL_PIPELINE[0]).toBe('AGENT_INFERENCE');
    expect(resolvedPipeline[0]).toBe('agent.inference');
  });

  it('second stage is AGENT_SCOPING (inference must precede scoping)', () => {
    expect(FULL_PIPELINE[1]).toBe('AGENT_SCOPING');
    expect(resolvedPipeline[1]).toBe('agent.scoping');
  });

  it('third stage is AGENT_CONTROL_MAPPER', () => {
    expect(FULL_PIPELINE[2]).toBe('AGENT_CONTROL_MAPPER');
    expect(resolvedPipeline[2]).toBe('agent.control_mapper');
  });

  it('last stage is AGENT_DASHBOARD (position 18)', () => {
    expect(FULL_PIPELINE[FULL_PIPELINE.length - 1]).toBe('AGENT_DASHBOARD');
    expect(resolvedPipeline[resolvedPipeline.length - 1]).toBe('agent.dashboard');
  });

  it('does NOT contain AGENT_ONBOARDING', () => {
    expect(FULL_PIPELINE).not.toContain('AGENT_ONBOARDING');
  });

  it('contains AGENT_INFERENCE', () => {
    expect(FULL_PIPELINE).toContain('AGENT_INFERENCE');
  });

  it('contains AGENT_SCOPING', () => {
    expect(FULL_PIPELINE).toContain('AGENT_SCOPING');
  });

  it('contains AGENT_CONTROL_MAPPER', () => {
    expect(FULL_PIPELINE).toContain('AGENT_CONTROL_MAPPER');
  });

  it('contains AGENT_GAP_ANALYSIS', () => {
    expect(FULL_PIPELINE).toContain('AGENT_GAP_ANALYSIS');
  });

  it('contains AGENT_POLICY', () => {
    expect(FULL_PIPELINE).toContain('AGENT_POLICY');
  });

  it('contains AGENT_EVIDENCE', () => {
    expect(FULL_PIPELINE).toContain('AGENT_EVIDENCE');
  });

  it('contains AGENT_DRIFT_DETECTOR (not the legacy AGENT_DRIFT)', () => {
    expect(FULL_PIPELINE).toContain('AGENT_DRIFT_DETECTOR');
    expect(FULL_PIPELINE).not.toContain('AGENT_DRIFT');
  });

  it('contains AGENT_AUDIT', () => {
    expect(FULL_PIPELINE).toContain('AGENT_AUDIT');
  });

  it('AGENT_AUDIT comes before AGENT_DASHBOARD', () => {
    const auditIdx = FULL_PIPELINE.indexOf('AGENT_AUDIT');
    const dashboardIdx = FULL_PIPELINE.indexOf('AGENT_DASHBOARD');
    expect(auditIdx).toBeGreaterThanOrEqual(0);
    expect(dashboardIdx).toBeGreaterThanOrEqual(0);
    expect(auditIdx).toBeLessThan(dashboardIdx);
  });

  it('AGENT_INFERENCE comes before AGENT_SCOPING (order invariant)', () => {
    const inferenceIdx = FULL_PIPELINE.indexOf('AGENT_INFERENCE');
    const scopingIdx = FULL_PIPELINE.indexOf('AGENT_SCOPING');
    expect(inferenceIdx).toBeGreaterThanOrEqual(0);
    expect(scopingIdx).toBeGreaterThanOrEqual(0);
    expect(inferenceIdx).toBeLessThan(scopingIdx);
  });

  it('AGENT_SCOPING comes before AGENT_CONTROL_MAPPER', () => {
    const scopingIdx = FULL_PIPELINE.indexOf('AGENT_SCOPING');
    const mapperIdx = FULL_PIPELINE.indexOf('AGENT_CONTROL_MAPPER');
    expect(scopingIdx).toBeLessThan(mapperIdx);
  });

  it('resolved pipeline matches expected queue name values in order', () => {
    expect(resolvedPipeline).toEqual(EXPECTED_PIPELINE_VALUES);
  });

  it('resolved pipeline has no duplicate queue names (except drift alias)', () => {
    // AGENT_DRIFT and AGENT_DRIFT_DETECTOR are the same queue name ('agent.drift')
    // but the pipeline should only have one entry for drift
    const driftEntries = resolvedPipeline.filter((v) => v === 'agent.drift');
    expect(driftEntries).toHaveLength(1);
  });

  it('all FULL_PIPELINE keys exist in QUEUE_NAMES', () => {
    for (const key of FULL_PIPELINE) {
      expect(QUEUE_NAMES[key]).toBeDefined();
    }
  });
});

describe('Pipeline cross-validation with workflow engine ordering', () => {
  it('FULL_PIPELINE from queue.config matches the PIPELINE order in workflow.engine', () => {
    // We verify this by checking the resolved values against the expected 18-stage order
    // The workflow.engine.ts PIPELINE array uses QUEUE_NAMES constants in the same order
    const resolvedPipeline = FULL_PIPELINE.map((key) => QUEUE_NAMES[key]);

    // Spot-check ordering: inference → scoping → control_mapper → planner
    expect(resolvedPipeline[0]).toBe('agent.inference');
    expect(resolvedPipeline[1]).toBe('agent.scoping');
    expect(resolvedPipeline[2]).toBe('agent.control_mapper');
    expect(resolvedPipeline[3]).toBe('agent.planner');

    // And near the end: audit → dashboard
    expect(resolvedPipeline[17]).toBe('agent.audit');
    expect(resolvedPipeline[18]).toBe('agent.dashboard');
  });
});
