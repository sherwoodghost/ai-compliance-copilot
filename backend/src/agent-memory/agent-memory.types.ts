/**
 * Agent Memory Types
 *
 * Defines the contracts for the shared memory layer.
 * Namespaces are owned by a single agent; any agent can read.
 */

export interface MemoryWriteOptions {
  schemaVersion?: string;
  ttlSeconds?: number;
  step?: number;
}

export interface MemoryEntry {
  namespace: string;
  key: string;
  value: unknown;
  schemaVersion: string;
  step: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySnapshot {
  workflowRunId: string;
  organizationId: string;
  entries: MemoryEntry[];
  capturedAt: Date;
}

export interface MemoryDiff {
  workflowRunId: string;
  fromStep: number;
  toStep: number;
  added: MemoryEntry[];
  changed: Array<{ previous: MemoryEntry; current: MemoryEntry }>;
  unchanged: MemoryEntry[];
}

/**
 * Namespace ownership registry.
 * Agents must declare their namespace in their manifest.
 * Write enforcement happens at service level.
 */
export const NAMESPACE_OWNERS: Record<string, string> = {
  inference:   'inference-agent',
  scoping:     'scoping-agent',
  controls:    'control-mapper-agent',
  planning:    'planner-agent',
  gaps:        'gap-analysis-agent',
  policy:      'policy-agent',
  evidence:    'evidence-agent',
  validation:  'validator-agent',
  risk:        'risk-scoring-agent',
  review:      'review-agent',
  tasks:       'task-agent',
  readiness:   'readiness-agent',
  dashboard:   'dashboard-agent',
  audit:       'audit-agent',
  onboarding:  'onboarding-agent',
};
