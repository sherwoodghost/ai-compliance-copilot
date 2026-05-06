## Hosting / Deployment

This repo is a **Next.js (frontend)** + **NestJS (backend)** monorepo. The backend uses **PostgreSQL** (via Prisma; local Compose uses `pgvector/pgvector`) and **Redis** (Bull queue).

### Run locally (Docker Compose)

Prereqs: Docker Desktop.

```bash
docker compose up --build
```

- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:3001/api/v1`
- **Swagger** (non-prod): `http://localhost:3001/api/v1/docs`

The backend container runs on startup:

- `prisma migrate deploy`
- `prisma db seed` (idempotent demo data)

### Production hosting options

#### Option A: Deploy as containers (Render / Fly.io / Railway / any VPS)

- **Frontend**: build `frontend/Dockerfile` with build args:
  - `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api/v1`
  - `NEXT_PUBLIC_WS_URL=https://<your-backend-domain>`
- **Backend**: deploy `backend/Dockerfile` and set environment variables (at minimum: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`).
- Use managed **Postgres** and **Redis** from your provider (recommended).

#### Option B: Vercel (frontend) + managed container (backend)

- Deploy `frontend/` to Vercel.
  - Set Vercel env var **at build time**: `NEXT_PUBLIC_API_URL=https://<your-backend-domain>/api/v1`
- Deploy `backend/` to a container host (Render/Fly/Railway/etc) with the backend env vars.

### Required environment variables (backend)

- **DATABASE_URL**: Postgres connection string
- **JWT_ACCESS_SECRET** and **JWT_REFRESH_SECRET**
- **FRONTEND_URL**: the public frontend URL for CORS
- **REDIS_HOST** / **REDIS_PORT** (or adapt to your provider)

See `.env.example` for the full list.
# AI Compliance Copilot

An AI-powered compliance readiness platform that guides organizations through SOC 2 and ISO 27001 certification.

## What It Does

The platform automates the most tedious parts of compliance:

- **Onboarding**: Conversational AI extracts your tech stack, data flows, and compliance goals
- **Gap Analysis**: Deterministic control applicability engine maps your profile to 58 controls across SOC 2 and ISO 27001
- **Policy Generation**: LLM generates audit-ready policy documents — never certifying, always grounded in your control library
- **Evidence Collection**: Integrations with AWS, GitHub, Okta, and Datadog pull live evidence automatically
- **Risk Register**: Automated risk identification with treatment workflow and human approval gates
- **Readiness Scoring**: Pure-math scoring engine (no LLM) tracks your progress across five control categories
- **Audit Exports**: SOC 2 readiness reports, ISO Statement of Applicability, and evidence binders

## Architecture

```
Browser (Next.js 14)
       │
       │ REST + WebSocket
       ▼
NestJS API (Port 3001)
       │
   ┌───┴──────────────────────────────────┐
   │                                      │
   ▼                                      ▼
PostgreSQL + pgvector              Redis (BullMQ)
  25 tables                        18-stage pipeline
  Vector embeddings                Background workers
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

# 4. Start development servers
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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript, BullMQ, Prisma ORM |
| **Frontend** | Next.js 14 (App Router), React Query, Zustand, Tailwind CSS |
| **Database** | PostgreSQL 15 + pgvector extension |
| **Queue** | Redis 7 + BullMQ |
| **AI** | Anthropic Claude (claude-sonnet-4-6 / claude-haiku-3) |
| **Auth** | JWT (access + refresh tokens) |

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

## API Reference

Swagger UI is available at [`http://localhost:3001/api/v1/docs`](http://localhost:3001/api/v1/docs) when the backend is running.

Base URL: `http://localhost:3001/api/v1`
