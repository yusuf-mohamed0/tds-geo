-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- Centralized Credential Vault
-- Single flat table for all credentials (WP, DB,
-- server, email, API, social, domain, etc.)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS credential_vault (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,

  category          VARCHAR(50) NOT NULL
                    CHECK (category IN (
                      'wordpress', 'database', 'server', 'email',
                      'api', 'social', 'domain', 'other'
                    )),
  service           VARCHAR(100) NOT NULL,
  label             VARCHAR(255) NOT NULL,
  tags              TEXT[] DEFAULT '{}',

  url               VARCHAR(512),

  username          TEXT,
  password          TEXT,
  notes             TEXT,

  masked_username   VARCHAR(100),
  masked_password   VARCHAR(100),

  expires_at        TIMESTAMPTZ,
  rotation_days     INTEGER DEFAULT 90,
  last_used_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,

  deleted_at        TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_service    ON credential_vault(service);
CREATE INDEX IF NOT EXISTS idx_cv_category   ON credential_vault(category);
CREATE INDEX IF NOT EXISTS idx_cv_tags       ON credential_vault USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_cv_client     ON credential_vault(client_id);
CREATE INDEX IF NOT EXISTS idx_cv_deleted    ON credential_vault(deleted_at);
CREATE INDEX IF NOT EXISTS idx_cv_expires    ON credential_vault(expires_at);

CREATE TABLE IF NOT EXISTS credential_access_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credential_id     UUID REFERENCES credential_vault(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  action            VARCHAR(50) NOT NULL
                    CHECK (action IN (
                      'view', 'create', 'update', 'delete',
                      'rotate', 'export', 'import'
                    )),
  ip_address        INET,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_credential ON credential_access_log(credential_id);
CREATE INDEX IF NOT EXISTS idx_cal_user       ON credential_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cal_action     ON credential_access_log(action);
CREATE INDEX IF NOT EXISTS idx_cal_created    ON credential_access_log(created_at DESC);
