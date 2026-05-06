# Eval Harness

## Overview

The `EvalHarnessService` validates LLM agent outputs against **golden datasets** — ground-truth JSON files that capture expected outputs for known, fixed inputs. Running evals after any prompt or model change detects regressions before they reach production.

Key properties:

- **Prompt regression detection** — evals catch cases where a prompt edit causes an agent to stop producing the expected structure or content.
- **Model-change safety** — when upgrading Claude model versions, evals confirm that output semantics are preserved.
- **CI-safe** — the static eval mode requires no database connection and no LLM API key, making it suitable for every CI run.

**Source:**
`backend/src/llm-gateway/eval/eval-harness.service.ts`

**Golden datasets:**
`backend/src/llm-gateway/eval/golden-datasets/`

---

## Current Golden Datasets

Three datasets are included as of build v1:

| File                          | Agent              | What it tests                                      |
|-------------------------------|--------------------|----------------------------------------------------|
| `onboarding.golden.json`      | `onboarding`       | Dialogue extraction — structured fields from free-form onboarding conversation |
| `gap-analysis.golden.json`    | `gap-analysis`     | Gap analysis output structure — `gapIdentified`, `severity`, `controlCode`, recommendations |
| `policy-generator.golden.json`| `policy-generator` | Policy generation structure — required sections, forbidden compliance-guarantee phrases |

Each file may contain multiple test cases covering different input scenarios for the same agent.

---

## Golden Dataset Format

```json
{
  "datasetId": "gap-analysis-v1",
  "agentName": "gap-analysis",
  "promptTemplateId": "gap-analysis",
  "promptTemplateVersion": "v1",
  "cases": [
    {
      "caseId": "soc2-cc6-gap",
      "description": "CC6 gap for company without MFA",
      "input": {
        "controlCode": "CC6.1",
        "currentState": "No MFA implemented",
        "requiredState": "MFA required for all admin access"
      },
      "expectedOutput": {
        "gapIdentified": true,
        "severity": "high",
        "controlCode": "CC6.1"
      },
      "assertions": [
        { "field": "gapIdentified", "operator": "eq",      "expected": true      },
        { "field": "severity",      "operator": "eq",      "expected": "high"    },
        { "field": "controlCode",   "operator": "eq",      "expected": "CC6.1"   }
      ],
      "forbiddenPhrases": ["certified", "guaranteed"]
    }
  ]
}
```

### Top-level fields

| Field                  | Type     | Required | Description                                                              |
|------------------------|----------|----------|--------------------------------------------------------------------------|
| `datasetId`            | string   | yes      | Unique identifier for this dataset (used in API calls and log output)    |
| `agentName`            | string   | yes      | Name of the agent whose output is being evaluated                        |
| `promptTemplateId`     | string   | yes      | ID of the prompt template this dataset is pinned to                      |
| `promptTemplateVersion`| string   | yes      | Version string — evals must be re-validated when the version changes     |
| `cases`                | array    | yes      | One or more test cases (see below)                                       |

### Case fields

| Field            | Type     | Required | Description                                                                      |
|------------------|----------|----------|----------------------------------------------------------------------------------|
| `caseId`         | string   | yes      | Unique identifier within the dataset                                             |
| `description`    | string   | yes      | Human-readable description of what scenario this case covers                     |
| `input`          | object   | yes      | Inputs passed to the agent                                                       |
| `expectedOutput` | object   | no       | Reference output used for documentation and manual review                        |
| `assertions`     | array    | yes      | Machine-checked assertions against the actual agent output                       |
| `forbiddenPhrases` | array  | no       | Strings that must NOT appear anywhere in the agent output                        |

---

## Assertion Operators

Each assertion in the `assertions` array specifies a `field` path (dot-notation supported), an `operator`, and an optional `expected` value.

| Operator          | Meaning                                                          |
|-------------------|------------------------------------------------------------------|
| `eq`              | Field value strictly equals `expected`                           |
| `contains`        | String field contains `expected` as a substring                  |
| `exists`          | Field is present in the output and is not `null` or `undefined`  |
| `arrayMinLength`  | Field is an array with at least `expected` elements              |
| `forbiddenPhrase` | String field does NOT contain `expected` as a substring          |

Assertions are evaluated against the parsed JSON output of the agent. If the agent returns a non-JSON response, all assertions for that case fail immediately with a parse-error reason.

**Example — asserting an array has at least two items:**

```json
{ "field": "recommendations", "operator": "arrayMinLength", "expected": 2 }
```

**Example — asserting a field exists:**

```json
{ "field": "controlCode", "operator": "exists" }
```

---

## Running Evals

### Static check (CI mode)

```bash
npm run eval:static
```

Does not require a database connection or LLM API key. Validates:

