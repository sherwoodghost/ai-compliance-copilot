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

-- Done. The RagService will automatically detect pgvector and use it.
