-- SSO/SAML Configuration Migration (P23)
-- Run AFTER the main database is set up.

-- 1. Add sso_enabled column to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create sso_configs table
CREATE TABLE IF NOT EXISTS sso_configs (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID         NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  provider            VARCHAR(50)  NOT NULL DEFAULT 'saml',
  sp_entity_id        TEXT,
  acs_url             TEXT,
  idp_entity_id       TEXT,
  idp_sso_url         TEXT,
  idp_certificate     TEXT,
  email_attribute     VARCHAR(255) NOT NULL DEFAULT 'email',
  first_name_attribute VARCHAR(255) NOT NULL DEFAULT 'firstName',
  last_name_attribute VARCHAR(255) NOT NULL DEFAULT 'lastName',
  is_verified         BOOLEAN      NOT NULL DEFAULT FALSE,
  last_tested_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sso_configs_org_id_idx ON sso_configs(org_id);

-- Done.
