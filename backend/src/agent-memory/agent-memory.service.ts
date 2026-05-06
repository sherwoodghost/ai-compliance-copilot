import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  MemoryWriteOptions,
  MemoryEntry,
  MemorySnapshot,
  MemoryDiff,
  NAMESPACE_OWNERS,
} from './agent-memory.types';

/**
 * AgentMemoryService
 *
 * Shared agent memory layer. Provides typed key-value storage scoped to
 * (workflow_run_id, namespace, key) with:
 * - Tenant isolation (organizationId from context)
 * - Namespace ownership enforcement (only owner agent may write)
 * - Idempotent upserts (same key = update, no duplicates)
 * - Snapshot + diff APIs for replay bundles
 */
@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write a value to shared memory.
   * Enforces namespace ownership — throws ForbiddenException if agentId
   * is not the declared owner of the namespace.
   */
  async write(
    ctx: { organizationId: string; workflowRunId: string; agentId: string },
    namespace: string,
    key: string,
    value: unknown,
    options: MemoryWriteOptions = {},
  ): Promise<void> {
    this.enforceNamespaceOwnership(namespace, ctx.agentId);

    const ttlAt = options.ttlSeconds
      ? new Date(Date.now() + options.ttlSeconds * 1000)
      : null;

    await this.prisma.agentMemory.upsert({
      where: {
        workflowRunId_namespace_key: {
          workflowRunId: ctx.workflowRunId,
          namespace,
          key,
        },
      },
      create: {
        organizationId: ctx.organizationId,
        workflowRunId: ctx.workflowRunId,
        agentId: ctx.agentId,
        step: options.step ?? 0,
        namespace,
        key,
        valueJson: value as any,
        schemaVersion: options.schemaVersion ?? 'v1',
        ttlAt,
      },
      update: {
        valueJson: value as any,
        step: options.step ?? 0,
        schemaVersion: options.schemaVersion ?? 'v1',
        ttlAt,
      },
    });

    this.logger.debug(`[memory:write] ${ctx.agentId} → ${namespace}:${key} (workflow: ${ctx.workflowRunId})`);
  }

  /**
   * Read a single value from memory.
   * Any agent can read from any namespace.
   * Enforces cross-tenant isolation via organizationId check.
   */
  async read<T = unknown>(
    ctx: { organizationId: string; workflowRunId: string },
    namespace: string,
    key: string,
  ): Promise<T | null> {
    const entry = await this.prisma.agentMemory.findUnique({
      where: {
        workflowRunId_namespace_key: {
          workflowRunId: ctx.workflowRunId,
          namespace,
          key,
        },
      },
    });

    if (!entry) return null;

    // Cross-tenant guard
    if (entry.organizationId !== ctx.organizationId) {
      throw new ForbiddenException(`Cross-tenant memory access blocked: org ${ctx.organizationId} cannot read memory for org ${entry.organizationId}`);
    }

    // Check TTL
    if (entry.ttlAt && entry.ttlAt < new Date()) {
      this.logger.debug(`[memory:read] TTL expired for ${namespace}:${key}`);
      return null;
    }

    return entry.valueJson as T;
  }

  /**
   * Read all keys in a namespace for this workflow run.
   */
  async readNamespace(
    ctx: { organizationId: string; workflowRunId: string },
    namespace: string,
  ): Promise<Record<string, unknown>> {
    const entries = await this.prisma.agentMemory.findMany({
      where: {
        workflowRunId: ctx.workflowRunId,
        organizationId: ctx.organizationId,
        namespace,
      },
    });

    const result: Record<string, unknown> = {};
    for (const entry of entries) {
      if (!entry.ttlAt || entry.ttlAt >= new Date()) {
        result[entry.key] = entry.valueJson;
      }
    }
    return result;
  }

  /**
   * Snapshot: full state of memory at end of run.
   */
  async snapshot(workflowRunId: string, organizationId: string): Promise<MemorySnapshot> {
    const entries = await this.prisma.agentMemory.findMany({
      where: { workflowRunId, organizationId },
      orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
    });

    return {
      workflowRunId,
      organizationId,
      capturedAt: new Date(),
      entries: entries.map(this.toMemoryEntry),
    };
  }

  /**
   * Diff: what changed in memory between two step indices.
   */
  async diff(
    workflowRunId: string,
    organizationId: string,
    fromStep: number,
    toStep: number,
  ): Promise<MemoryDiff> {
    const allEntries = await this.prisma.agentMemory.findMany({
      where: { workflowRunId, organizationId },
      orderBy: { step: 'asc' },
    });

    const atFrom = new Map<string, typeof allEntries[0]>();
    const atTo = new Map<string, typeof allEntries[0]>();

    for (const e of allEntries) {
      const k = `${e.namespace}:${e.key}`;
      if (e.step <= fromStep) atFrom.set(k, e);
      if (e.step <= toStep) atTo.set(k, e);
    }

    const added: MemoryEntry[] = [];
    const changed: Array<{ previous: MemoryEntry; current: MemoryEntry }> = [];
    const unchanged: MemoryEntry[] = [];

    for (const [k, curr] of atTo) {
      const prev = atFrom.get(k);
      if (!prev) {
        added.push(this.toMemoryEntry(curr));
      } else if (JSON.stringify(prev.valueJson) !== JSON.stringify(curr.valueJson)) {
        changed.push({ previous: this.toMemoryEntry(prev), current: this.toMemoryEntry(curr) });
      } else {
        unchanged.push(this.toMemoryEntry(curr));
      }
    }

    return { workflowRunId, fromStep, toStep, added, changed, unchanged };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private enforceNamespaceOwnership(namespace: string, agentId: string): void {
    const owner = NAMESPACE_OWNERS[namespace];
    if (!owner) {
      // Unknown namespace — allow (extensible)
      this.logger.warn(`[memory] Unknown namespace "${namespace}" — no ownership constraint`);
      return;
    }
    if (owner !== agentId) {
      throw new ForbiddenException(
        `Namespace ownership violation: agent "${agentId}" cannot write to namespace "${namespace}" (owned by "${owner}")`,
      );
    }
  }

  private toMemoryEntry(e: {
    namespace: string;
    key: string;
    valueJson: unknown;
    schemaVersion: string;
    step: number;
    createdAt: Date;
    updatedAt: Date;
  }): MemoryEntry {
    return {
      namespace: e.namespace,
      key: e.key,
      value: e.valueJson,
      schemaVersion: e.schemaVersion,
      step: e.step,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}
