-- AI enrichment columns for ControlApplicability
-- Adds company-specific notes, implementation context, AI priority, confidence,
-- assessment timestamp, model used, and AI-generated rationale.
--
-- Run with:
--   docker exec -it <postgres-container> psql -U postgres -d ai_compliance_copilot \
--     -f /control_applicability_ai_enrichment.sql
-- OR connect to your database and paste these commands.
--
-- All columns are nullable — existing rows are unaffected.

ALTER TABLE control_applicability
  ADD COLUMN IF NOT EXISTS company_specific_notes  TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_rationale  TEXT,
  ADD COLUMN IF NOT EXISTS implementation_context  TEXT,
  ADD COLUMN IF NOT EXISTS ai_priority             TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence           INTEGER,
  ADD COLUMN IF NOT EXISTS ai_assessed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_model_used           TEXT;

-- Optional: add check constraint so ai_priority only accepts known values
ALTER TABLE control_applicability
  DROP CONSTRAINT IF EXISTS chk_ai_priority;

ALTER TABLE control_applicability
  ADD CONSTRAINT chk_ai_priority
    CHECK (ai_priority IS NULL OR ai_priority IN ('critical', 'high', 'medium', 'low'));

-- Optional: constrain ai_confidence to 0-100
ALTER TABLE control_applicability
  DROP CONSTRAINT IF EXISTS chk_ai_confidence;

ALTER TABLE control_applicability
  ADD CONSTRAINT chk_ai_confidence
    CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100));

-- Done. The ApplicabilityReviewerService will populate these columns
-- after the ControlMapperAgent runs the deterministic applicability pass.
