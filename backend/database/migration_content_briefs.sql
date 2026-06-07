-- ══════════════════════════════════════════════
-- Content Briefs — Migration
-- Copywriters submit briefs/prompts for AI article generation
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_briefs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword           VARCHAR(255),
  topic             VARCHAR(255),
  target_audience   VARCHAR(255),
  tone              VARCHAR(50) DEFAULT 'professional',
  key_points        TEXT[] DEFAULT '{}',  ref_urls           TEXT[] DEFAULT '{}',
  notes             TEXT,
  submitted_by      UUID REFERENCES users(id),
  status            VARCHAR(50) DEFAULT 'pending',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cb_client ON content_briefs(client_id);
CREATE INDEX IF NOT EXISTS idx_cb_submitted ON content_briefs(submitted_by);
CREATE INDEX IF NOT EXISTS idx_cb_status ON content_briefs(status);
