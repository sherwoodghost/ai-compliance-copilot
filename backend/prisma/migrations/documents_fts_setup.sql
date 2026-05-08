-- Document Full-Text Search Setup (E1 — Search & Indexing Layer)
-- Run this AFTER the main `prisma migrate dev`
--
-- Usage:
--   docker exec -it <postgres-container> psql -U postgres -d ai_compliance_copilot \
--     -f /documents_fts_setup.sql
-- OR connect to your database and paste these commands directly.

-- 1. Add a generated tsvector column (stored, auto-updated by Postgres on every row change)
--    Weights: title=A (highest), content_text=B, tags=C
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')),                     'A') ||
      setweight(to_tsvector('english', coalesce(content_text, '')),              'B') ||
      setweight(to_tsvector('english', array_to_string(tags, ' ', '')),          'C')
    ) STORED;

-- 2. Create a GIN index for sub-millisecond full-text lookup
CREATE INDEX IF NOT EXISTS documents_search_gin
  ON documents USING GIN(search_vector);

-- 3. (Optional) Stub embedding column for future pgvector semantic search in P22
--    Nullable; populated by a background job when pgvector semantic indexing is added.
-- ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_vector FLOAT[];

-- Done. The DocumentsService will automatically use this for ?search= queries.
