# API Changelog

This file documents breaking changes per API version, required for SOC 2 CC8.1 change management.

---

## v1.3 — P23 (SSO / SAML)

Released: 2026-05-09. **No breaking changes.** Additive endpoints only.

### New endpoints (P23 — SAML 2.0 Single Sign-On)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/v1/auth/sso/:orgSlug/metadata` | Public | SP metadata XML (give this URL to your IdP) |
| GET    | `/api/v1/auth/sso/:orgSlug` | Public | Initiate SAML login (redirect to IdP) |
| POST   | `/api/v1/auth/sso/:orgSlug/callback` | Public | ACS endpoint — IdP posts SAML response here |
| GET    | `/api/v1/auth/sso/config` | JWT | Get org SSO configuration |
| POST   | `/api/v1/auth/sso/config` | JWT | Create / update SSO configuration |
| POST   | `/api/v1/auth/sso/test` | JWT | Test IdP reachability and mark config verified |
| PATCH  | `/api/v1/auth/sso/toggle` | JWT | Enable or disable SSO for the org |

**SSO callback behaviour:** On successful SAML assertion, redirects to `{FRONTEND_URL}/auth/sso-callback?accessToken=...&refreshToken=...`. On failure, redirects to `{FRONTEND_URL}/auth/sso-callback?error=...`.

**JIT provisioning:** New users are automatically created with `role=member, platformRole=contributor, status=active` on first SSO login. Existing suspended/deactivated users are rejected.

---

## v1.2 — P22 (Collaborative Editing)

Released: 2026-05-08. **No breaking changes.**

### New infrastructure (P22 — Yjs / Hocuspocus)

- Hocuspocus WebSocket server started alongside NestJS when `COLLABORATION_ENABLED=true`
- Listens on port `COLLABORATION_PORT` (default 1234)
- Authentication: same JWT as HTTP API (`Bearer` token passed as Hocuspocus `token` param)
- Document rooms keyed as `doc:{documentId}`
- Yjs state persisted to `documents.yjs_state` (debounced 3s)
- Feature-gated: `documents.collaborativeEdit` flag must be enabled for org

**No new HTTP endpoints** — the collaboration channel is WebSocket only.

---

## v1.1 — P20/P21 (Semantic Search)

Released: 2026-05-07. **No breaking changes.** Query parameter addition only.

### Changed endpoints (P20 — Semantic Search)

| Method | Path | Change |
|--------|------|--------|
| GET    | `/api/v1/documents` | Added optional `semanticSearch` query param; returns `{ total, page, pageSize, items, searchMode }` when used. Falls back to FTS if pgvector unavailable. |

#### New endpoint
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST   | `/api/v1/documents/reindex-embeddings` | JWT (admin) | Re-index all org documents for semantic search |

**Response shape change for `GET /documents`:** When `semanticSearch` is provided, the response is `{ total, page, pageSize, items, searchMode: 'semantic' | 'fts' | 'ilike' }` instead of a plain array. Plain-array response is still returned when no search params are used (backward compatible).

---

## v1.0 — P19 (Documents + Enterprise Infrastructure)

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

#### Approval Workflows (E7)
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/approval-workflows/definitions` | List workflow definitions (filter by entityType) |
| POST   | `/api/v1/approval-workflows/definitions` | Create workflow definition |
| POST   | `/api/v1/approval-workflows/start` | Start workflow instance for entity |
| POST   | `/api/v1/approval-workflows/instances/:id/advance` | Approve / reject / review a step |
| POST   | `/api/v1/approval-workflows/instances/:id/cancel` | Cancel active workflow |
| GET    | `/api/v1/approval-workflows/history` | Workflow history for an entity |

#### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/notifications` | List in-app notifications (unread first) |
| POST   | `/api/v1/notifications/:id/read` | Mark notification as read |
| POST   | `/api/v1/notifications/read-all` | Mark all notifications read |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/health` | DB + Redis + uptime health check (per-component latency) |

#### Background Document Jobs
| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/v1/documents/jobs/pdf-import` | Enqueue PDF import job (returns 202 + jobId) |
| POST   | `/api/v1/documents/jobs/ai-gaps` | Enqueue async gap analysis job |
| POST   | `/api/v1/documents/jobs/bulk-export` | Enqueue bulk export job (tenant-validated) |

#### Retention Settings
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/v1/organizations/me/retention-settings` | Get document + evidence retention days |
| PATCH  | `/api/v1/organizations/me/retention-settings` | Update retention days (admin only) |

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
