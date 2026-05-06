# LLM Gateway — Complete Reference

## Table of Contents

1. [Overview](#overview)
2. [Request Flow](#request-flow)
3. [ComplianceSafePromptWrapper](#compliancesafepromtwrapper)
4. [Model Routing Table](#model-routing-table)
5. [Forbidden Language Detection](#forbidden-language-detection)
6. [Prompt Registry](#prompt-registry)
7. [LlmGatewayRequest Interface](#llmgatewayrequest-interface)
8. [LlmGatewayResponse Interface](#llmgatewayresponse-interface)
9. [Cost Tracking](#cost-tracking)
10. [Replay](#replay)

---

## Overview

`LlmGatewayService` is the **only permitted way** for any agent, service, or module to call a large language model. Direct provider calls — including direct instantiation of the Anthropic SDK, OpenAI SDK, or any HTTP call to a model provider endpoint — are **forbidden** and will be caught and rejected in CI via a static analysis lint rule.

This design enforces several non-negotiable guarantees across every LLM interaction in the system:

- **Every call is traceable.** Every call produces an `llm_calls` record with a prompt hash, token counts, cost, latency, and validation flags.
- **Every call uses a registered, versioned prompt.** No agent can pass an ad-hoc string as a system prompt. All prompts must be pre-registered in the PromptRegistry.
- **Every response is validated.** Schema conformance, control ID validity, and forbidden language are checked before any response is persisted or returned to the calling agent.
- **Every call is replayable.** The rendered prompt is stored so any call can be deterministically replayed via the `/llm/calls/:id/replay` endpoint.
- **The compliance wrapper is always present.** No agent can bypass the `ComplianceSafePromptWrapper` that governs output language and citation behavior.

---

## Request Flow

The following steps execute for every call to `LlmGatewayService.call()`.

**Step 1 — Agent initiates call**

The agent calls `context.llmGateway.call(request: LlmGatewayRequest)`. The `context` object is injected into every agent by the WorkflowEngine at job execution time. Agents never instantiate `LlmGatewayService` directly; they always receive it through the execution context.

**Step 2 — Prompt template validation**

The gateway calls `PromptRegistryService.getTemplate(request.promptTemplateId)`. If the template ID does not exist in the registry, a `PolicyViolationException` is thrown immediately. The call does not proceed. The exception is logged to the `agent_steps` table with the reason `unregistered_prompt_template`.

**Step 3 — Prompt rendering**

The template content is retrieved and all `{{variable}}` placeholders are substituted with values from the `request.variables` map. If a placeholder references a key that is not present in the `variables` map, a `PromptRenderException` is thrown. Substitution is strict — no silent omissions.

**Step 4 — Context pack assembly**

`ContextPackerService.buildContextPack(request.taskType, request.orgId)` assembles the RAG context that will be injected into the user message. The context pack may include:

- Relevant control definitions retrieved from `vector_embeddings` via pgvector similarity search
- Relevant policy snippets (for review and validation agents)
- The current compliance journey state summary
- Any human checkpoint decisions that are relevant to the current task

All vector queries are scoped to `request.orgId`. No cross-tenant content is ever retrieved.

**Step 5 — ComplianceSafePromptWrapper prepended**

The full `ComplianceSafePromptWrapper` text (see [below](#compliancesafepromtwrapper)) is prepended to the system prompt before the call is dispatched. This step cannot be skipped or overridden by any agent.

**Step 6 — Prompt hashing**

The fully rendered prompt (system prompt including wrapper + user message including context pack) is hashed using SHA-256. The resulting hex digest is stored as `prompt_hash` in the `llm_calls` record. This hash enables replay and tamper detection.

**Step 7 — Model selection**

The gateway looks up `request.agentType` in the `AGENT_MODEL_ROUTING` map to determine which model to use. See [Model Routing Table](#model-routing-table). The selected model ID is recorded in `llm_calls.model`.

**Step 8 — LLM call**

`LlmService.complete(model, systemPrompt, userMessage, schema?)` is called. This is the only place in the codebase where the Anthropic SDK is invoked. Token counts (input and output) and wall-clock latency are captured here.

**Step 9 — Output validation**

`OutputValidatorService.validate(response, request.outputSchema)` performs three checks:

1. **Schema validation** — if `request.outputSchema` is provided (a Zod schema), the parsed response JSON is validated against it. A schema mismatch causes a `SchemaValidationException`.
2. **Control ID validation** — any string matching the pattern of a control ID (e.g., `CC6.1`, `A.8.3`) in the response is verified against the control library. Invented control IDs cause a `PolicyViolationException`.
3. **Forbidden language check** — the response text is scanned for all phrases in the forbidden language list. If any match is found, the response is flagged.

**Step 10 — Forbidden language retry loop**

If forbidden language is detected in step 9, the gateway does not return the response. Instead:

1. A correction hint is appended to the user message: `"Your previous response contained forbidden language. Review the FORBIDDEN list in your system prompt and revise your response to comply."`
2. The call is retried from step 8 (the prompt hash is recomputed with the appended hint).
3. This retry loop runs up to **3 times**.
4. If all 3 retries produce forbidden language, the call is marked `validation_failed` in `llm_calls`, `forbidden_language_detected: true` is set, and a `ForbiddenLanguageException` is thrown to the calling agent.

**Step 11 — Audit logging**

An `llm_calls` record is written (or updated, if a retry occurred) with:

- `prompt_hash` (SHA-256 of the final rendered prompt)
- `rendered_prompt` (the full rendered text, stored for replay)
- `model`
- `input_tokens`, `output_tokens`
- `cost_usd` (computed by `estimateCost()`)
- `latency_ms`
- `retry_count`
- `schema_valid` (boolean)
- `forbidden_language_detected` (boolean)
- `validation_failed` (boolean)
- `agent_run_id` (links to the calling agent's run record)
- `org_id`

**Step 12 — RAG source logging**

If a context pack was assembled in step 4 and RAG chunks were retrieved, one `llm_retrieval_sources` record is written per retrieved chunk, containing:

- `llm_call_id`
- `embedding_id` (references `vector_embeddings`)
- `similarity_score`
- `chunk_text` (the raw text injected)
- `chunk_metadata` (source document, section, framework reference)

**Step 13 — Response returned**

An `LlmGatewayResponse` object is returned to the calling agent. See [LlmGatewayResponse Interface](#llmgatewayresponse-interface).

---

## ComplianceSafePromptWrapper

The following text is prepended to the system prompt of **every** LLM call made through the gateway. It cannot be modified by agents, and its removal would require a change to `LlmGatewayService` source code.

```
You are operating as part of a compliance readiness platform.

RULES:
- The Control Library is the ONLY source of truth for control IDs. All control IDs
  you reference must come from the controls provided in your context. Do not reference
  control IDs that were not explicitly provided to you.
- Never invent control IDs. If a control you need is not in your context, state that
  the control was not found and set requires_human_review: true.
- Never claim certification. Use "ready for auditor review" rather than "certified",
  "passed", or "compliant". Certification is a legal determination made by an accredited
  auditor, not by this platform.
- Always surface assumptions. If you make an assumption due to missing information,
  state the assumption explicitly in your response.
- Flag anything that requires a human expert to verify with requires_human_review: true
  in the relevant section of your response.
- Return schema-valid JSON when a schema is specified in your instructions. Do not
  include prose outside the JSON structure when a schema is specified.

FORBIDDEN (never use these words or phrases in any output):
- certified
- guaranteed compliance
- passed SOC 2
- ISO certified
- guaranteed audit success
- compliance guaranteed
- audit-proof
- fully compliant
```

The wrapper is stored as a constant in `llm-gateway/constants/compliance-wrapper.constant.ts` and is referenced directly in `LlmGatewayService`. It is not stored in the database and is not configurable at runtime.

---

## Model Routing Table

The `AGENT_MODEL_ROUTING` map selects the appropriate model for each agent type. Higher-complexity reasoning tasks are routed to `claude-sonnet-4-6`; lower-complexity, high-volume tasks are routed to `claude-haiku-4-5-20251001` to reduce cost and latency.

```typescript
export const AGENT_MODEL_ROUTING: Record<AgentType, string> = {
  // Sonnet — complex reasoning, multi-framework analysis, document generation
  review:        'claude-sonnet-4-6',
  onboarding:    'claude-sonnet-4-6',
  policy:        'claude-sonnet-4-6',
  'gap-analysis': 'claude-sonnet-4-6',
  validator:     'claude-sonnet-4-6',
  planner:       'claude-sonnet-4-6',
  audit:         'claude-sonnet-4-6',
  scoping:       'claude-sonnet-4-6',
  risk:          'claude-sonnet-4-6',

  // Haiku — structured extraction, mapping, classification, high-volume tasks
  'control-mapper':  'claude-haiku-4-5-20251001',
  evidence:          'claude-haiku-4-5-20251001',
  task:              'claude-haiku-4-5-20251001',
  'vendor-risk':     'claude-haiku-4-5-20251001',
  'drift-detector':  'claude-haiku-4-5-20251001',
  dashboard:         'claude-haiku-4-5-20251001',
};
```

### Routing Rationale

| Model | Agent Types | Reason |
|-------|-------------|--------|
| `claude-sonnet-4-6` | review, onboarding, policy, gap-analysis, validator, planner, audit, scoping, risk | These agents produce outputs that directly influence compliance decisions, policy language, and human checkpoints. They require nuanced multi-step reasoning and accurate cross-framework knowledge. |
| `claude-haiku-4-5-20251001` | control-mapper, evidence, task, vendor-risk, drift-detector, dashboard | These agents perform structured extraction and mapping tasks with well-defined schemas. They process high volumes of data and benefit from Haiku's lower cost and lower latency without sacrificing accuracy on structured tasks. |

To change the model for an agent type, update `AGENT_MODEL_ROUTING` in `llm-gateway/constants/model-routing.constant.ts`. The change takes effect at next server restart. The model used is always recorded in `llm_calls.model`, so historical calls are unaffected.

---

## Forbidden Language Detection

### Forbidden Phrase List

The following phrases are checked case-insensitively against every LLM response before it is returned. Both exact matches and substring matches trigger detection.

| Phrase | Reason Forbidden |
|--------|-----------------|
| `certified` | Implies legal certification status which only an accredited auditor can grant |
| `guaranteed compliance` | No platform can guarantee regulatory compliance |
| `passed SOC 2` | SOC 2 is a point-in-time audit result, not a platform output |
| `ISO certified` | ISO certification requires accredited body assessment |
| `guaranteed audit success` | No tool can guarantee an audit outcome |
| `compliance guaranteed` | Same rationale as "guaranteed compliance" |
| `audit-proof` | No control set is provably audit-proof |
| `fully compliant` | Compliance is a spectrum and context-dependent; absolute claims are misleading |

The phrase list is stored in `llm-gateway/constants/forbidden-language.constant.ts` as a `string[]`. New phrases can be added without code changes to the gateway logic.

### Retry Behavior

When forbidden language is detected in a model response, the following sequence executes:

1. The response is discarded. It is never returned to the calling agent and never persisted as agent output.
2. A correction hint is appended to the end of the user message for the retry: `"Your previous response contained language from the FORBIDDEN list in your system prompt. Please revise your response to remove all forbidden phrases and resubmit."`
3. The prompt hash is recomputed (the hint changes the input text).
4. The LLM call is retried.
5. Steps 1–4 repeat for up to **3 total retries**.
6. If all 3 retries still contain forbidden language, the gateway:
   - Sets `forbidden_language_detected: true` and `validation_failed: true` in the `llm_calls` record
   - Sets `retry_count: 3`
   - Throws a `ForbiddenLanguageException` to the calling agent
   - The calling agent is expected to catch this exception and return a `WorkflowStepDecision { action: 'wait_for_human' }` with the reason `forbidden_language_retry_exhausted`

The `retry_count` field in `llm_calls` records how many retries were needed (0 = no forbidden language on first attempt; 3 = all retries failed).

---

## Prompt Registry

### How Prompts Are Registered

At NestJS application startup, `PromptRegistryService.onModuleInit()` executes the following:

1. Reads all `prompt_templates` records from the database.
2. For each record, recomputes the SHA-256 hash of the `content` field.
3. Compares the computed hash to the stored `content_hash` field.
4. If any hash does not match, the application **throws a fatal error and refuses to start**. This prevents silent prompt drift — any modification to a prompt template outside of the approved migration flow will halt the server.
5. Loads all valid templates into an in-memory `Map<string, PromptTemplate>` keyed by `template_id`.

Once loaded, the registry is read-only for the lifetime of the process. Runtime modifications to `prompt_templates` (e.g., via direct database update) do not take effect until the next server restart, and they will fail the hash check if the `content_hash` column is not updated atomically with the `content` column.

### prompt_templates Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `template_id` | string | Human-readable identifier used in `LlmGatewayRequest.promptTemplateId` (e.g., `scoping-agent-v2`) |
| `agent_type` | string | The agent type this template belongs to |
| `version` | integer | Monotonically increasing version number |
| `content` | text | The full prompt template text with `{{variable}}` placeholders |
| `content_hash` | string | SHA-256 hex digest of `content`. Must match the computed hash at startup. |
| `variables` | jsonb | Array of expected variable names. Used for documentation and validation. |
| `created_at` | timestamp | |
| `deprecated_at` | timestamp | Null if active. Set when a new version supersedes this template. |

### Adding a New Prompt Template

1. Write the prompt template text with `{{variable}}` placeholders for all dynamic values.
2. Compute the SHA-256 hash of the template text: `echo -n "<template_content>" | sha256sum`
3. Create a Prisma migration that inserts a new row into `prompt_templates` with both `content` and `content_hash` set atomically.
4. Run the migration against all environments before deploying the agent code that references the new `template_id`.
5. Reference the new `template_id` string in the agent's `LlmGatewayRequest`.

Never update a template's `content` in-place without also updating `content_hash` in the same transaction. Never modify `content_hash` without recomputing it from the new `content`.

---

## LlmGatewayRequest Interface

```typescript
interface LlmGatewayRequest {
  /**
   * The template_id of a registered prompt in PromptRegistryService.
   * A PolicyViolationException is thrown if this ID is not found.
   * Example: "scoping-agent-v2"
   */
  promptTemplateId: string;

  /**
   * The agent type making the request. Used for model routing via
   * AGENT_MODEL_ROUTING and for llm_calls audit logging.
   */
  agentType: AgentType;

  /**
   * Key-value map of variables to substitute into {{variable}} placeholders
   * in the prompt template. All placeholders in the template must be satisfied.
   * A PromptRenderException is thrown for any missing variable.
   */
  variables: Record<string, string | number | boolean>;

  /**
   * The task type determines how ContextPackerService assembles the RAG
   * context pack. Maps to a ContextPackStrategy enum value.
   * Example: ContextPackStrategy.CONTROL_MAPPING
   */
  taskType: ContextPackStrategy;

  /**
   * The organization ID of the tenant making the request. Used to scope all
   * vector embedding queries. Required for tenant isolation.
   */
  orgId: string;

  /**
   * Optional Zod schema for the expected JSON response. When provided,
   * OutputValidatorService validates the parsed response against this schema.
   * If omitted, schema validation is skipped (not recommended for pipeline agents).
   */
  outputSchema?: ZodSchema;

  /**
   * Optional agent run ID to associate this LLM call with a specific agent_runs
   * record. If provided, llm_calls.agent_run_id is populated.
   */
  agentRunId?: string;

  /**
   * Optional array of additional system prompt segments to append after the
   * ComplianceSafePromptWrapper and the registered template's system prompt.
   * Use sparingly. Must not contain forbidden language.
   */
  systemPromptExtensions?: string[];

  /**
   * Optional maximum token limit for the response. Defaults to the model's
   * configured maximum. Use to constrain verbose models on structured tasks.
   */
  maxOutputTokens?: number;

  /**
   * Optional temperature override (0.0–1.0). Defaults to 0.2 for all pipeline
   * agents to favor deterministic, citation-grounded outputs. Onboarding agent
   * uses 0.7 for conversational variety.
   */
  temperature?: number;
}
```

---

## LlmGatewayResponse Interface

```typescript
interface LlmGatewayResponse {
  /**
   * The raw text content of the model's response. For structured-output calls
   * this will be a JSON string. For conversational calls it will be prose.
   */
  content: string;

  /**
   * The parsed and schema-validated response object. Only populated when
   * LlmGatewayRequest.outputSchema was provided and validation passed.
   * Null if no schema was provided or if schema validation failed (in which
   * case a SchemaValidationException was thrown before this is returned).
   */
  parsedContent: Record<string, unknown> | null;

  /**
   * The llm_calls record ID for this call. Agents should store this value in
   * their agent_steps records to enable full traceability from step → LLM call.
   */
  llmCallId: string;

  /**
   * The SHA-256 hex digest of the fully rendered prompt that was sent.
   * Identical to llm_calls.prompt_hash. Useful for agents that want to log
   * the hash without a separate DB round-trip.
   */
  promptHash: string;

  /**
   * The model that was used, as selected by AGENT_MODEL_ROUTING.
   * Example: "claude-sonnet-4-6"
   */
  model: string;

  /**
   * Number of input tokens consumed by this call (including system prompt,
   * context pack, and user message).
   */
  inputTokens: number;

  /**
   * Number of output tokens generated by the model.
   */
  outputTokens: number;

  /**
   * Estimated cost in USD for this call, as computed by estimateCost().
   * Identical to llm_calls.cost_usd.
   */
  costUsd: number;

  /**
   * Wall-clock latency in milliseconds from the first byte sent to the last
   * byte received. Identical to llm_calls.latency_ms.
   */
  latencyMs: number;

  /**
   * True if the response passed schema validation (or if no schema was provided).
   * False should never be returned — a SchemaValidationException is thrown
   * instead — but is included for completeness.
   */
  schemaValid: boolean;

  /**
   * True if forbidden language was detected in any retry attempt. Even if the
   * final response (after retries) passed validation, this flag is true if any
   * intermediate attempt contained forbidden language.
   */
  forbiddenLanguageDetected: boolean;

  /**
   * Number of retries that were needed due to forbidden language detection.
   * 0 means the first attempt succeeded. Maximum value is 3.
   */
  retryCount: number;

  /**
   * The RAG chunks that were retrieved and injected into the context pack for
   * this call. Null if no RAG was performed (taskType had no retrieval strategy).
   * These are also logged to llm_retrieval_sources.
   */
  retrievalSources: RetrievalSource[] | null;
}
```

---

## Cost Tracking

### estimateCost()

`LlmGatewayService` calls the internal `estimateCost(model, inputTokens, outputTokens)` method after every successful LLM call. The method looks up per-million-token pricing from the `MODEL_PRICING` constant map and computes:

```
cost_usd = (inputTokens / 1_000_000 * inputPricePerMillion)
         + (outputTokens / 1_000_000 * outputPricePerMillion)
```

The `MODEL_PRICING` map is defined in `llm-gateway/constants/model-pricing.constant.ts`. Prices must be updated manually when Anthropic adjusts pricing. The map is keyed by model ID string (matching the values in `AGENT_MODEL_ROUTING`).

### llm_calls.cost_usd

Every `llm_calls` record stores the computed `cost_usd` as a `NUMERIC(10, 6)` column. This enables:

- **Per-org cost reporting** — sum `cost_usd` grouped by `org_id` for billing or usage dashboards
- **Per-agent cost analysis** — join `llm_calls` to `agent_runs` to see which agents are most expensive
- **Per-journey cost totals** — join through `agent_runs` to `compliance_journeys` to see the total LLM cost of a complete assessment

The `/admin/usage` endpoint (admin role only) exposes aggregated cost data by org and by time period. Individual `llm_calls` records are not exposed to non-admin users.

### Cost Accuracy Note

The `estimateCost()` computation is an estimate based on public Anthropic pricing at the time the `MODEL_PRICING` constant was last updated. Actual billing from Anthropic may differ due to volume discounts, pricing changes, or rounding differences. The stored `cost_usd` values should be treated as indicative rather than authoritative for billing purposes.

---

## Replay

### Design Intent

Every call to `LlmGatewayService.call()` stores the fully rendered prompt — the complete text after template substitution, context pack injection, and wrapper prepending — in the `llm_calls.rendered_prompt` column. Combined with the `prompt_hash`, this enables **deterministic replay**: re-submitting the exact same prompt to the same model and comparing outputs.

Replay is useful for:

- **Debugging** — understanding exactly what prompt produced a given agent output
- **Regression testing** — verifying that a prompt template change does not alter the output for a known input
- **Audit** — demonstrating to an external auditor what inputs drove a compliance decision

### Replay API Endpoint

```
GET /llm/calls/:id/replay
Authorization: Bearer <admin-jwt>
```

This endpoint:

1. Retrieves the `llm_calls` record by ID.
2. Verifies that the SHA-256 hash of `rendered_prompt` matches `prompt_hash`. If the hashes do not match (indicating tampering), a `400 Bad Request` is returned with a tamper-detection error.
3. Re-submits `rendered_prompt` to the model recorded in `llm_calls.model`.
4. Returns a `ReplayResponse` containing:
   - `originalResponse` — the original response stored in the linked `agent_steps` record
   - `replayResponse` — the new response from the re-submission
   - `originalPromptHash` — the stored hash
   - `replayPromptHash` — the hash of the prompt as re-submitted (should be identical)
   - `tokensUsed` and `costUsd` for the replay call (billed separately)
   - `responseDiff` — a boolean indicating whether the two responses are identical

Replay calls are themselves logged to `llm_calls` with `is_replay: true` and a reference to the original `llm_call_id`. They do not trigger OutputValidatorService processing — the original validation result is preserved.

Access to the replay endpoint is restricted to the `admin` role. Replay results are never persisted as agent outputs and do not affect journey state.
