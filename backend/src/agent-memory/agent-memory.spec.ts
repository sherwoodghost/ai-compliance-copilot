/**
 * Agent Memory Tests
 *
 * Verifies:
 * - Write/read round-trip
 * - Namespace ownership enforcement
 * - Workflow isolation (run A cannot read run B)
 * - Tenant isolation (org A cannot read org B)
 * - Idempotency (same key = upsert)
 * - Snapshot completeness
 * - Diff correctness
 */

import { AgentMemoryService } from './agent-memory.service';
import { NAMESPACE_OWNERS } from './agent-memory.types';
import { ForbiddenException } from '@nestjs/common';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const makeMemoryStore = () => {
  const store = new Map<string, any>();

  return {
    agentMemory: {
      upsert: jest.fn(async (args: any) => {
        const k = `${args.where.workflowRunId_namespace_key.workflowRunId}:${args.where.workflowRunId_namespace_key.namespace}:${args.where.workflowRunId_namespace_key.key}`;
        const existing = store.get(k);
        if (existing) {
          const updated = { ...existing, ...args.update, updatedAt: new Date() };
          store.set(k, updated);
          return updated;
        }
        const created = {
          id: `mem-${Math.random().toString(36).slice(2)}`,
          ...args.create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.set(k, created);
        return created;
      }),

      findUnique: jest.fn(async (args: any) => {
        const { workflowRunId, namespace, key } = args.where.workflowRunId_namespace_key;
        const k = `${workflowRunId}:${namespace}:${key}`;
        return store.get(k) ?? null;
      }),

      findMany: jest.fn(async (args: any) => {
        const results: any[] = [];
        for (const [, v] of store) {
          if (v.workflowRunId !== args.where.workflowRunId) continue;
          if (v.organizationId !== args.where.organizationId) continue;
          if (args.where.namespace && v.namespace !== args.where.namespace) continue;
          results.push(v);
        }
        return results;
      }),
    },
  };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AgentMemoryService — write/read round-trip', () => {
  let service: AgentMemoryService;
  let mockPrisma: ReturnType<typeof makeMemoryStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = makeMemoryStore();
    service = new AgentMemoryService(mockPrisma as any);
  });

  const ctx = {
    organizationId: 'org-001',
    workflowRunId: 'run-001',
    agentId: NAMESPACE_OWNERS['inference'], // 'inference-agent'
  };

  it('AM01 — write() then read() returns stored value', async () => {
    await service.write(ctx, 'inference', 'risk_level', 'HIGH');
    const val = await service.read<string>(ctx, 'inference', 'risk_level');
    expect(val).toBe('HIGH');
  });

  it('AM02 — read() returns null for non-existent key', async () => {
    const val = await service.read(ctx, 'inference', 'nonexistent');
    expect(val).toBeNull();
  });

  it('AM03 — idempotent upsert: second write overrides first, no duplicates', async () => {
    await service.write(ctx, 'inference', 'risk_level', 'LOW');
    await service.write(ctx, 'inference', 'risk_level', 'HIGH');

    const val = await service.read<string>(ctx, 'inference', 'risk_level');
    expect(val).toBe('HIGH');
    // upsert called twice
    expect(mockPrisma.agentMemory.upsert).toHaveBeenCalledTimes(2);
  });

  it('AM04 — readNamespace() returns all keys in namespace', async () => {
    await service.write(ctx, 'inference', 'risk_level', 'MEDIUM');
    await service.write(ctx, 'inference', 'frameworks', ['SOC2', 'ISO27001']);

    const ns = await service.readNamespace(ctx, 'inference');
    expect(ns['risk_level']).toBe('MEDIUM');
    expect(ns['frameworks']).toEqual(['SOC2', 'ISO27001']);
  });

  it('AM05 — write stores complex JSON value correctly', async () => {
    const complexValue = {
      risk_level: 'HIGH',
      risk_score: 9,
      frameworks: ['SOC2', 'GDPR'],
      system_flags: { requires_mfa: true, requires_dpa: true },
    };
    await service.write(ctx, 'inference', 'inference_output', complexValue);
    const val = await service.read(ctx, 'inference', 'inference_output');
    expect(val).toEqual(complexValue);
  });
});

