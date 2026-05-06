# Agent Memory

The Agent Memory layer is a **typed, namespace-owned, cross-workflow-isolated key-value store** that allows agents to share structured state without calling each other directly.

---

## Architecture Principle

> **Agents must never call other agents directly.**  
> An agent's output is stored in shared memory by the orchestrator pipeline.  
> The next agent reads from memory — it does not receive a direct call or callback.

This keeps each agent a pure, testable unit. The orchestrator is the only component that controls data flow.

---

## Storage Model

Table: `agent_memory`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | string | Tenant isolation key |
| `workflow_run_id` | string | Scopes memory to a specific pipeline run |
| `agent_id` | string | Which agent wrote this entry |
| `namespace` | string | Logical grouping (e.g. `'inference'`, `'scoping'`) |
| `key` | string | Specific data key within namespace |
| `value_json` | JSON | The actual stored value |
| `schema_version` | string | For future migrations (`'v1'`) |
| `ttl_at` | DateTime? | Optional expiry — service skips expired entries |
| `step` | int | Which agent step produced this entry |

**Unique constraint**: `(workflow_run_id, namespace, key)` — upserts are idempotent.

---

## Namespace Ownership

Each namespace is owned by exactly one agent. **Only the owning agent may write to a namespace.**  
Any other agent attempting a write will receive a `ForbiddenException`.

```typescript
// src/agent-memory/agent-memory.types.ts
export const NAMESPACE_OWNERS: Record<string, string> = {
  inference:      'inference-agent',
  scoping:        'scoping-agent',
  controls:       'control-mapper-agent',
  planning:       'planner-agent',
  gap_analysis:   'gap-analysis-agent',
  policy:         'policy-agent',
  evidence:       'evidence-agent',
  drift:          'drift-detector-agent',
  validation:     'validator-agent',
  risk:           'risk-scoring-agent',
  review:         'review-agent',
  remediation:    'remediation-advisor-agent',
  threat_intel:   'threat-intel-agent',
  vendor_risk:    'vendor-risk-agent',
};
```

**Any agent may READ from any namespace** — reading is unrestricted (subject to tenant isolation).

---

## API Reference

### `write(ctx, namespace, key, value, options?)`

```typescript
await memoryService.write(
  { organizationId, workflowRunId, agentId },
  'inference',          // namespace
  'risk_level',         // key
  'HIGH',               // value (any JSON-serialisable type)
  { step: 0, ttlDays: 30 }  // options
);
```

- Throws `ForbiddenException` if `agentId` is not the namespace owner.
- Upserts on `(workflow_run_id, namespace, key)` — calling write twice is safe.

### `read<T>(ctx, namespace, key): Promise<T | null>`

```typescript
const riskLevel = await memoryService.read<RiskLevel>(
  { organizationId, workflowRunId, agentId: 'scoping-agent' },
  'inference',
  'risk_level',
);
```

- Returns `null` if key not found or TTL expired.
- Cross-tenant guard: throws if `organizationId` does not match the stored record.

### `readNamespace(ctx, namespace): Promise<Record<string, unknown>>`

Returns all keys in a namespace as a plain object.

### `snapshot(workflowRunId, orgId): Promise<Record<string, Record<string, unknown>>>`

Returns the full memory state for a workflow run, grouped by namespace.  
Used by the `review-agent` to compile a complete picture before the audit.

### `diff(workflowRunId, orgId, fromStep, toStep)`

Returns `{ added, changed, unchanged }` — useful for understanding what changed between agent steps.

---

## Typical Read Pattern (Downstream Agent)

```typescript
// scoping-agent reads inference output
const inferenceOutput = await this.memory.read<InferenceOutput>(
  { organizationId: orgId, workflowRunId: workflowId, agentId: this.agentName },
  'inference',
  'inference_output',
);

if (!inferenceOutput) {
  throw new Error('InferenceAgent must run before ScopingAgent');
}
```

---

## Tenant Isolation

Every read checks that the stored `organizationId` matches the requester's `organizationId`.  
A bug that passes the wrong `orgId` in the context will throw immediately rather than silently leak cross-tenant data.

---

## TTL

Pass `{ ttlDays: N }` to `write()` to set an expiry. The `read()` method checks `ttl_at` and returns `null` for expired entries. Useful for caches of expensive computations (e.g. RAG embeddings).

---

## Key Files

| File | Purpose |
|------|---------|
| `src/agent-memory/agent-memory.types.ts` | `NAMESPACE_OWNERS` map |
| `src/agent-memory/agent-memory.service.ts` | All read/write/snapshot/diff methods |
| `src/agent-memory/agent-memory.module.ts` | NestJS module |
| `src/agent-memory/agent-memory.spec.ts` | 12 unit tests (AM01–AM12) |
