-- pgvector setup — run this AFTER the main prisma migrate dev
-- Required: PostgreSQL with pgvector extension (Postgres 15+ with pgvector installed)
--
-- Run with:
--   docker exec -it <postgres-container> psql -U postgres -d ai_compliance_copilot -f /pgvector_setup.sql
-- OR connect to your database and paste these commands:

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the embedding column to vector_embeddings (Prisma can't manage VECTOR type)
ALTER TABLE vector_embeddings
  ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- 3. Create IVFFlat index for approximate nearest-neighbor search
--    (Run this AFTER you have at least 1000 rows for best performance)
CREATE INDEX IF NOT EXISTS vector_embeddings_embedding_idx
  ON vector_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Create a partial index for global (control library) chunks
CREATE INDEX IF NOT EXISTS vector_embeddings_global_idx
  ON vector_embeddings (source_type, chunk_index)
  WHERE org_id IS NULL;

-- 5. Unique constraint for upsert support (org_id, source_type, source_id, chunk_index)
--    Allows ON CONFLICT DO UPDATE for idempotent embedding indexing.
--    org_id can be NULL for global embeddings; use NULLS NOT DISTINCT for pg15+ or a coalesce workaround.
ALTER TABLE vector_embeddings
  DROP CONSTRAINT IF EXISTS vector_embeddings_source_uq;

CREATE UNIQUE INDEX IF NOT EXISTS vector_embeddings_source_uq
  ON vector_embeddings (coalesce(org_id, ''), source_type, coalesce(source_id, ''), chunk_index);

-- Done. The DocumentsService will use this for semantic document search.
-- The RagService will automatically detect pgvector and use it for RAG queries.
