-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- AEO v5 Migration: Knowledge Base, Crawler
-- Analytics, and Scheduler Integration
-- ══════════════════════════════════════════════

-- ─── Knowledge Base ─────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  chunk_strategy  VARCHAR(50) DEFAULT 'semantic'
                  CHECK (chunk_strategy IN ('semantic', 'fixed', 'paragraph')),
  chunk_size      INTEGER DEFAULT 500,
  chunk_overlap   INTEGER DEFAULT 50,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  filename        VARCHAR(500) NOT NULL,
  file_type       VARCHAR(50),
  file_size       INTEGER,
  content         TEXT,
  chunk_count     INTEGER DEFAULT 0,
  status          VARCHAR(50) DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add client_id index to content_embeddings for KB recall
CREATE INDEX IF NOT EXISTS idx_content_embeddings_client
  ON content_embeddings(client_id);

-- Add source column to content_embeddings
ALTER TABLE content_embeddings
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'article'
  CHECK (source IN ('article', 'kb_document'));

ALTER TABLE content_embeddings
  ADD COLUMN IF NOT EXISTS kb_document_id UUID REFERENCES kb_documents(id) ON DELETE CASCADE;

-- ─── Crawler Visit Log ──────────────────────
CREATE TABLE IF NOT EXISTS crawler_visits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  crawler_name    VARCHAR(100) NOT NULL,
  user_agent      TEXT,
  path            TEXT,
  ip_address      VARCHAR(45),
  visited_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_visits_client
  ON crawler_visits(client_id, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_visits_name
  ON crawler_visits(crawler_name, visited_at DESC);

-- ─── Schedule Log ───────────────────────────
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS last_status VARCHAR(50)
  CHECK (last_status IN ('success', 'failed', 'skipped'));

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS articles_generated INTEGER DEFAULT 0;

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS schedule_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id     UUID REFERENCES schedules(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  status          VARCHAR(50) NOT NULL,
  articles_count  INTEGER DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
