-- ============================================================
-- AI Compliance Copilot — PostgreSQL Extension Initialization
-- ============================================================
-- This script runs automatically via docker-entrypoint-initdb.d
-- when the Postgres container is created for the first time.
--
-- IMPORTANT: Only contains statements that are safe to run
-- BEFORE Prisma creates tables (no ALTER TABLE, no table-level
-- operations). Full setup including FTS columns, SSO table,
-- and retention fields is in setup.sql and should be run
-- AFTER prisma migrate deploy.
-- ============================================================

-- pgvector extension (required for semantic search / P20)
CREATE EXTENSION IF NOT EXISTS vector;

-- pg_trgm for fuzzy text search (optional, used by some LIKE queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- uuid-ossp for gen_random_uuid() fallback (built-in in PG 13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
