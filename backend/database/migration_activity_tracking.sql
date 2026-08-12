-- SNEFERU Activity Tracking + Auto-Fix storage
-- idempotent; safe to run repeatedly

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS activity_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surface TEXT NOT NULL DEFAULT 'web',               -- web | shopify | api | worker | connector | system
  actor_type TEXT NOT NULL DEFAULT 'anonymous',      -- user | client | connector | shopify | anonymous | system
  actor_id TEXT,
  client_id TEXT,
  action TEXT NOT NULL,                              -- semantic label, e.g. 'clients.list'
  route TEXT,                                        -- normalized route pattern, e.g. /api/clients/:id
  method TEXT,
  status_code INT,
  success BOOLEAN NOT NULL DEFAULT true,
  duration_ms INT,
  shop TEXT,                                         -- shopify shop domain
  ip TEXT,
  user_agent TEXT,
  error_type TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_events_occurred ON activity_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_client ON activity_events (client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor ON activity_events (actor_type, actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_action ON activity_events (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_surface ON activity_events (surface, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_success ON activity_events (success, occurred_at DESC);

CREATE TABLE IF NOT EXISTS auto_fix_runs (
  id BIGSERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL,                              -- 'http' | 'worker' | 'scheduler' | 'system' | 'frontend'
  surface TEXT,
  action TEXT,
  client_id TEXT,
  error_type TEXT,
  error_message TEXT,
  severity TEXT NOT NULL DEFAULT 'warning',          -- info | warning | critical
  category TEXT NOT NULL DEFAULT 'other',            -- retryable | credential | config | dependency | data | code | other
  fix_applied TEXT,                                  -- description of what was done
  fix_success BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  outcome TEXT,                                      -- resolution notes
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_auto_fix_runs_time ON auto_fix_runs (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_fix_runs_pending ON auto_fix_runs (approved, run_at DESC);