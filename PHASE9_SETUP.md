# Phase 9 — Startup Guide

## 1. Start the stack

```bash
docker compose up -d
```

> Uses `pgvector/pgvector:pg16` image — pgvector is pre-installed.

## 2. Run the Prisma migration

```bash
cd backend
npx prisma migrate dev --name phase-9-compliance-platform
```

This creates all Phase 9 tables:
- `control_domains`, `control_library_meta`, `control_evidence_requirements`, `control_policy_requirements`
- `framework_crosswalks`, `control_applicability`
- `soc2_scopes`, `iso27001_scopes`, `iso_statement_of_applicability`
- `prompt_templates` (DB mirror — registry is in-memory)
- `llm_calls`, `llm_retrieval_sources`, `llm_eval_results`
- `readiness_scores`, `dashboard_configs`, `audit_exports`
- `vector_embeddings`, `risk_treatments`

## 3. Enable pgvector (run once after migration)

```bash
# Connect to your postgres container and run:
docker exec -it $(docker ps -q --filter name=postgres) \
  psql -U compliance -d compliance_db \
  -f /dev/stdin << 'EOF'
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE vector_embeddings ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);
CREATE INDEX IF NOT EXISTS vec_emb_ivfflat_idx
  ON vector_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
EOF
```

Or run the file: `backend/prisma/migrations/pgvector_setup.sql`

> **If pgvector is not available**, the RAG system automatically falls back to in-memory cosine similarity. The app fully works without it — you'll just see a warning in the logs.

## 4. Start the backend

```bash
cd backend
npm run start:dev
```

On startup, the backend will:
- Seed the Control Library (SOC2 CC1-CC9 + ISO 27001 A.5-A.8 domains and controls)
- Seed ~40 SOC2↔ISO27001 framework crosswalks
- Load all 17 versioned prompt templates into the registry
- Index the control library into the RAG vector store (background, non-blocking)

## 5. Start the frontend

```bash
cd frontend
npm run dev
```

## New Pages

| Route | Description |
|-------|-------------|
| `/control-library` | Browse all SOC2 + ISO27001 controls with search and filter |
| `/scope` | SOC2 scope + ISO Statement of Applicability |
| `/readiness` | Deterministic readiness score breakdown with history |
| `/audit-exports` | Generate SOC2 readiness reports, ISO SoA, control matrix |
| `/llm-gateway` | LLM call audit log, prompt registry, eval harness |

## New API Routes

```
GET  /api/v1/controls/library
GET  /api/v1/controls/library/:framework
GET  /api/v1/controls/applicability
PATCH /api/v1/controls/applicability/:id

GET  /api/v1/scoping/soc2/current
POST /api/v1/scoping/soc2/generate
PATCH /api/v1/scoping/soc2/:id/approve
GET  /api/v1/scoping/iso/soa
POST /api/v1/scoping/iso/soa/generate

GET  /api/v1/readiness/breakdown
GET  /api/v1/readiness/history
POST /api/v1/readiness/recalculate

POST /api/v1/audit-exports/soc2-readiness
POST /api/v1/audit-exports/iso-soa
POST /api/v1/audit-exports/control-matrix
GET  /api/v1/audit-exports

GET  /api/v1/llm/calls
GET  /api/v1/llm/prompts
GET  /api/v1/llm/stats
GET  /api/v1/llm/evals
POST /api/v1/llm/evals/run
```
