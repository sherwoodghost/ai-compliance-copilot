# AI Compliance Copilot

An AI-powered compliance readiness platform that guides organizations through SOC 2 and ISO 27001 certification. Built for security teams who need audit-ready documentation, automated evidence collection, and enterprise-grade access controls.

## What It Does

The platform automates the most tedious parts of compliance:

- **Onboarding**: Conversational AI extracts your tech stack, data flows, and compliance goals
- **Gap Analysis**: Deterministic control applicability engine maps your profile to 58 controls across SOC 2 and ISO 27001
- **Rich Document Editor**: TipTap-based policy editor with compliance-specific nodes (`<control-ref>`, `<responsibility>`, `<template-var>`), DOCX/PDF/Markdown import, and PDF export
- **Semantic Search**: pgvector-powered document search with HNSW index and full-text fallback
- **Collaborative Editing**: Real-time multi-user editing via Yjs + Hocuspocus WebSocket server
- **Policy Generation**: LLM generates audit-ready policy documents — never certifying, always grounded in your control library
- **Evidence Collection**: Integrations with AWS, GitHub, Okta, and Datadog pull live evidence automatically
- **Risk Register**: Automated risk identification with treatment workflow and human approval gates
- **Readiness Scoring**: Pure-math scoring engine (no LLM) tracks your progress across five control categories
- **Audit Exports**: SOC 2 readiness reports, ISO Statement of Applicability, and evidence binders
- **SSO / SAML 2.0**: Enterprise single sign-on with JIT user provisioning, IdP metadata XML, and ACS endpoint
- **Feature Flags**: DB-backed per-org feature gating with Redis caching and percentage rollouts

## Architecture

```
Browser (Next.js 14)
       │
       │ REST + WebSocket
       ▼
NestJS API (Port 3001)
       │
   ┌───┴──────────────────────────────────────────────┐
   │                                                  │
   ▼                                ▼                 ▼
PostgreSQL + pgvector          Redis (BullMQ)    Hocuspocus
  25+ tables                   Background          WS :1234
  Vector embeddings             workers           (collab)
  Full-text search (tsvector)
       │
       ▼
Anthropic Claude API
  (through Compliance-Aware LLM Gateway)
```

**Key architectural constraints:**
- All LLM calls flow through the Compliance-Aware LLM Gateway — never raw model calls
- Every prompt is versioned in the Prompt Registry — no inline prompts in agents
- Readiness scores are pure deterministic formulas — LLMs never generate scores
- All DB queries filter by `orgId` — strict tenant isolation
- Forbidden language detector blocks "certified", "guaranteed compliance", etc.
- SAML assertions validated via `@node-saml/node-saml` — no static cert required at startup

## Quick Start

```bash
# 1. Start all services (Postgres, Redis, backend, frontend)
docker compose up -d

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Run database migrations and seed demo data
cd backend
npx prisma migrate deploy
npm run prisma:seed

# 4. Apply supplemental SQL (pgvector, full-text search, SSO table, etc.)
psql $DATABASE_URL < setup.sql

# 5. Start development servers
# Backend (port 3001):
npm run start:dev

# Frontend (port 3000):
cd ../frontend && npm run dev
```

**Demo credentials** (created by seed):

| Email | Password | Role |
|-------|----------|------|
| `admin@demo.com` | `Demo1234!` | Admin |
| `security@demo.com` | `Demo1234!` | Auditor |
| `contributor@demo.com` | `Demo1234!` | Member |

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set the required variables.

Minimum required:
```
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=<random 64 chars>
JWT_REFRESH_SECRET=<random 64 chars>
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
```

For full feature set add:
```
OPENROUTER_API_KEY=sk-or-v1-...   # AI features (improve, gap detection, PDF import)
APP_URL=http://localhost:3001      # Used in SAML SP metadata URLs
COLLABORATION_ENABLED=true         # Enables Hocuspocus WS server on port 1234
```

See `backend/.env.example` for the complete list with descriptions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript, BullMQ, Prisma ORM |
| **Frontend** | Next.js 14 (App Router), React Query, Zustand, Tailwind CSS |
| **Editor** | TipTap (ProseMirror) — rich compliance document editor |
| **Database** | PostgreSQL 15 + pgvector extension |
| **Queue** | Redis 7 + BullMQ |
| **Collaboration** | Yjs + Hocuspocus WebSocket server |
| **AI** | Anthropic Claude (claude-sonnet-4-6 / claude-haiku-3) via OpenRouter |
| **Auth** | JWT (access + refresh tokens) + SAML 2.0 SSO |

## Key Features by Phase

