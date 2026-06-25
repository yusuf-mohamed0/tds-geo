-- ══════════════════════════════════════════════
-- Migration: Shopify OAuth Sessions
-- Adds shopify_sessions table to store OAuth tokens
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shopify_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop              VARCHAR(255) NOT NULL,
  access_token      VARCHAR(255) NOT NULL,
  scopes            TEXT NOT NULL,
  installed_at      TIMESTAMPTZ DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ DEFAULT NOW(),
  is_active         BOOLEAN DEFAULT true,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopify_sessions_shop ON shopify_sessions(shop);
CREATE INDEX IF NOT EXISTS idx_shopify_sessions_active ON shopify_sessions(is_active);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_shopify_sessions_updated_at ON shopify_sessions;
CREATE TRIGGER trg_shopify_sessions_updated_at
  BEFORE UPDATE ON shopify_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
