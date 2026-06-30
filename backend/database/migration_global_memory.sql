-- ═══════════════════════════════════════════════════════════════
-- Global Memory Store — Article Memory
-- Tracks article history, performance, and entity associations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS article_memory (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    article_id      UUID NOT NULL,
    title           VARCHAR(500) NOT NULL,
    word_count      INT NOT NULL DEFAULT 0,
    seo_score       DECIMAL(5,2),
    read_time_seconds INT,
    traffic_estimate  INT,
    keywords        TEXT[] DEFAULT '{}',
    entities        TEXT[] DEFAULT '{}',
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (article_id)
);

CREATE INDEX IF NOT EXISTS idx_am_client ON article_memory(client_id);
CREATE INDEX IF NOT EXISTS idx_am_published ON article_memory(published_at);
CREATE INDEX IF NOT EXISTS idx_am_entities ON article_memory USING GIN(entities);
CREATE INDEX IF NOT EXISTS idx_am_keywords ON article_memory USING GIN(keywords);
