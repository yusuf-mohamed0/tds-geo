-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- Device Authorization System — Migration
-- Tables for device enrollment, session binding, audit
-- ══════════════════════════════════════════════

-- ─── Device Registry ──────────────────────────
CREATE TABLE IF NOT EXISTS device_registry (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint_hash VARCHAR(255) NOT NULL,
  device_name         VARCHAR(255),
  device_type         VARCHAR(50) DEFAULT 'unknown'
                      CHECK (device_type IN ('desktop', 'laptop', 'mobile', 'tablet', 'unknown')),

  -- Fingerprint components (hashed individually for forensic analysis)
  cpu_identifier      VARCHAR(255),
  mac_hash            VARCHAR(255),
  os_serial_hash      VARCHAR(255),
  cert_thumbprint     VARCHAR(255),
  browser_fingerprint VARCHAR(255),

  -- Trust scoring (0-100, calculated from fingerprint stability)
  trust_score         INTEGER DEFAULT 80 CHECK (trust_score >= 0 AND trust_score <= 100),
  last_seen_at        TIMESTAMPTZ,
  last_ip             INET,

  -- Enrollment metadata
  enrolled_by         UUID REFERENCES users(id),
  enrolled_at         TIMESTAMPTZ DEFAULT NOW(),

  -- Revocation
  is_revoked          BOOLEAN DEFAULT false,
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID REFERENCES users(id),
  revocation_reason   VARCHAR(500),

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(employee_id, device_fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS idx_dr_employee ON device_registry(employee_id);
CREATE INDEX IF NOT EXISTS idx_dr_fingerprint ON device_registry(device_fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_dr_trust ON device_registry(trust_score);
CREATE INDEX IF NOT EXISTS idx_dr_not_revoked ON device_registry(employee_id) WHERE NOT is_revoked;
CREATE INDEX IF NOT EXISTS idx_dr_last_seen ON device_registry(last_seen_at DESC);

-- ─── Employee Sessions (device-bound sessions) ─
CREATE TABLE IF NOT EXISTS employee_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id           UUID REFERENCES device_registry(id) ON DELETE CASCADE,

  token_jti           VARCHAR(255) UNIQUE NOT NULL,  -- JWT ID for revocation
  ip_address          INET,
  user_agent          TEXT,

  -- Risk assessment
  risk_score          INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_factors        TEXT[] DEFAULT '{}',

  -- Status
  is_active           BOOLEAN DEFAULT true,
  expires_at          TIMESTAMPTZ NOT NULL,
  terminated_at       TIMESTAMPTZ,
  termination_reason  VARCHAR(255),

  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_es_user ON employee_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_es_device ON employee_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_es_active ON employee_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_es_token ON employee_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_es_expires ON employee_sessions(expires_at);

-- ─── Device Audit Log ─────────────────────────
CREATE TABLE IF NOT EXISTS device_audit_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id),
  device_id           UUID REFERENCES device_registry(id),
  action              VARCHAR(100) NOT NULL,
  details             JSONB DEFAULT '{}',
  ip_address          INET,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dal_user ON device_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dal_device ON device_audit_log(device_id);
CREATE INDEX IF NOT EXISTS idx_dal_action ON device_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_dal_created ON device_audit_log(created_at DESC);

-- ─── Row-Level Security ───────────────────────
-- RLS is enabled with admin-level bypass policies so the application
-- (which connects as a trusted database user) has full access.
-- Application-layer authorization (via auth middleware) handles
-- the actual per-user enforcement.
--
-- For a stricter multi-tenant setup, replace WITH (true) with
-- policies scoped to session-level variables set by the app.
ALTER TABLE device_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sessions ENABLE ROW LEVEL SECURITY;

-- Application-level access (backend runs as db user)
DROP POLICY IF EXISTS app_full_access ON device_registry;
CREATE POLICY app_full_access ON device_registry
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_full_access ON employee_sessions;
CREATE POLICY app_full_access ON employee_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Triggers ─────────────────────────────────
DROP TRIGGER IF EXISTS trg_device_registry_updated_at ON device_registry;
CREATE TRIGGER trg_device_registry_updated_at
  BEFORE UPDATE ON device_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Helper: Log device activity ─────────────
CREATE OR REPLACE FUNCTION log_device_activity(
  p_user_id    UUID,
  p_action     VARCHAR(100),
  p_device_id  UUID DEFAULT NULL,
  p_details    JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO device_audit_log (user_id, device_id, action, details, ip_address)
  VALUES (p_user_id, p_device_id, p_action, p_details, p_ip_address)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
