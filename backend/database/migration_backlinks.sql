-- Backlink Automation storage

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS backlink_prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  domain VARCHAR(500) NOT NULL,
  domain_rating INTEGER DEFAULT 0,
  relevance_score DECIMAL(5,2) DEFAULT 0,
  estimated_traffic INTEGER DEFAULT 0,
  niche VARCHAR(255),
  contact_email VARCHAR(255),
  contact_page TEXT,
  guest_post_guidelines TEXT,
  notes TEXT,
  source VARCHAR(100) DEFAULT 'manual',
  status VARCHAR(50) DEFAULT 'prospect' CHECK (status IN ('prospect', 'pitched', 'linked', 'rejected', 'ignored')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_backlink_prospects_client ON backlink_prospects(client_id);
CREATE INDEX IF NOT EXISTS idx_backlink_prospects_status ON backlink_prospects(status);
CREATE INDEX IF NOT EXISTS idx_backlink_prospects_scores ON backlink_prospects(relevance_score DESC, domain_rating DESC);

CREATE TABLE IF NOT EXISTS backlink_outreach (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES backlink_prospects(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  pitch_type VARCHAR(100) DEFAULT 'guest_post',
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'replied', 'rejected', 'accepted')),
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlink_outreach_client ON backlink_outreach(client_id);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_prospect ON backlink_outreach(prospect_id);
CREATE INDEX IF NOT EXISTS idx_backlink_outreach_status ON backlink_outreach(status);

CREATE TABLE IF NOT EXISTS backlinks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES backlink_prospects(id) ON DELETE SET NULL,
  outreach_id UUID REFERENCES backlink_outreach(id) ON DELETE SET NULL,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  link_type VARCHAR(50) DEFAULT 'editorial',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'lost', 'pending', 'nofollow')),
  domain_rating INTEGER DEFAULT 0,
  estimated_traffic INTEGER DEFAULT 0,
  verified_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, source_url, target_url)
);

CREATE INDEX IF NOT EXISTS idx_backlinks_client ON backlinks(client_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_status ON backlinks(status);
CREATE INDEX IF NOT EXISTS idx_backlinks_prospect ON backlinks(prospect_id);

DROP TRIGGER IF EXISTS trg_backlink_prospects_updated_at ON backlink_prospects;
CREATE TRIGGER trg_backlink_prospects_updated_at
  BEFORE UPDATE ON backlink_prospects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_backlink_outreach_updated_at ON backlink_outreach;
CREATE TRIGGER trg_backlink_outreach_updated_at
  BEFORE UPDATE ON backlink_outreach FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_backlinks_updated_at ON backlinks;
CREATE TRIGGER trg_backlinks_updated_at
  BEFORE UPDATE ON backlinks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