1. All golden dataset files parse as valid JSON.
2. Required top-level fields (`datasetId`, `agentName`, `promptTemplateId`, `promptTemplateVersion`, `cases`) are present.
3. Each case has required fields (`caseId`, `description`, `input`, `assertions`).
4. Every assertion references a valid operator from the supported operator set.
5. No `forbiddenPhrases` appear in any `expectedOutput` value (catches self-contradictory golden data).

Exit code is `0` on success, non-zero on any validation failure.

### Full eval run (LLM required)

```http
POST /llm/evals/run
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "datasetId": "gap-analysis-v1",   // optional — omit to run all datasets
  "useMock": false
}
```

When `useMock: true`, `EmbeddingsService` and the LLM client use their mock implementations, so no external API calls are made. This mode is used in CI for integration-level eval runs.

Response: `EvalResult` object (see schema below).

---

## CI Integration

The static eval check is wired into the GitHub Actions workflow as the **"Run static eval harness"** step. It runs on every pull request and every push to `main`.

```yaml
- name: Run static eval harness
  run: npm run eval:static
```

The step will fail the CI build if:

- Any golden dataset file contains invalid JSON.
- Any required field is missing from a dataset or case.
- Any assertion references an unknown operator.
- Any `forbiddenPhrase` appears in an `expectedOutput`.

The full (LLM-backed) eval suite is run in a separate CI job that sets `ENABLE_MOCK_EMBEDDINGS=true` and uses mock LLM responses, so it also runs on every PR without consuming API quota.

---

## Adding a Golden Dataset

Follow these steps to add an eval dataset for a new or existing agent:

1. **Create the file.**

   ```
   backend/src/llm-gateway/eval/golden-datasets/<agent-name>.golden.json
   ```

   Use the format described in the [Golden Dataset Format](#golden-dataset-format) section.

2. **Write test cases.** Cover at minimum:
   - A typical happy-path input.
   - An edge case or boundary condition.
   - An input where the agent should identify a negative result (e.g., no gap found).

3. **Register the dataset in `EvalHarnessService`.**

   In `eval-harness.service.ts`, add the new file path to the `loadDatasets()` method's dataset list so the service discovers it at runtime.

4. **Validate structure.**

   ```bash
   npm run eval:static
   ```

   Fix any structural errors reported before committing.

5. **Run a full eval** (optional but recommended before merging) to confirm the assertions pass against real LLM output:

   ```bash
   POST /llm/evals/run  { "datasetId": "<your-new-id>", "useMock": true }
   ```

---

## EvalHarnessService API

```typescript
/**
 * Load and parse all registered golden dataset files from disk.
 * Throws if any file fails JSON parsing or structural validation.
 */
loadDatasets(): Promise<EvalDataset[]>

/**
 * Run all cases in a single dataset against the live (or mock) LLM.
 */
runEval(
  datasetId: string,
  options: { useMock: boolean }
): Promise<EvalResult>

/**
 * Run all registered datasets and return one EvalResult per dataset.
 */
runAllEvals(
  options: { useMock: boolean }
): Promise<EvalResult[]>
```

---

## EvalResult Schema

```typescript
interface EvalResult {
  datasetId: string;
  agentName: string;
  totalCases: number;
  passed: number;
  failed: number;
  failedCases: FailedCase[];
  durationMs: number;
}

interface FailedCase {
  caseId: string;
  description: string;
  failedAssertions: FailedAssertion[];
  forbiddenPhrasesFound: string[];
  parseError?: string;  // set when the agent output could not be parsed as JSON
}

interface FailedAssertion {
  field: string;
  operator: string;
  expected: unknown;
  actual: unknown;
  reason: string;
}
```

A `passed` count of `totalCases` with an empty `failedCases` array indicates a clean run.

---

## Policy on Prompt Changes

Any change to files under `src/prompts/` **must** pass the full eval harness on all affected golden datasets before the pull request can be merged.

### If an eval starts failing after a prompt change

Two options are available:

**Option 1 — Fix the prompt (preferred).**
Adjust the prompt so the agent output satisfies the existing golden assertions. This is the preferred resolution because it means the expected behavior is preserved.

**Option 2 — Update the golden dataset.**
If the new behavior is intentionally different and is verified to be correct, the golden dataset may be updated to reflect the new expected outputs. This requires:

- An explicit review comment on the PR explaining why the new behavior is correct.
- Approval from at least one other engineer familiar with the agent's domain.
- The `promptTemplateVersion` field in the dataset bumped to reflect the change.

Updating a golden dataset to make a failing eval pass without review is not permitted — this defeats the purpose of the harness.

### Scope of the requirement

| Change type                                    | Eval requirement              |
|------------------------------------------------|-------------------------------|
| Edit to any file under `src/prompts/`          | All datasets for affected agents must pass |
| LLM model version bump                         | All datasets must pass        |
| New agent added                                | New golden dataset required before merge |
| Infrastructure change (no prompt/model change) | Static eval check only        |