| Phase | Features |
|-------|---------|
| P1–P9 | Schema migrations, ABAC permissions, SoD enforcement, audit log, team management, RACI matrix, access reviews, policy templates, guided tasks, 80+ hardening tests |
| P10–P18 | Incident management, notification hub, internal audit, vendor risk, trust center |
| P19 | Rich document editor (TipTap), Documents module with version control, legal hold, DOCX/PDF import, AI improve/gap detection, BullMQ async jobs, feature flags, connector architecture |
| P20/P21 | Semantic search (pgvector HNSW), document embeddings, Google Drive connector stub |
| P22 | Collaborative editing (Yjs + Hocuspocus), real-time multi-user document editing |
| P23 | SAML 2.0 SSO with JIT provisioning, SP metadata, ACS endpoint, Settings Security tab |

## API Reference

Swagger UI: [`http://localhost:3001/api/v1/docs`](http://localhost:3001/api/v1/docs)

Base URL: `http://localhost:3001/api/v1`

See [`backend/API_CHANGELOG.md`](backend/API_CHANGELOG.md) for versioned change history (SOC 2 CC8.1).

## SSO Setup

1. Go to **Settings → Security** in the app
2. Enter your IdP's SSO URL and Entity ID
3. Paste your IdP's X.509 certificate
4. Copy the **ACS URL** and **SP Entity ID** from the read-only fields into your IdP
5. Click **Test connection** to verify the IdP is reachable
6. Enable SSO with the toggle

Your IdP should POST the SAML assertion to:
```
POST /api/v1/auth/sso/{orgSlug}/callback
```

SP metadata XML is available at:
```
GET /api/v1/auth/sso/{orgSlug}/metadata
```

JIT provisioning creates new users on first SSO login with `role=member, platformRole=contributor`.

## Collaborative Editing Setup

Set `COLLABORATION_ENABLED=true` and optionally `COLLABORATION_PORT=1234` (default).

The Hocuspocus server starts alongside the NestJS app and accepts JWT-authenticated WebSocket connections. Documents with `collaborativeEdit` feature flag enabled use Yjs CRDT for conflict-free real-time editing.

## Documentation

| Doc | Contents |
|-----|---------|
| [`docs/local-development.md`](docs/local-development.md) | Detailed setup, env vars, troubleshooting |
| [`docs/compliance-architecture.md`](docs/compliance-architecture.md) | Full system architecture, DB schema, data flow |
| [`docs/llm-gateway.md`](docs/llm-gateway.md) | LLM Gateway design, prompt registry, forbidden language |
| [`docs/rag-system.md`](docs/rag-system.md) | Vector search, tenant isolation, retrieval logging |
| [`docs/agent-runtime-contract.md`](docs/agent-runtime-contract.md) | Agent rules, execution context, 18-stage pipeline |
| [`docs/agent-duty-matrix.md`](docs/agent-duty-matrix.md) | Per-agent responsibilities, LLM usage, human checkpoints |
| [`docs/eval-harness.md`](docs/eval-harness.md) | Golden datasets, CI eval gates, adding test cases |
| [`docs/runbook.md`](docs/runbook.md) | Operations runbook, incident procedures, monitoring |
| [`backend/API_CHANGELOG.md`](backend/API_CHANGELOG.md) | API version history (SOC 2 change management) |

## Hosting / Deployment

### Run locally (Docker Compose)

Prereqs: Docker Desktop.

```bash
docker compose up --build
```

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:3001/api/v1`
- **Swagger** (non-prod): `http://localhost:3001/api/v1/docs`
- **Hocuspocus** (if enabled): `ws://localhost:1234`

The backend container runs on startup:

- `prisma migrate deploy`
- `prisma db seed` (idempotent demo data)

### Production hosting options

#### Option A: Deploy as containers (Render / Fly.io / Railway / any VPS)

- **Frontend**: build `frontend/Dockerfile` with build args:
  - `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api/v1`
  - `NEXT_PUBLIC_WS_URL=https://<your-backend-domain>`
  - `NEXT_PUBLIC_COLLABORATION_URL=wss://<your-backend-domain>` (if collaboration enabled)
- **Backend**: deploy `backend/Dockerfile` and set environment variables (at minimum: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `APP_URL`).
- Use managed **Postgres** and **Redis** from your provider (recommended).
- Run `setup.sql` against your Postgres instance after the first deploy.

#### Option B: Vercel (frontend) + managed container (backend)

- Deploy `frontend/` to Vercel.
  - Set Vercel env var **at build time**: `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api/v1`
- Deploy `backend/` to a container host (Render/Fly/Railway/etc) with the backend env vars.
