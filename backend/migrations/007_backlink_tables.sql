-- Migration 007: Backlink Automation System

-- Prospects: sites identified as potential backlink sources
CREATE TABLE IF NOT EXISTS backlink_prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  domain VARCHAR(500) NOT NULL,
  domain_rating INTEGER DEFAULT 0,
  relevance_score NUMERIC(5,2) DEFAULT 0,
  estimated_traffic INTEGER DEFAULT 0,
  niche VARCHAR(200),
  contact_email VARCHAR(500),
  contact_page VARCHAR(500),
  guest_post_guidelines TEXT,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'discovered',
  source VARCHAR(100) DEFAULT 'competitor_analysis',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, domain)
);

-- Outreach: emails sent to prospects
CREATE TABLE IF NOT EXISTS backlink_outreach (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES backlink_prospects(id) ON DELETE CASCADE,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  reply_content TEXT,
  follow_up_at TIMESTAMPTZ,
  follow_up_count INTEGER DEFAULT 0,
  pitch_type VARCHAR(50) DEFAULT 'guest_post',
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backlinks: actual placed links
CREATE TABLE IF NOT EXISTS backlinks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES backlink_prospects(id) ON DELETE SET NULL,
  outreach_id UUID REFERENCES backlink_outreach(id) ON DELETE SET NULL,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  source_url VARCHAR(1000) NOT NULL,
  target_url VARCHAR(1000) NOT NULL,
  anchor_text TEXT,
  link_type VARCHAR(50) DEFAULT 'dofollow',
  status VARCHAR(50) DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  domain_rating INTEGER DEFAULT 0,
  estimated_traffic INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlink_prospects_client ON backlink_prospects(client_id, status);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_client ON backlink_outreach(client_id, status);
CREATE INDEX IF NOT EXISTS idx_backlinks_client ON backlink(client_id, status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_backlink_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_backlink_prospects_updated_at ON backlink_prospects;
CREATE TRIGGER trg_backlink_prospects_updated_at
  BEFORE UPDATE ON backlink_prospects
  FOR EACH ROW EXECUTE FUNCTION update_backlink_updated_at();

DROP TRIGGER IF EXISTS trg_backlink_outreach_updated_at ON backlink_outreach;
CREATE TRIGGER trg_backlink_outreach_updated_at
  BEFORE UPDATE ON backlink_outreach
  FOR EACH ROW EXECUTE FUNCTION update_backlink_updated_at();

DROP TRIGGER IF EXISTS trg_backlinks_updated_at ON backlinks;
CREATE TRIGGER trg_backlinks_updated_at
  BEFORE UPDATE ON backlinks
  FOR EACH ROW EXECUTE FUNCTION update_backlink_updated_at();
