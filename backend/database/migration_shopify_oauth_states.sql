-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- Migration: Shopify OAuth States
-- Stores one-time OAuth `state` tokens issued during the
-- Shopify install flow (GET /api/shopify/install) so the
-- callback (GET /api/shopify/callback) can validate and
-- consume them before exchanging the authorization code.
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shopify_oauth_states (
  id          SERIAL PRIMARY KEY,
  state       VARCHAR(64) NOT NULL UNIQUE,
  shop        VARCHAR(255) NOT NULL,
  nonce       TEXT,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_shop ON shopify_oauth_states(shop);
CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_created_at ON shopify_oauth_states(created_at);
