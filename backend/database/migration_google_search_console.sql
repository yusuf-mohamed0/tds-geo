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

-- Ensure UNIQUE on client_id for ON CONFLICT upsert (for existing tables)
ALTER TABLE gsc_auth ADD CONSTRAINT IF NOT EXISTS gsc_auth_client_id_key UNIQUE (client_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_gsc_auth_updated_at ON gsc_auth;
CREATE TRIGGER trg_gsc_auth_updated_at
  BEFORE UPDATE ON gsc_auth FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── GSC Sites ─────────────────────────────
CREATE TABLE IF NOT EXISTS gsc_sites (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  site_url          VARCHAR(500) NOT NULL,
  permission_level  VARCHAR(50),
  is_active         BOOLEAN DEFAULT true,
  last_sync_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, site_url)
);

CREATE INDEX IF NOT EXISTS idx_gsc_sites_client_id ON gsc_sites(client_id);
CREATE INDEX IF NOT EXISTS idx_gsc_sites_is_active ON gsc_sites(is_active);

-- ─── GSC Queries ───────────────────────────
CREATE TABLE IF NOT EXISTS gsc_queries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  site_url          VARCHAR(500) NOT NULL,
  query             TEXT NOT NULL,
  date              DATE NOT NULL,
  impressions       INTEGER DEFAULT 0,
  clicks            INTEGER DEFAULT 0,
  ctr               DECIMAL(5,4) DEFAULT 0,
  avg_position      DECIMAL(5,1) DEFAULT 0,
  page              VARCHAR(1000),
  country           VARCHAR(10),
  device            VARCHAR(20),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_url, query, date, page, country, device)
);

CREATE INDEX IF NOT EXISTS idx_gsc_queries_client_id_date ON gsc_queries(client_id, date);
CREATE INDEX IF NOT EXISTS idx_gsc_queries_site_url_date ON gsc_queries(site_url, date);
CREATE INDEX IF NOT EXISTS idx_gsc_queries_client_id_site_url ON gsc_queries(client_id, site_url);

-- ─── GSC OAuth State (one-time CSRF tokens) ──
CREATE TABLE IF NOT EXISTS gsc_states (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state             VARCHAR(255) NOT NULL,
  client_id         UUID NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsc_states_state ON gsc_states(state);
CREATE INDEX IF NOT EXISTS idx_gsc_states_expires_at ON gsc_states(expires_at);
