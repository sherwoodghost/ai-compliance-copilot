/**
 * FILE 6: BaseAgent Runtime Validation Tests
 * Creates a minimal concrete test agent, verifies Zod validation in execute().
 * No real DB or Redis connection needed.
 */

import { BaseAgent } from './base.agent';
import { AgentJobData, AgentOutput } from './agent.interfaces';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

// ─── Minimal mock helpers ─────────────────────────────────────────────────────

function makeMockPrisma() {
  const runRecord = { id: 'run-001', startedAt: new Date() };
  return {
    agentRun: {
      create: jest.fn().mockResolvedValue(runRecord),
      update: jest.fn().mockResolvedValue(runRecord),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    agentStep: {
      create: jest.fn().mockResolvedValue({ id: 'step-001', startedAt: new Date() }),
      update: jest.fn().mockResolvedValue({}),
    },
    agentEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeMockLlm() {
  return {
    completeWithRetry: jest.fn().mockResolvedValue({
      content: 'test',
      tokensIn: 10,
      tokensOut: 20,
      costUsd: 0.001,
    }),
  };
}

// ─── Concrete test agent ──────────────────────────────────────────────────────

class TestAgent extends BaseAgent {
  protected readonly agentName = 'test_agent';

  public processCalled = false;
  public lastJobData: AgentJobData | null = null;

  protected async process(jobData: AgentJobData, _runId: string): Promise<AgentOutput> {
    this.processCalled = true;
    this.lastJobData = jobData;
    return {
      success: true,
      data: { result: 'ok', orgId: jobData.orgId },
    };
  }
}

// ─── Valid job data factory ───────────────────────────────────────────────────

function validJobData(overrides: Partial<AgentJobData> = {}): AgentJobData {
  return {
    workflowId: 'wf-abc-123',
    journeyId: 'jrn-xyz-456',
    orgId: 'org-tenant-789',
    businessProfile: {
      companyName: 'Test Corp',
      companyType: 'B2B SaaS',
      industry: 'Technology',
      subIndustry: null,
      employeeCount: '50-100',
      engineeringCount: '10-20',
      hqCountry: 'US',
      operatesIn: ['US'],
      infrastructure: { cloudProviders: ['aws'] },
      tools: {},
      dataHandling: { dataTypes: [] },
      currentPosture: {},
      complianceGoals: { frameworks: ['soc2'] },
      riskProfile: {
        riskLevel: 'medium',
        riskFactors: [],
        recommendedPriority: [],
        estimatedReadiness: 40,
      },
    } as any,
    inputPayload: {},
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BaseAgent.execute() — runtime Zod validation', () => {
  let agent: TestAgent;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockLlm: ReturnType<typeof makeMockLlm>;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
    mockLlm = makeMockLlm();
    agent = new TestAgent(
      mockPrisma as unknown as PrismaService,
      mockLlm as unknown as LlmService,
    );
  });

  it('throws when workflowId is empty string', async () => {
    const job = validJobData({ workflowId: '' });
    await expect(agent.execute(job)).rejects.toThrow(/validation failed/i);
  });

  it('throws when orgId is empty string', async () => {
    const job = validJobData({ orgId: '' });
    await expect(agent.execute(job)).rejects.toThrow(/validation failed/i);
  });

  it('throws when journeyId is empty string', async () => {
    const job = validJobData({ journeyId: '' });
    await expect(agent.execute(job)).rejects.toThrow(/validation failed/i);
  });

  it('throws when workflowId is missing (undefined coerces to missing)', async () => {
    const job = { ...validJobData() } as any;
    delete job.workflowId;
    await expect(agent.execute(job)).rejects.toThrow(/validation failed/i);
  });

  it('throws when orgId is missing', async () => {
    const job = { ...validJobData() } as any;
    delete job.orgId;
    await expect(agent.execute(job)).rejects.toThrow(/validation failed/i);
  });

  it('accepts valid job data and calls process()', async () => {
    const job = validJobData();
    const result = await agent.execute(job);

    expect(agent.processCalled).toBe(true);
    expect(result.success).toBe(true);
  });

  it('does not call process() when validation fails', async () => {
    const job = validJobData({ workflowId: '' });
    try {
      await agent.execute(job);
    } catch {
      // expected
    }
    expect(agent.processCalled).toBe(false);
  });

  it('businessProfile field survives validation and is accessible in process()', async () => {
    const job = validJobData({
      businessProfile: {
        companyName: 'Acme Corp',
        industry: 'Finance',
      } as any,
    });
    await agent.execute(job);

    expect(agent.processCalled).toBe(true);
    expect((agent.lastJobData!.businessProfile as any).companyName).toBe('Acme Corp');
    expect((agent.lastJobData!.businessProfile as any).industry).toBe('Finance');
  });

  it('returns AgentOutput with success and data fields', async () => {
    const job = validJobData();
    const result = await agent.execute(job);

    expect(typeof result.success).toBe('boolean');
    expect(typeof result.data).toBe('object');
    expect(result.data).not.toBeNull();
  });

  it('returns runId in output after successful execution', async () => {
    const job = validJobData();
    const result = await agent.execute(job);
    // runId is attached by execute() — either from job or from DB
    expect(result.runId).toBeDefined();
  });

  it('creates an agentRun record in the DB when runId is not pre-provided', async () => {
    const job = validJobData(); // no runId
    await agent.execute(job);
    expect(mockPrisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowId: job.workflowId,
          orgId: job.orgId,
          agentName: 'test_agent',
        }),
      }),
    );
  });

  it('uses pre-provided runId without creating a new agentRun', async () => {
    const job = validJobData({ runId: 'pre-existing-run-id' });
    await agent.execute(job);
    expect(mockPrisma.agentRun.create).not.toHaveBeenCalled();
    expect(mockPrisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pre-existing-run-id' },
      }),
    );
  });

  it('isReplay flag is accessible in process() when set to true', async () => {
    const job = validJobData({ isReplay: true });
    await agent.execute(job);
    expect(agent.lastJobData!.isReplay).toBe(true);
  });
});
