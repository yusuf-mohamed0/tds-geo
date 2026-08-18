-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- Ads Report Artifact Approval/Delivery Registry
-- Tracks generated PDF artifacts from the external
-- ads reporting runner through approval and manual
-- delivery. No email/client automation here; the
-- registry records state and audit only.
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ads_artifact_registry (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  month             VARCHAR(7) NOT NULL,

  file_name         TEXT NOT NULL,
  file_path         TEXT NOT NULL,
  size_bytes        BIGINT DEFAULT 0,
  sha256            TEXT,

  status            VARCHAR(20) DEFAULT 'generated'
                    CHECK (status IN ('generated', 'in_review', 'approved', 'rejected', 'delivered')),

  approved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,

  delivered_to      TEXT,
  delivered_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, month, file_name)
);

CREATE INDEX IF NOT EXISTS idx_ads_artifact_client_month ON ads_artifact_registry(client_id, month);
CREATE INDEX IF NOT EXISTS idx_ads_artifact_status ON ads_artifact_registry(status);