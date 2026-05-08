-- Add Yjs binary state column to documents for collaborative editing (P22)
-- Run AFTER the main database is set up.
--
-- Usage:
--   psql -U postgres -d compliance_db -f yjs_state_migration.sql
-- OR via docker:
--   docker exec -it <postgres-container> psql -U postgres -d compliance_db -f /yjs_state_migration.sql

-- Add yjsState column (nullable TEXT to store base64-encoded Yjs binary state)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS yjs_state TEXT;

-- Optional: index for cleanup jobs (find docs with stale Yjs state)
CREATE INDEX IF NOT EXISTS documents_yjs_updated_idx
  ON documents (updated_at)
  WHERE yjs_state IS NOT NULL;

-- Done. The Hocuspocus server will use this column for persistence.
