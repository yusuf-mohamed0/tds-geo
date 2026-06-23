-- Migration: Add shopify_oauth_states table for OAuth flow (non-embedded)
-- Created: 2026-06-21
-- Context: Shopify one-click install flow stores temporary state tokens

CREATE TABLE IF NOT EXISTS shopify_oauth_states (
  state       TEXT PRIMARY KEY,
  shop        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup: expired states after 10 minutes
CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_created_at
  ON shopify_oauth_states (created_at);
