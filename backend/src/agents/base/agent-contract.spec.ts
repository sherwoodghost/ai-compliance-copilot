/**
 * FILE 1: Agent Contract Schema Tests
 * Tests the Zod schemas and constants from agent-contract.interfaces.ts
 */

import {
  AgentJobDataSchema,
  AgentOutputSchema,
  FORBIDDEN_CERTIFICATION_PHRASES,
  AUDIT_DISCLAIMER,
} from './agent-contract.interfaces';

describe('AgentJobDataSchema', () => {
  const validJobData = {
    workflowId: 'wf-123',
    journeyId: 'jrn-456',
    orgId: 'org-789',
  };

  it('rejects job data missing workflowId', () => {
    const result = AgentJobDataSchema.safeParse({
      journeyId: 'jrn-456',
      orgId: 'org-789',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('workflowId');
    }
  });

  it('rejects job data missing orgId', () => {
    const result = AgentJobDataSchema.safeParse({
      workflowId: 'wf-123',
      journeyId: 'jrn-456',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('orgId');
    }
  });

  it('rejects job data missing journeyId', () => {
    const result = AgentJobDataSchema.safeParse({
      workflowId: 'wf-123',
      orgId: 'org-789',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('journeyId');
    }
  });

  it('rejects empty string workflowId', () => {
    const result = AgentJobDataSchema.safeParse({
      ...validJobData,
      workflowId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty string orgId', () => {
    const result = AgentJobDataSchema.safeParse({
      ...validJobData,
      orgId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty string journeyId', () => {
    const result = AgentJobDataSchema.safeParse({
      ...validJobData,
      journeyId: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid job data with all required fields', () => {
    const result = AgentJobDataSchema.safeParse(validJobData);
    expect(result.success).toBe(true);
  });

  it('sets isReplay default to false when not provided', () => {
    const result = AgentJobDataSchema.safeParse(validJobData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isReplay).toBe(false);
    }
  });

  it('sets inputPayload default to {} when not provided', () => {
    const result = AgentJobDataSchema.safeParse(validJobData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inputPayload).toEqual({});
    }
  });

  it('accepts valid job data with optional fields', () => {
    const result = AgentJobDataSchema.safeParse({
      ...validJobData,
      runId: 'run-abc',
      isReplay: true,
      inputPayload: { key: 'value' },
      businessProfile: { companyName: 'Acme' },
      stepIndex: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isReplay).toBe(true);
      expect(result.data.inputPayload).toEqual({ key: 'value' });
      expect(result.data.stepIndex).toBe(3);
    }
  });

  it('preserves businessProfile field through validation', () => {
    const result = AgentJobDataSchema.safeParse({
      ...validJobData,
      businessProfile: { companyName: 'Acme Corp', industry: 'SaaS' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessProfile).toEqual({ companyName: 'Acme Corp', industry: 'SaaS' });
    }
  });
});

describe('AgentOutputSchema', () => {
  it('rejects output without success field', () => {
    const result = AgentOutputSchema.safeParse({
      data: { foo: 'bar' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects output without data field', () => {
    const result = AgentOutputSchema.safeParse({
      success: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects output where data is not a record', () => {
    const result = AgentOutputSchema.safeParse({
      success: true,
      data: 'not-an-object',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid output with required fields', () => {
    const result = AgentOutputSchema.safeParse({
      success: true,
      data: { score: 85 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid output with success=false and errors', () => {
    const result = AgentOutputSchema.safeParse({
      success: false,
      data: {},
      errors: ['Something went wrong'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid output with all optional fields', () => {
    const result = AgentOutputSchema.safeParse({
      success: true,
      data: { result: 'ok' },
      nextAgentInput: { passMe: true },
      errors: [],
      warnings: ['low confidence'],
      runId: 'run-999',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runId).toBe('run-999');
      expect(result.data.warnings).toEqual(['low confidence']);
    }
  });
});

describe('FORBIDDEN_CERTIFICATION_PHRASES', () => {
  it('includes "certified"', () => {
    expect(FORBIDDEN_CERTIFICATION_PHRASES).toContain('certified');
  });

  it('includes "guaranteed compliance"', () => {
    expect(FORBIDDEN_CERTIFICATION_PHRASES).toContain('guaranteed compliance');
  });

  it('includes "passed SOC 2"', () => {
    expect(FORBIDDEN_CERTIFICATION_PHRASES).toContain('passed SOC 2');
  });

  it('includes "ISO certified"', () => {
    expect(FORBIDDEN_CERTIFICATION_PHRASES).toContain('ISO certified');
  });

  it('includes "SOC 2 certified"', () => {
    expect(FORBIDDEN_CERTIFICATION_PHRASES).toContain('SOC 2 certified');
  });

  it('includes "guaranteed audit success"', () => {
    expect(FORBIDDEN_CERTIFICATION_PHRASES).toContain('guaranteed audit success');
  });

  it('includes "audit passed"', () => {
    expect(FORBIDDEN_CERTIFICATION_PHRASES).toContain('audit passed');
  });

  it('is a non-empty array', () => {
    expect(Array.isArray(FORBIDDEN_CERTIFICATION_PHRASES)).toBe(true);
    expect(FORBIDDEN_CERTIFICATION_PHRASES.length).toBeGreaterThan(0);
  });
});

describe('AUDIT_DISCLAIMER', () => {
  it('mentions "readiness assessment"', () => {
    expect(AUDIT_DISCLAIMER.toLowerCase()).toContain('readiness assessment');
  });

  it('mentions "not constitute"', () => {
    expect(AUDIT_DISCLAIMER.toLowerCase()).toContain('not constitute');
  });

  it('mentions third-party auditor requirement', () => {
    expect(AUDIT_DISCLAIMER.toLowerCase()).toContain('auditor');
  });

  it('is a non-empty string', () => {
    expect(typeof AUDIT_DISCLAIMER).toBe('string');
    expect(AUDIT_DISCLAIMER.length).toBeGreaterThan(0);
  });
});
