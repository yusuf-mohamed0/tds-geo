-- ══════════════════════════════════════════════════════════════════
-- AI SEO Automation System — Odoo ERP Integration v1 Migration
-- Adds full Odoo connector infrastructure:
--   • Connection credentials (encrypted at rest)
--   • Model-to-entity field mappings
--   • Sync operation audit logs
--   • Scheduled sync configurations
--   • Webhook registration tracking
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- 1. ODOO CONNECTIONS
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS odoo_connections (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label                VARCHAR(255) NOT NULL,
  base_url             VARCHAR(500) NOT NULL,
  database_name        VARCHAR(255) NOT NULL,
  username             VARCHAR(255) NOT NULL,
  api_key_encrypted    TEXT,
  odoo_uid             INTEGER,
  is_active            BOOLEAN DEFAULT true,
  last_sync_at         TIMESTAMPTZ,
  last_connection_test TIMESTAMPTZ,
  is_connected         BOOLEAN DEFAULT false,
  metadata             JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oc_active ON odoo_connections(is_active);

-- ══════════════════════════════════════════════════════════════════
-- 2. ODOO MODEL MAPPINGS
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE odoo_sync_direction AS ENUM ('bidirectional', 'odoo_to_kozmo_core', 'kozmo_core_to_odoo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE odoo_conflict_strategy AS ENUM ('kozmo_core_wins', 'odoo_wins', 'manual', 'latest_wins');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS odoo_model_mappings (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id      UUID REFERENCES odoo_connections(id) ON DELETE CASCADE,
  odoo_model         VARCHAR(255) NOT NULL,
  kozmo_core_entity      VARCHAR(255) NOT NULL,
  field_mappings     JSONB NOT NULL DEFAULT '{}',
  sync_direction     odoo_sync_direction DEFAULT 'bidirectional',
  conflict_strategy  odoo_conflict_strategy DEFAULT 'latest_wins',
  is_active          BOOLEAN DEFAULT true,
  last_sync_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, odoo_model),
  UNIQUE(connection_id, kozmo_core_entity)
);

CREATE INDEX IF NOT EXISTS idx_omm_connection ON odoo_model_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_omm_model ON odoo_model_mappings(odoo_model);
CREATE INDEX IF NOT EXISTS idx_omm_entity ON odoo_model_mappings(kozmo_core_entity);
CREATE INDEX IF NOT EXISTS idx_omm_active ON odoo_model_mappings(is_active);

-- ══════════════════════════════════════════════════════════════════
-- 3. ODOO SYNC LOG
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE odoo_sync_operation AS ENUM ('create', 'update', 'delete', 'read', 'sync');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE odoo_sync_status AS ENUM ('success', 'failed', 'pending', 'conflict', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS odoo_sync_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id     UUID REFERENCES odoo_connections(id) ON DELETE CASCADE,
  model             VARCHAR(255) NOT NULL,
  operation         odoo_sync_operation NOT NULL,
  odoo_record_id    INTEGER,
  kozmo_core_record_id  UUID,
  status            odoo_sync_status NOT NULL DEFAULT 'pending',
  change_summary    TEXT,
  error_message     TEXT,
  conflict_details  JSONB,
  raw_request       JSONB,
  raw_response      JSONB,
  duration_ms       INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osl_connection ON odoo_sync_log(connection_id);
CREATE INDEX IF NOT EXISTS idx_osl_model ON odoo_sync_log(model);
CREATE INDEX IF NOT EXISTS idx_osl_status ON odoo_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_osl_created ON odoo_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_osl_odoo_record ON odoo_sync_log(odoo_record_id);
CREATE INDEX IF NOT EXISTS idx_osl_kozmo_core_record ON odoo_sync_log(kozmo_core_record_id);

-- ─── Sync Log Auto-Cleanup (keep 90 days) ─────
CREATE OR REPLACE FUNCTION cleanup_odoo_sync_log()
RETURNS void AS $$
BEGIN
  DELETE FROM odoo_sync_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════
-- 4. ODOO SYNC CONFIGURATIONS (scheduled syncs)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS odoo_sync_configs (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id          UUID REFERENCES odoo_connections(id) ON DELETE CASCADE,
  model                  VARCHAR(255) NOT NULL,
  sync_interval_minutes  INTEGER NOT NULL DEFAULT 60,
  last_sync_at           TIMESTAMPTZ,
  next_sync_at           TIMESTAMPTZ,
  is_active              BOOLEAN DEFAULT true,
  batch_size             INTEGER DEFAULT 100,
  full_sync_cron         VARCHAR(100),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, model)
);

