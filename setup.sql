-- ============================================================
-- AI Compliance Copilot — Full Database Setup Script
-- ============================================================
-- Run this once after `prisma migrate deploy` to apply all
-- supplemental migrations that Prisma can't manage directly
-- (pgvector extension, generated columns, etc.).
--
-- Usage:
--   psql $DATABASE_URL -f setup.sql
--
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================


-- ── Step 1: pgvector extension (P20) ──────────────────────────────────────────
-- Requires: pgvector/pgvector:pg16 Docker image OR Supabase / Neon / Railway
--           with pgvector enabled.
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Step 2: Vector embeddings table (P20) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID,
  source_type  VARCHAR(50) NOT NULL,   -- 'document' | 'evidence' | 'policy'
  source_id    UUID,
  chunk_index  INT         NOT NULL DEFAULT 0,
  content_hash VARCHAR(64),            -- SHA-256 of chunk text; skip re-embed if unchanged
  embedding    vector(1536),           -- text-embedding-3-small dimensions
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS vector_embeddings_source_uq
  ON vector_embeddings (
    coalesce(org_id::text, ''),
    source_type,
    coalesce(source_id::text, ''),
    chunk_index
  );

-- HNSW index for fast approximate nearest-neighbour search (cosine distance)
CREATE INDEX IF NOT EXISTS vector_embeddings_embedding_hnsw
  ON vector_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS vector_embeddings_org_source_idx
  ON vector_embeddings (org_id, source_type, source_id);


-- ── Step 3: Full-text search on documents (P19 E1) ────────────────────────────
-- Adds a generated tsvector column for ranked FTS on title + body + tags.
-- First ensure the column exists (prisma migrate adds base columns but not generated).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE documents
      ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(content_text, '')), 'B') ||
          setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
        ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documents_search_gin
  ON documents USING GIN (search_vector);


-- ── Step 4: Yjs collaborative state column (P22) ──────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS yjs_state TEXT;

CREATE INDEX IF NOT EXISTS documents_yjs_updated_idx
  ON documents (updated_at)
  WHERE yjs_state IS NOT NULL;


-- ── Step 5: SSO configuration table (P23) ─────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sso_configs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID         NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  provider             VARCHAR(50)  NOT NULL DEFAULT 'saml',
  sp_entity_id         TEXT,
  acs_url              TEXT,
  idp_entity_id        TEXT,
  idp_sso_url          TEXT,
  idp_certificate      TEXT,
  email_attribute      VARCHAR(255) NOT NULL DEFAULT 'email',
  first_name_attribute VARCHAR(255) NOT NULL DEFAULT 'firstName',
  last_name_attribute  VARCHAR(255) NOT NULL DEFAULT 'lastName',
  is_verified          BOOLEAN      NOT NULL DEFAULT FALSE,
  last_tested_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sso_configs_org_id_idx ON sso_configs (org_id);


-- ── Step 6: AI token budget columns on organizations (P19 E6) ─────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_token_budget_monthly INT NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS ai_tokens_used_month    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_tokens_reset_at      TIMESTAMPTZ;


-- ── Step 7: Document retention + legal hold columns (P19 E9) ─────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS retention_days    INT,
  ADD COLUMN IF NOT EXISTS retain_until      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_hold_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_hold_by     UUID,
  ADD COLUMN IF NOT EXISTS legal_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS purged_at         TIMESTAMPTZ;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS document_retention_days INT NOT NULL DEFAULT 2555,
  ADD COLUMN IF NOT EXISTS evidence_retention_days INT NOT NULL DEFAULT 2555;


-- ── Done ──────────────────────────────────────────────────────────────────────
SELECT 'setup.sql complete — all extensions and supplemental migrations applied.' AS status;