describe('AgentMemoryService — namespace ownership enforcement', () => {
  let service: AgentMemoryService;

  beforeEach(() => {
    service = new AgentMemoryService(makeMemoryStore() as any);
  });

  it('AM06 — write() throws ForbiddenException when agentId is not namespace owner', async () => {
    const unauthorizedCtx = {
      organizationId: 'org-001',
      workflowRunId: 'run-001',
      agentId: 'policy-agent', // policy-agent does NOT own 'inference' namespace
    };
    await expect(
      service.write(unauthorizedCtx, 'inference', 'risk_level', 'HIGH'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('AM07 — write() succeeds when agentId IS the namespace owner', async () => {
    const authorizedCtx = {
      organizationId: 'org-001',
      workflowRunId: 'run-001',
      agentId: NAMESPACE_OWNERS['scoping'], // 'scoping-agent'
    };
    await expect(
      service.write(authorizedCtx, 'scoping', 'scope_output', { systems: [] }),
    ).resolves.not.toThrow();
  });

  it('AM08 — read() succeeds for any agent (no ownership restriction on reads)', async () => {
    const ownerCtx = {
      organizationId: 'org-001',
      workflowRunId: 'run-001',
      agentId: NAMESPACE_OWNERS['inference'],
    };
    await service.write(ownerCtx, 'inference', 'risk_level', 'LOW');

    // A different agent reads — should succeed
    const readerCtx = { organizationId: 'org-001', workflowRunId: 'run-001' };
    const val = await service.read(readerCtx, 'inference', 'risk_level');
    expect(val).toBe('LOW');
  });
});

describe('AgentMemoryService — tenant isolation', () => {
  let service: AgentMemoryService;
  let mockPrisma: ReturnType<typeof makeMemoryStore>;

  beforeEach(() => {
    mockPrisma = makeMemoryStore();
    service = new AgentMemoryService(mockPrisma as any);
  });

  it('AM09 — org A cannot read memory belonging to org B (cross-tenant guard)', async () => {
    // Write memory for org-B
    const orgBEntry = {
      id: 'mem-org-b',
      organizationId: 'org-B',
      workflowRunId: 'run-B',
      namespace: 'inference',
      key: 'risk_level',
      valueJson: 'HIGH',
      schemaVersion: 'v1',
      step: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ttlAt: null,
    };

    // Simulate findUnique returning org-B data for a run-B key
    mockPrisma.agentMemory.findUnique.mockResolvedValueOnce(orgBEntry);

    const orgACtx = { organizationId: 'org-A', workflowRunId: 'run-B' };
    await expect(
      service.read(orgACtx, 'inference', 'risk_level'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('AM10 — workflow run A cannot see run B memory (workflow isolation)', async () => {
    const ctxA = {
      organizationId: 'org-001',
      workflowRunId: 'run-A',
      agentId: NAMESPACE_OWNERS['inference'],
    };
    await service.write(ctxA, 'inference', 'risk_level', 'LOW');

    // Reading from run-B returns null (different workflowRunId)
    const ctxB = { organizationId: 'org-001', workflowRunId: 'run-B' };
    const val = await service.read(ctxB, 'inference', 'risk_level');
    expect(val).toBeNull();
  });
});

describe('AgentMemoryService — snapshot and diff', () => {
  let service: AgentMemoryService;
  let mockPrisma: ReturnType<typeof makeMemoryStore>;

  beforeEach(() => {
    mockPrisma = makeMemoryStore();
    service = new AgentMemoryService(mockPrisma as any);
  });

  it('AM11 — snapshot includes all entries for a workflow run', async () => {
    mockPrisma.agentMemory.findMany.mockResolvedValueOnce([
      { namespace: 'inference', key: 'risk', valueJson: 'HIGH', schemaVersion: 'v1', step: 1, createdAt: new Date(), updatedAt: new Date() },
      { namespace: 'scoping', key: 'scope', valueJson: { systems: [] }, schemaVersion: 'v1', step: 2, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const snap = await service.snapshot('run-001', 'org-001');
    expect(snap.workflowRunId).toBe('run-001');
    expect(snap.entries.length).toBe(2);
    expect(snap.capturedAt).toBeInstanceOf(Date);
  });

  it('AM12 — diff correctly identifies added entries between steps', async () => {
    const step1Entries = [
      { namespace: 'inference', key: 'risk', valueJson: 'LOW', schemaVersion: 'v1', step: 1, createdAt: new Date(), updatedAt: new Date() },
    ];
    const step2Entries = [
      { namespace: 'inference', key: 'risk', valueJson: 'LOW', schemaVersion: 'v1', step: 1, createdAt: new Date(), updatedAt: new Date() },
      { namespace: 'scoping', key: 'scope', valueJson: { systems: ['api'] }, schemaVersion: 'v1', step: 2, createdAt: new Date(), updatedAt: new Date() },
    ];

    mockPrisma.agentMemory.findMany.mockResolvedValueOnce([...step1Entries, ...step2Entries]);

    const diff = await service.diff('run-001', 'org-001', 1, 2);
    expect(diff.added.length).toBe(1);
    expect(diff.added[0].namespace).toBe('scoping');
    expect(diff.unchanged.length).toBe(1);
    expect(diff.changed.length).toBe(0);
  });
});
