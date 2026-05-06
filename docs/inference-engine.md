# Inference Engine

The Inference Engine is a **deterministic, zero-LLM rules processor** that runs as the first stage of every compliance assessment pipeline. It reads the completed business profile, evaluates 12 inference rules, and produces a structured `InferenceOutput` that all downstream agents depend on.

---

## Core Guarantee

> **Same input → same output, always.**  
> The engine contains no randomness, no LLM calls, and no network I/O beyond a single DB read.  
> `InferenceRulesService.evaluate()` is a pure function of `OnboardingProfileInput`.

---

## Pipeline Position

```
OnboardingAgent (completes profile)
        ↓
  [ onboarding.completed event ]
        ↓
  WorkflowEngine.startFromOnboarding()
        ↓
  InferenceAgent  ← stage 0 (first in FULL_PIPELINE)
        ↓
  ScopingAgent    ← stage 1
        ↓
  ... (18 more stages)
```

The inference queue is `agent.inference`. Every `startFromOnboarding()` call uses a SHA-256 idempotency key:

```
sha256(orgId + ':' + onboardingVersion + ':inference-agent:0')
```

This prevents duplicate inference runs if onboarding events fire more than once.

---

## InferenceOutput Contract

```typescript
interface InferenceOutput {
  organization_id: string;
  onboarding_version: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_score: number;                  // 0–∞ (sum of fired rule weights)
  risk_drivers: Array<{
    rule_id: string;
    weight: number;
    rationale: string;
  }>;
  inferred_frameworks: InferredFramework[];
  data_classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SENSITIVE';
  required_controls: RequiredControl[];
  expected_integrations: ExpectedIntegration[];
  system_flags: SystemFlags;
  computed_at: string;                 // ISO 8601
  engine_version: string;              // '1.0.0' — bump on rule changes
}
```

---

## Rule Table (R-001 through R-012)

| Rule | Trigger | Weight | Effects |
|------|---------|--------|---------|
| R-001 | `stores_pii=true` AND `data_regions` includes EU country | 3 | GDPR REQUIRED, `requires_dpa=true` |
| R-002 | `stores_health_data=true` | 3 | HIPAA RECOMMENDED |
| R-003 | `stores_financial_data=true` AND `industry` includes financial | 2 | PCI RECOMMENDED, data_classification→SENSITIVE |
| R-004 | `product_type=SaaS` | 1 | SOC2 RECOMMENDED |
| R-005 | `target_frameworks` includes SOC2 | 0 | SOC2 REQUIRED, CC1–CC9 controls |
| R-006 | `target_frameworks` includes ISO27001 | 0 | ISO27001 REQUIRED, A.5–A.18 controls |
| R-007 | `!enforces_mfa` AND `stores_pii=true` | 3 | `requires_mfa=true`, CC6.3, A.9.4.2 |
| R-008 | `uses_third_parties=true` AND `vendors_process_data=true` | 2 | `requires_vendor_review=true`, CC9.2, A.5.19 |
| R-009 | `stores_credentials=true` | 1 | data_classification→CONFIDENTIAL |
| R-010 | `has_backups=false` | 2 | `requires_incident_response_plan=true`, A.12.3 |
| R-011 | `!encryption_at_rest` | 2 | `requires_encryption=true`, CC6.1, A.10.1 |
| R-012 | `!has_monitoring` | 1 | `requires_logging=true`, CC7.2, A.12.4 |

**Goal selection always wins**: if `target_frameworks` includes SOC2 or ISO27001, those frameworks are set to `REQUIRED` regardless of what earlier rules inferred.

---

## Risk Level Thresholds

| Score Range | Risk Level |
|-------------|-----------|
| 0–3 | LOW |
| 4–7 | MEDIUM |
| 8+ | HIGH |

---

## Agent Memory Writes

The `InferenceAgent` writes to namespace `inference` after every successful run:

| Key | Value |
|-----|-------|
| `inference_output` | Full `InferenceOutput` object |
| `risk_level` | `'LOW'` \| `'MEDIUM'` \| `'HIGH'` |
| `frameworks` | `InferredFramework[]` |
| `required_controls` | `RequiredControl[]` |
| `system_flags` | `SystemFlags` |

Downstream agents read these keys via `AgentMemoryService.read()`.

---

## Engine Version

`INFERENCE_ENGINE_VERSION = '1.0.0'` is stored in every `InferenceResult` DB row.  
**Increment this constant whenever you change any rule.**  
Changing the version triggers the `InferenceService.infer()` to overwrite the cached result for any re-run.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/inference/inference.types.ts` | All types: `OnboardingProfileInput`, `InferenceOutput`, `RuleEffect` (discriminated union) |
| `src/inference/inference-rules.service.ts` | All 12 rules + `evaluate()` aggregator |
| `src/inference/inference.service.ts` | DB persistence + `buildProfileInput()` mapper |
| `src/inference/inference.module.ts` | NestJS module |
| `src/agents/inference/inference.agent.ts` | BullMQ queue handler |
| `src/inference/inference-engine.spec.ts` | 19 unit tests (IE01–IE19) |

---

## Adding a New Rule

1. Add a constant to `RISK_THRESHOLDS` if new thresholds are needed.
2. Add a private `R0XX()` method in `InferenceRulesService` following the pattern of existing rules.
3. Call it in `evaluateAllRules()`.
4. Bump `INFERENCE_ENGINE_VERSION`.
5. Add corresponding test cases `IE-XX` to `inference-engine.spec.ts`.
6. Update this doc.
