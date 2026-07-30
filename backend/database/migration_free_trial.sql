-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- ──────────────────────────────────────────────
-- Migration: Free Trial / Demo Mode
-- Adds demo trial columns and demo_limits table
-- ──────────────────────────────────────────────

-- ─── Clients: add demo columns ───────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_is_demo ON clients(is_demo);
CREATE INDEX IF NOT EXISTS idx_clients_trial_ends_at ON clients(trial_ends_at);

-- ─── Demo signups ───────────────────────────
CREATE TABLE IF NOT EXISTS demo_signups (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  company           VARCHAR(255),
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'converted', 'expired')),
  converted_at      TIMESTAMPTZ,
  ip_address        VARCHAR(45),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_signups_email ON demo_signups(email);
CREATE INDEX IF NOT EXISTS idx_demo_signups_status ON demo_signups(status);
