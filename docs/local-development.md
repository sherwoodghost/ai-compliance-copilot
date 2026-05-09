# Local Development Guide

## Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL + Redis)
- npm 10+

---

## 1. Start Infrastructure

```bash
# Start PostgreSQL (with pgvector) and Redis
docker compose up postgres redis -d

# Verify services are healthy
docker compose ps
```

The `postgres` service uses `pgvector/pgvector:pg16` which includes the `vector` extension pre-installed.

---

## 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, and other secrets

# Generate Prisma client
npx prisma generate

# Run Prisma migrations (creates all tables)
npx prisma migrate dev

# Apply supplemental SQL (pgvector extension, FTS index, SSO table, retention columns)
# This is safe to re-run — all statements use IF NOT EXISTS
psql "$DATABASE_URL" -f ../setup.sql

# Seed the database (frameworks, controls, demo org, demo users)
npm run prisma:seed

# Start the backend in watch mode
npm run start:dev
```

Backend runs at: http://localhost:3001/api/v1

Swagger docs: http://localhost:3001/api/v1/docs

---

## 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Start the frontend
npm run dev
```

Frontend runs at: http://localhost:3000

---

## 4. Running Workers

BullMQ workers start automatically with the backend (`npm run start:dev`). Each agent processor is registered via the `OrchestratorModule`. Workers connect to Redis using `REDIS_HOST` and `REDIS_PORT`.

---

## 5. Running Tests

```bash
cd backend

# Unit tests (no DB/Redis required)
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:cov

# CI mode (non-interactive, fail fast)
npm run test:ci

# TypeScript typecheck only
npm run typecheck
```

---

## 6. Mock Mode (no API keys)

For local development without real LLM or embeddings API keys:

```env
# In backend/.env
ENABLE_MOCK_LLM=true
ENABLE_MOCK_EMBEDDINGS=true
ENABLE_RAG_IN_MEMORY_FALLBACK=true
```

Mock mode uses deterministic responses so tests are reproducible.

---

## 7. Triggering a Full Assessment

After seeding, use the API to trigger an assessment:

```bash
# First, get a JWT token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.com", "password": "Demo1234!"}'

# Trigger full assessment (admin role required)
curl -X POST http://localhost:3001/api/v1/orchestrator/assess \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"frameworkIds": ["<SOC2_FRAMEWORK_ID>"]}'
```

Pipeline runs: scoping → control-mapper → planner → ... → audit → dashboard

---

## Troubleshooting

### pgvector not available
```
RagService: pgvector extension not available — falling back to in-memory similarity
```
Fix: Run `CREATE EXTENSION IF NOT EXISTS vector;` in the PostgreSQL container (step 2 above), or set `ENABLE_RAG_IN_MEMORY_FALLBACK=true`.

### Redis connection refused
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
Fix: Ensure `docker compose up redis -d` is running. Check `REDIS_HOST=localhost` and `REDIS_PORT=6379` in `.env`.

### Prisma P1001 — can't reach database
```
Error: P1001: Can't reach database server at localhost:5432
```
Fix: Ensure `docker compose up postgres -d` is running. Check `DATABASE_URL` in `.env`.

### Prisma client out of date
After any schema change: `npx prisma generate` then restart the backend.
