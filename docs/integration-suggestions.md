# Integration Suggestion Layer

The Integration Suggestion Layer **deterministically derives recommended tool connections** from the `InferenceOutput` produced at the start of each compliance assessment. Zero LLM calls — same inference output always produces the same suggestions.

---

## Purpose

After inference runs, the platform knows which frameworks are required, what risk level the org sits at, and which system flags are active (e.g. `requires_mfa=true`). The suggestion layer maps these signals to specific integration providers that automate evidence collection for the relevant controls.

Example: if `requires_mfa=true`, Okta is suggested because it automates CC6.1, CC6.2, CC6.3 evidence.

---

## Data Flow

```
InferenceOutput
       ↓
IntegrationSuggestionsService.buildSuggestions(inference)
       ↓
IntegrationSuggestion[] — sorted by relevanceScore desc
       ↓
IntegrationSuggestionsService.persistSuggestions(orgId, suggestions)
       ↓
integration_suggestions table (unique on orgId + provider)
       ↓
GET /integrations/suggestions → UI shows prioritised connection list
```

---

## Suggestion Rules

| Trigger | Suggested Provider | Score | Automates |
|---------|-------------------|-------|-----------|
| `expected_integrations` from R-007 | `okta` | 90 | CC6.1, CC6.2, CC6.3, A.9.1 |
| `system_flags.requires_mfa=true` | `okta` | 95 | CC6.1–CC6.3 |
| `system_flags.requires_logging=true` | `datadog` | 85 | CC7.2, CC7.3, A.12.4 |
| `system_flags.requires_vendor_review=true` | `jira` | 60 | CC9.2 |
| SOC2 or ISO27001 selected | `aws` | 80 | CC6.6, CC7.1, A.12.1 |
| SOC2 selected | `github` | 75 | CC8.1 |
| ISO27001 selected | `bamboohr` | 70 | A.7.1, A.7.2 |

**De-duplication**: if a provider appears via `expected_integrations` AND a system flag rule, only the first occurrence is kept (no duplicates).

---

## Provider Catalogue

The `PROVIDER_METADATA` map in `integration-suggestions.service.ts` defines all supported providers:

| Provider | Category | Key Controls |
|----------|----------|-------------|
| `okta` | identity | CC6.1, CC6.2, CC6.3, A.9.1, A.9.2 |
| `azure_ad` | identity | CC6.1, CC6.2, CC6.3 |
| `google_ws` | identity | CC6.1, CC6.2 |
| `aws` | cloud | CC6.6, CC7.1, CC7.2, A.12.4 |
| `gcp` | cloud | CC6.6, CC7.1 |
| `azure` | cloud | CC6.6, CC7.1 |
| `github` | code | CC8.1, A.12.1, A.12.6 |
| `gitlab` | code | CC8.1, A.12.1 |
| `datadog` | monitoring | CC7.2, CC7.3, A.12.4 |
| `splunk` | monitoring | CC7.2, CC7.3, A.12.4 |
| `pagerduty` | monitoring | CC7.3, A.16.1 |
| `jira` | ticketing | CC9.2 |
| `linear` | ticketing | CC9.2 |
| `workday` | hr | CC1.1, CC1.4, A.7.1, A.7.2 |
| `bamboohr` | hr | CC1.1, A.7.1 |

---

## Credential Security

Integration credentials are **never stored in plaintext**. The `SecretManagerService` wraps AES-256-GCM encryption:

```
connect(orgId, provider, credentials)
    → SecretManagerService.encrypt(credentials)
    → stored as base64 envelope in integration.credentials column

testConnection / sync
    → SecretManagerService.safeDecrypt(integration.credentials)
    → pass plaintext credentials to adapter only in memory
```

**Envelope format** (base64-encoded JSON):
```json
{ "v": 1, "iv": "<12-byte hex>", "tag": "<16-byte hex>", "ct": "<ciphertext hex>" }
```

The GCM authentication tag ensures any tampering is detected at decrypt time.

**Key management**: set `LOCAL_SECRET_ENCRYPTION_KEY` env var. In production, replace the key derivation with a call to AWS KMS, GCP Cloud KMS, or HashiCorp Vault — the `SecretManagerService` interface remains identical.

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /integrations/suggestions` | Get all non-dismissed suggestions for the current org |
| `POST /integrations/suggestions/:provider/dismiss` | Dismiss a suggestion |
| `POST /integrations` | Connect an integration (encrypts credentials) |
| `GET /integrations` | List connected integrations (never exposes credentials) |
| `POST /integrations/:id/test` | Test an existing connection |
| `POST /integrations/:id/sync` | Collect evidence from a connected integration |
| `DELETE /integrations/:id` | Disconnect (wipes credentials field) |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/integrations/integration-suggestions.service.ts` | Deterministic suggestion builder + persistence |
| `src/integrations/secret-manager.service.ts` | AES-256-GCM credential encryption |
| `src/integrations/integrations-core.module.ts` | NestJS module exporting both services |
| `src/modules/integrations/integrations.service.ts` | HTTP-layer integration CRUD (uses SecretManager) |
| `src/integrations/integration-suggestions.spec.ts` | 11 unit tests (IS01–IS06, SM01–SM05) |
