-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════════════════════════
-- AI SEO Automation System — Website Intelligence Migration
-- Adds storage for scraped client website data to power
-- hyper-personalized article generation.
-- ══════════════════════════════════════════════════════════════════

-- Website intelligence — deep contextual data scraped from client sites
CREATE TABLE IF NOT EXISTS website_intelligence (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,

  -- Core site data
  url               TEXT NOT NULL,
  domain            VARCHAR(500),
  pages_scanned     INTEGER DEFAULT 0,
  pages_found       TEXT[] DEFAULT '{}',
  site_name         VARCHAR(500),
  description       TEXT,

  -- Meta & SEO
  meta_keywords     TEXT[] DEFAULT '{}',

  -- Business intelligence
  services          JSONB DEFAULT '[]',       -- [{name, description, page}]
  industries        TEXT[] DEFAULT '{}',      -- Industries served
  target_audience   TEXT[] DEFAULT '{}',      -- Target audience descriptions
  unique_selling_points TEXT[] DEFAULT '{}',  -- USPs

  -- Tone analysis
  tone_analysis     JSONB DEFAULT '{}',       -- {primary_tone, secondary_tone, tone_scores, formality_estimate}

  -- Vocabulary
  common_terms      TEXT[] DEFAULT '{}',      -- Industry-specific terms/jargon

  -- CTA & structure
  cta_patterns      JSONB DEFAULT '[]',       -- [{text, url, page}]
  page_structure    JSONB DEFAULT '{}',        -- {h1: [...], h2: [...], h3: [...]}

  -- Contact & social
  contact_info      JSONB DEFAULT '{}',        -- {email, phone, address}
  social_links      JSONB DEFAULT '[]',        -- [{platform, url}]

  -- Tech stack
  tech_stack_hints  TEXT[] DEFAULT '{}',       -- Detected technologies

  -- Content gap analysis
  content_gaps      TEXT[] DEFAULT '{}',        -- Suggested content topics

  -- Full raw data (for AI to reference)
  raw_data          JSONB DEFAULT '{}',         -- Complete scrape dump

  -- Metadata
  is_stale          BOOLEAN DEFAULT false,
  scraped_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Only one active intelligence record per client
  CONSTRAINT unique_active_intelligence UNIQUE (client_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_wi_client ON website_intelligence(client_id);
CREATE INDEX IF NOT EXISTS idx_wi_domain ON website_intelligence(domain);
CREATE INDEX IF NOT EXISTS idx_wi_scraped ON website_intelligence(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_wi_stale ON website_intelligence(is_stale) WHERE is_stale = false;
