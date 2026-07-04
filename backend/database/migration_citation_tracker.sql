-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- Citation tracking table for AI search engine citations
CREATE TABLE IF NOT EXISTS citation_records (
    id SERIAL PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    engine VARCHAR(64) NOT NULL,
    domain VARCHAR(512) NOT NULL,
    cited BOOLEAN NOT NULL DEFAULT false,
    url TEXT,
    snippet TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_records_client
    ON citation_records(client_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_citation_records_domain
    ON citation_records(domain, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_citation_records_cited
    ON citation_records(domain, cited, checked_at DESC);

-- Freshness tracking table
CREATE TABLE IF NOT EXISTS freshness_audits (
    id SERIAL PRIMARY KEY,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    age_days INTEGER NOT NULL,
    needs_update BOOLEAN NOT NULL DEFAULT false,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_freshness_audits_client
    ON freshness_audits(client_id, needs_update DESC);

CREATE INDEX IF NOT EXISTS idx_freshness_audits_article
    ON freshness_audits(article_id);

-- Entity consistency tracking table
CREATE TABLE IF NOT EXISTS entity_consistency_records (
    id SERIAL PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    entity_name VARCHAR(256) NOT NULL,
    canonical_form VARCHAR(256) NOT NULL,
    variant_found VARCHAR(256) NOT NULL,
    source_type VARCHAR(64) NOT NULL, -- 'article', 'product', 'meta', 'page'
    source_id TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_consistency_client
    ON entity_consistency_records(client_id, entity_name);
