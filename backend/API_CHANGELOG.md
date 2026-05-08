# API Changelog

This file documents breaking changes per API version, required for SOC 2 CC8.1 change management.

## v1 (current, released P19)

All endpoints are prefixed `/api/v1/`.

### New endpoints (P19 — Documents + Enterprise Infrastructure)

#### Documents
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/documents` | List documents (filters: docType, status, search, classification) |
| POST   | `/api/v1/documents` | Create document |
| GET    | `/api/v1/documents/:id` | Get one document |
| PATCH  | `/api/v1/documents/:id` | Update (409 if locked) |
| POST   | `/api/v1/documents/:id/request-approval` | Lock + set status=review |
| POST   | `/api/v1/documents/:id/approve` | Approve (SoD: approver ≠ owner) |
| POST   | `/api/v1/documents/:id/reject` | Reject (reason required) |
| POST   | `/api/v1/documents/:id/archive` | Archive (423 if under legal hold) |
| POST   | `/api/v1/documents/:id/new-version` | Snapshot + increment version |
| GET    | `/api/v1/documents/:id/versions` | Version history |
| POST   | `/api/v1/documents/:id/restore/:version` | Restore version |
| POST   | `/api/v1/documents/:id/ai-improve` | AI improve text (10/user/hour) |
| POST   | `/api/v1/documents/:id/ai-gaps` | Detect missing sections (5/user/hour) |
| POST   | `/api/v1/documents/import/pdf` | AI-assisted PDF import |
| POST   | `/api/v1/documents/:id/legal-hold` | Set legal hold |
| DELETE | `/api/v1/documents/:id/legal-hold` | Release legal hold |

#### Connectors
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/connectors` | List connectors with status |
| POST   | `/api/v1/connectors/:id/connect` | Connect (store credentials) |
| DELETE | `/api/v1/connectors/:id` | Disconnect |
| GET    | `/api/v1/connectors/:id/test` | Test connection |

#### Feature Flags
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/feature-flags` | Get all flag states for current org |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/health` | DB + uptime health check |

### Rate Limits (P19)
- `POST /documents/:id/ai-improve` — 10 requests/user/hour
- `POST /documents/:id/ai-gaps` — 5 requests/user/hour
- All other document endpoints — 30 requests/user/minute (global throttle)

### AI Token Budget (P19)
- Per-org monthly token budget (`aiTokenBudgetMonthly`, default 500,000)
- Returns `402 Payment Required` if budget exceeded
- Resets on the 1st of each month

---

## Pre-v1 (legacy — P1–P18)

Routes under `/api/` (no version segment) are considered legacy. They remain operational
but carry `Deprecation: true` headers and will be sunset on 2027-01-01.

Migration guidance: update client base URLs from `/api/` to `/api/v1/`.
