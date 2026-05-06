# Agent Runtime Contract

Every agent in the AI Compliance Copilot pipeline must satisfy the `ComplianceAgentContract` interface defined in `backend/src/agents/base/agent-contract.interfaces.ts`. This document explains what that means, why each rule exists, and how to build a new agent correctly.

---

## The Contract Interface

```typescript
interface ComplianceAgentContract<TInput, TOutput> {
  readonly name: string;               // unique agent name
  readonly version: string;            // semantic version
  readonly queueName: string;          // BullMQ queue name
  readonly description: string;        // one-sentence purpose
  readonly usesLlm: boolean;           // must be false if no LLM calls
  readonly taskType: AgentTaskType;    // drives context packing
  readonly promptTemplateId?: string;  // required when usesLlm = true
  readonly inputSchema: ZodSchema<TInput>;
  readonly outputSchema: ZodSchema<TOutput>;
  readonly requiredContext: AgentContextRequirement[];

  validateInput(raw: unknown): TInput;
  validateOutput(raw: unknown): TOutput;
  getNextStep(output: TOutput, context: AgentExecutionContext): WorkflowStepDecision;
  getHumanReviewRequirement(output: TOutput, context: AgentExecutionContext): HumanReviewDecision;
}
```

Source: `backend/src/agents/base/agent-contract.interfaces.ts`

---

## The 10 Non-Negotiable Rules

### Rule 1 — No direct LLM calls
All LLM calls must go through `LlmGatewayService.call()`. Agents receive the gateway via `AgentExecutionContext`.

```typescript
// ❌ FORBIDDEN
const response = await this.llm.complete([...], { model: 'claude-...' });

// ✅ CORRECT
const response = await context.llmGateway.call({
  promptTemplateId: this.promptTemplateId,
  orgId: context.organizationId,
  variables: { ... },
});
```

The CI compliance gate (`ci.yml`) scans for `new Anthropic`, `this.llm.complete`, and `anthropic.messages` in `src/agents/` and fails the build if any are found.

---

### Rule 2 — No inline prompts
All prompts must live in `backend/src/prompts/<agent>/<agent>-v1.prompt.ts` and be registered in `PromptRegistryService`.

```typescript
// ❌ FORBIDDEN (anywhere in src/agents/)
const SYSTEM_PROMPT = `You are a compliance expert...`;

// ✅ CORRECT — prompt lives in src/prompts/policy/policy-generator-v1.prompt.ts
readonly promptTemplateId = 'policy-generator';
```

The CI gate scans for `const SYSTEM_PROMPT` and `SYSTEM_PROMPT = \`` and fails if found.

---

### Rule 3 — Deterministic agents declare usesLlm = false
If an agent does not call the LLM Gateway, it must declare `usesLlm = false`. This enables correct context packing and cost attribution.

```typescript
// Control Mapper — purely deterministic
readonly usesLlm = false;
readonly taskType: AgentTaskType = 'deterministic';
readonly promptTemplateId = undefined; // not needed
```

---

### Rule 4 — Runtime input validation
Every agent validates its input using `AgentJobDataSchema.safeParse()`. This is done automatically in `BaseAgent.execute()` — the parsed and validated job data is passed to `process()`.

Agents must additionally validate their domain-specific input payload with their own `inputSchema`:

```typescript
readonly inputSchema = z.object({
  frameworkIds: z.array(z.string().min(1)).min(1),
  orgId: z.string().min(1),
});

validateInput(raw: unknown): MyAgentInput {
  return this.inputSchema.parse(raw);
}
```

---

### Rule 5 — AgentRun + AgentStep records
Every agent must write `AgentRun` and `AgentStep` records for audit trail and replay support. BaseAgent handles the `AgentRun` wrapper automatically. Individual steps should write `AgentStep` records:

```typescript
await this.prisma.agentStep.create({
  data: {
    agentRunId: context.agentRunId,
    stepName: 'gap-analysis',
    status: 'completed',
    input: input as any,
    output: result as any,
  },
});
```

---

### Rule 6 — Tenant isolation in all DB writes
Every Prisma query must include `orgId` (or the equivalent foreign key). There are no exceptions.

```typescript
// ❌ FORBIDDEN
await this.prisma.policy.findMany();

// ✅ CORRECT
await this.prisma.policy.findMany({ where: { orgId: context.organizationId } });
```

---

### Rule 7 — No direct agent-to-agent calls
Agents must never call `anotherAgent.execute()` directly. They signal the next step via `WorkflowStepDecision`, and the WorkflowEngine advances the pipeline via BullMQ.

```typescript
// ❌ FORBIDDEN (direct call)
await this.plannerAgent.execute(jobData);

// ✅ CORRECT (return decision, engine advances pipeline)
getNextStep(output, context): WorkflowStepDecision {
  return { status: 'continue', nextQueue: QUEUE_NAMES.AGENT_PLANNER };
}
```

The CI gate scans for `.execute(` in `src/agents/` (excluding `base.agent.ts` and `spec.ts`) and fails if found.

---

### Rule 8 — Human checkpoints
When human review is required, agents must return `status: 'wait_for_human'` from `getNextStep()` and `required: true` from `getHumanReviewRequirement()`. The orchestrator creates a `HumanCheckpoint` record.

