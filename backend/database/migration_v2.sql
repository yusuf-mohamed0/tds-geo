-- ──────────────────────────────────────────────
-- AI SEO Automation System - v2 Migration
-- Adds: users, roles, webhooks, embeddings, 
--       schedules, cost tracking, images
-- ──────────────────────────────────────────────

-- ─── Users (Authentication) ──────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'editor'
                  CHECK (role IN ('admin', 'editor', 'client')),
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_client ON users(client_id);

-- ─── Client Extended Settings ────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_voice TEXT DEFAULT 'professional and educational';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_area VARCHAR(500);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS publish_frequency VARCHAR(50) DEFAULT 'daily'
  CHECK (publish_frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'manual'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_publish_hour INTEGER DEFAULT 10
  CHECK (preferred_publish_hour >= 0 AND preferred_publish_hour <= 23);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(20) DEFAULT 'auto'
  CHECK (approval_mode IN ('auto', 'manual'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_token_limit BIGINT DEFAULT 1000000;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_cost_limit DECIMAL(10,2) DEFAULT 100.00;

-- ─── Article Images ──────────────────────────
CREATE TABLE IF NOT EXISTS article_images (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id      UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt          TEXT,
  image_url       TEXT,
  shopify_image_id BIGINT,
  alt_text        VARCHAR(500),
  width           INTEGER,
  height          INTEGER,
  position        INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_article ON article_images(article_id);
CREATE INDEX idx_ai_client ON article_images(client_id);

-- ─── Schedules ───────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  frequency       VARCHAR(50) NOT NULL
                  CHECK (frequency IN ('cron', 'interval', 'once')),
  cron_expression VARCHAR(100),
  interval_minutes INTEGER,
  next_run_at     TIMESTAMPTZ,
  last_run_at     TIMESTAMPTZ,
  config          JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_client ON schedules(client_id);
CREATE INDEX idx_schedules_next_run ON schedules(next_run_at);

-- ─── Webhooks ────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  name            VARCHAR(255),
  url             TEXT NOT NULL,
  events          TEXT[] NOT NULL DEFAULT '{}',
  secret          VARCHAR(255),
  retry_count     INTEGER DEFAULT 3,
  timeout_ms      INTEGER DEFAULT 10000,
  is_active       BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_client ON webhooks(client_id);

-- ─── Webhook Deliveries ──────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id      UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event           VARCHAR(100) NOT NULL,
  payload         JSONB,
  status          VARCHAR(50) DEFAULT 'pending'
                  CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  response_code   INTEGER,
  response_body   TEXT,
  attempt_count   INTEGER DEFAULT 1,
  max_attempts    INTEGER DEFAULT 3,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wd_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_wd_status ON webhook_deliveries(status);

-- ─── Content Embeddings (Vector Memory) ──────
CREATE TABLE IF NOT EXISTS content_embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles(id) ON DELETE CASCADE,
  chunk_index     INTEGER DEFAULT 0,
  content_chunk   TEXT NOT NULL,
  embedding       VECTOR(1536),  -- OpenAI ada-002 dimensions
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Requires pgvector extension: CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE INDEX idx_ce_embedding ON content_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_ce_client ON content_embeddings(client_id);
CREATE INDEX idx_ce_article ON content_embeddings(article_id);

-- ─── Cost Tracking ───────────────────────────
CREATE TABLE IF NOT EXISTS cost_tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles(id) ON DELETE SET NULL,
  provider        VARCHAR(50) NOT NULL
                  CHECK (provider IN ('openai', 'serpapi', 'shopify', 'other')),
  model           VARCHAR(100),
  tokens_in       INTEGER DEFAULT 0,
  tokens_out      INTEGER DEFAULT 0,
  cost_usd        DECIMAL(10,6) DEFAULT 0,
  duration_ms     INTEGER DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ct_client ON cost_tracking(client_id);
CREATE INDEX idx_ct_article ON cost_tracking(article_id);
CREATE INDEX idx_ct_created ON cost_tracking(created_at DESC);

-- ─── SEO Analytics ───────────────────────────
CREATE TABLE IF NOT EXISTS seo_analytics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles(id) ON DELETE CASCADE,
  tracked_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions     INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  ctr             DECIMAL(5,4) DEFAULT 0,
  avg_position    DECIMAL(5,1) DEFAULT 0,
  indexed         BOOLEAN DEFAULT false,
  keyword_rankings JSONB DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, tracked_date)
);

CREATE INDEX idx_sa_client ON seo_analytics(client_id);
CREATE INDEX idx_sa_date ON seo_analytics(tracked_date DESC);

-- ─── Jobs / Queue History ────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id          VARCHAR(255) UNIQUE,
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  type            VARCHAR(100) NOT NULL,
  status          VARCHAR(50) DEFAULT 'queued'
                  CHECK (status IN ('queued', 'active', 'completed', 'failed', 'delayed', 'dead_lettered')),
  data            JSONB DEFAULT '{}',
  result          JSONB DEFAULT '{}',
  error_message   TEXT,
  attempts        INTEGER DEFAULT 1,
  max_attempts    INTEGER DEFAULT 3,
  queued_at       TIMESTAMPTZ DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_status ON jobs(status);

-- ─── Triggers for updated_at columns ─────────
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON webhooks;
CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_schedules_updated_at ON schedules;
CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update articles status check constraint to include new statuses
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'generated', 'reviewed', 'approved', 'rejected', 'published', 'failed', 'archived'));
