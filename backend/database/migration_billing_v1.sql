-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS shopify_subscription_id VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS shopify_charge_id BIGINT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_plan VARCHAR(50) DEFAULT 'starter';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'pending'
  CHECK (billing_status IN ('pending', 'active', 'cancelled', 'declined'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_activated_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS shopify_refresh_token VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS shopify_token_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS billing_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE,
  event_type    VARCHAR(50) NOT NULL,
  plan          VARCHAR(50),
  charge_id     BIGINT,
  subscription_id VARCHAR(255),
  amount        DECIMAL(10,2),
  status        VARCHAR(20),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_client ON billing_events(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at DESC);
