-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- Migration: Google Search Console Integration
-- Adds GSC OAuth auth, site connections, and
-- daily search query data tables.
-- ══════════════════════════════════════════════

-- ─── GSC Auth ──────────────────────────────
CREATE TABLE IF NOT EXISTS gsc_auth (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  email             VARCHAR(255),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsc_auth_client_id ON gsc_auth(client_id);

-- Ensure UNIQUE on client_id for ON CONFLICT upsert (for existing tables).
-- Inline UNIQUE on client_id in CREATE TABLE already yields gsc_auth_client_id_key;
-- this only adds it if absent (PG has no ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gsc_auth_client_id_key'
  ) THEN
    ALTER TABLE gsc_auth ADD CONSTRAINT gsc_auth_client_id_key UNIQUE (client_id);
  END IF;
END
$$;