```typescript
getHumanReviewRequirement(output, context): HumanReviewDecision {
  const hasHighRisk = output.risks.some(r => r.severity === 'high');
  return {
    required: hasHighRisk,
    reason: 'High-severity risks require security lead review',
    approverRoles: ['security_lead'],
    relatedControls: output.affectedControls,
  };
}
```

---

### Rule 9 — No forbidden certification language
Agent output (and prompt templates) must never contain:

- `certified` / `ISO certified` / `SOC 2 certified`
- `passed SOC 2` / `audit passed`
- `guaranteed compliance` / `guaranteed audit success`
- `ISO 27001 certified`

The `OutputValidatorService` scans every LLM response and retries up to 3 times. If detected after 3 attempts, it logs the incident and still returns the response (with the flag set). The audit export always appends `AUDIT_DISCLAIMER`.

---

### Rule 10 — Control IDs must exist in the Control Library
Any control ID referenced in agent output must be validated against `ControlLibraryService`. Pass `requiresControlValidation: true` in gateway requests when your output references controls.

```typescript
const response = await context.llmGateway.call({
  promptTemplateId: this.promptTemplateId,
  requiresControlValidation: true, // will call ControlLibraryService to validate IDs
  orgId: context.organizationId,
  variables: { ... },
});
```

---

## Agent Execution Context

```typescript
interface AgentExecutionContext {
  organizationId: string;        // tenant ID — apply to every DB write
  userId?: string;               // initiating user
  workflowId: string;            // compliance journey workflow
  agentRunId: string;            // this agent run's ID
  correlationId: string;         // distributed trace ID
  businessProfileVersion?: number;
  frameworkVersions: FrameworkVersionRef[];
  llmGateway: LlmGatewayService; // only permitted LLM entry point
  controlLibrary: ControlLibraryService;
  logger: Logger;
}
```

---

## Job Data Schema

Every agent job (BullMQ job payload) is validated against `AgentJobDataSchema`:

```typescript
const AgentJobDataSchema = z.object({
  workflowId:      z.string().min(1),
  journeyId:       z.string().min(1),
  orgId:           z.string().min(1),
  runId:           z.string().optional(),
  isReplay:        z.boolean().optional().default(false),
  inputPayload:    z.record(z.string(), z.unknown()).default({}),
  businessProfile: z.record(z.string(), z.unknown()).optional(),
  stepIndex:       z.number().int().optional(),
});
```

If validation fails, `BaseAgent.execute()` throws immediately and the job is marked failed.

---

## Building a New Agent — Checklist

1. Create `backend/src/agents/<name>/<name>.agent.ts` extending `BaseAgent`
2. Create `backend/src/prompts/<name>/<name>-v1.prompt.ts` (if LLM-using)
3. Register the prompt template in `PromptRegistryService` `ALL_PROMPTS` array
4. Add queue name to `QUEUE_NAMES` in `queue.config.ts`
5. Add queue to `FULL_PIPELINE` in `queue.config.ts` (in correct order)
6. Register in `agentMap` in `agent.processor.ts`
7. Export `<Name>Processor` from `agent.processor.ts`
8. Add `@InjectQueue` parameter to `WorkflowEngine` constructor
9. Add queue to `queueMap` in `WorkflowEngine`
10. Register in `OrchestratorModule` (BullMQ queue + processor)
11. Add agent to `AgentsModule`
12. Implement `getNextStep()` and `getHumanReviewRequirement()`
13. Write a spec file: `<name>.agent.spec.ts`

---

## Prompt Template Structure

```typescript
// backend/src/prompts/<agent>/<agent>-v1.prompt.ts
import { PromptTemplate } from '../prompt.interfaces';

export const MY_AGENT_PROMPT_V1: PromptTemplate = {
  templateId: 'my-agent',        // matches promptTemplateId on agent
  version: 'v1',
  agentName: 'my-agent',
  taskType: 'compliance',
  purpose: 'One sentence describing what this prompt does',
  systemPrompt: `...`,
  userPromptTemplate: `Context: {{contextVariable}}
Perform: {{taskDescription}}`,
  inputVariables: ['contextVariable', 'taskDescription'],
  outputSchemaId: undefined,     // or a registered schema ID
};
```

All `inputVariables` must be present when calling `gateway.render()`. Missing variables cause a `PolicyViolationException`.

---

## Task Types and Context Packing

The `taskType` field controls what `ContextPackerService` injects:

| Task Type | Injected Context |
|-----------|-----------------|
| `compliance` | applicable controls + org control status + scope + risks |
| `policy` | policy templates + mapped controls + existing policies |
| `evidence_validation` | evidence metadata + control evidence requirements + freshness rules |
| `audit_export` | finalized control matrix + approved policies + disclaimer |
| `dashboard` | readiness scores + control status + task status |
| `onboarding` | business profile fields + dialogue state |
| `risk` | risk register + mapped controls + treatment requirements |
| `deterministic` | nothing — deterministic agents don't call the LLM |
| `generic` | business profile summary only |

---

## Versioning

- Agent `version` follows semver: `'1.0.0'`
- Prompt template `version` follows `'v1'`, `'v2'`, etc.
- Breaking changes to agent logic must increment the agent version
- Breaking changes to prompt content must create a new prompt template version (new file)
- Old prompt versions remain registered for replay determinism