CREATE INDEX IF NOT EXISTS idx_osc_connection ON odoo_sync_configs(connection_id);
CREATE INDEX IF NOT EXISTS idx_osc_next_sync ON odoo_sync_configs(next_sync_at)
  WHERE is_active = true;

-- ══════════════════════════════════════════════════════════════════
-- 5. ODOO WEBHOOK REGISTRATIONS
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS odoo_webhook_registrations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id    UUID REFERENCES odoo_connections(id) ON DELETE CASCADE,
  model            VARCHAR(255) NOT NULL,
  webhook_url      TEXT NOT NULL,
  events           TEXT[] DEFAULT '{}',
  secret           TEXT,
  odoo_webhook_id  INTEGER,
  is_active        BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, model)
);

CREATE INDEX IF NOT EXISTS idx_owr_connection ON odoo_webhook_registrations(connection_id);
CREATE INDEX IF NOT EXISTS idx_owr_active ON odoo_webhook_registrations(is_active);

-- ══════════════════════════════════════════════════════════════════
-- 6. ODOO CHANGE TRACKING (for incremental sync)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS odoo_change_tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id   UUID REFERENCES odoo_connections(id) ON DELETE CASCADE,
  model           VARCHAR(255) NOT NULL,
  record_id       INTEGER NOT NULL,
  operation       odoo_sync_operation NOT NULL,
  tracked_at      TIMESTAMPTZ DEFAULT NOW(),
  processed       BOOLEAN DEFAULT false,
  processed_at    TIMESTAMPTZ,
  UNIQUE(connection_id, model, record_id, operation)
);

CREATE INDEX IF NOT EXISTS idx_oct_unprocessed ON odoo_change_tracking(connection_id, processed, tracked_at)
  WHERE processed = false;

-- ══════════════════════════════════════════════════════════════════
-- 7. ODOO DASHBOARD CACHE (materialized stats per connection)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS odoo_dashboard_cache (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id    UUID REFERENCES odoo_connections(id) ON DELETE CASCADE,
  model            VARCHAR(255) NOT NULL,
  total_records    INTEGER DEFAULT 0,
  synced_records   INTEGER DEFAULT 0,
  pending_sync     INTEGER DEFAULT 0,
  failed_sync      INTEGER DEFAULT 0,
  last_sync_at     TIMESTAMPTZ,
  cached_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, model)
);

-- ══════════════════════════════════════════════════════════════════
-- VIEWS
-- ══════════════════════════════════════════════════════════════════

-- Odoo connection health summary
CREATE OR REPLACE VIEW v_odoo_connection_health AS
SELECT
  oc.id,
  oc.label,
  oc.is_connected,
  oc.last_connection_test,
  oc.last_sync_at,
  COUNT(DISTINCT osm.id) as active_mappings,
  COUNT(DISTINCT osl.id) FILTER (WHERE osl.status = 'failed' AND osl.created_at >= NOW() - INTERVAL '24 hours') as failures_24h,
  COUNT(DISTINCT osl.id) FILTER (WHERE osl.created_at >= NOW() - INTERVAL '24 hours') as total_ops_24h
FROM odoo_connections oc
LEFT JOIN odoo_model_mappings osm ON osm.connection_id = oc.id AND osm.is_active = true
LEFT JOIN odoo_sync_log osl ON osl.connection_id = oc.id
GROUP BY oc.id, oc.label, oc.is_connected, oc.last_connection_test, oc.last_sync_at;

-- Odoo sync performance
CREATE OR REPLACE VIEW v_odoo_sync_performance AS
SELECT
  connection_id,
  model,
  operation,
  status,
  COUNT(*) as count,
  AVG(duration_ms)::INT as avg_duration_ms,
  MAX(created_at) as last_occurred
FROM odoo_sync_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY connection_id, model, operation, status;

-- ══════════════════════════════════════════════════════════════════
-- TRIGGER: Auto-update next_sync_at on odoo_sync_configs
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_odoo_next_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_sync_at IS NOT NULL AND NEW.sync_interval_minutes > 0 THEN
    NEW.next_sync_at = NEW.last_sync_at + (NEW.sync_interval_minutes || ' minutes')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_odoo_sync_configs_next_sync ON odoo_sync_configs;
CREATE TRIGGER trg_odoo_sync_configs_next_sync
  BEFORE UPDATE OF last_sync_at ON odoo_sync_configs
  FOR EACH ROW EXECUTE FUNCTION update_odoo_next_sync();

-- ══════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ══════════════════════════════════════════════════════════════════
