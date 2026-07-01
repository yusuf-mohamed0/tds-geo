-- ══════════════════════════════════════════════
-- AI SEO Automation System - Complete Schema v3
-- Merges schema.sql + migration_v2.sql + migration_platform_v1.sql
-- ══════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector for embeddings (optional)

-- ══════════════════════════════════════════════
-- TABLES
-- ══════════════════════════════════════════════

-- ─── Clients ─────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(255) NOT NULL,
  slug                VARCHAR(255) UNIQUE NOT NULL,
  shopify_shop        VARCHAR(255) NOT NULL,
  shopify_token       VARCHAR(255) NOT NULL,
  shopify_api_version VARCHAR(50) NOT NULL DEFAULT '2025-07',

  -- Brand & Content config
  brand_voice         TEXT DEFAULT 'professional and educational',
  service_area        VARCHAR(500),
  timezone            VARCHAR(50) DEFAULT 'UTC',
  publish_frequency   VARCHAR(50) DEFAULT 'daily'
                      CHECK (publish_frequency IN ('hourly', 'daily', 'weekly', 'monthly', 'manual')),
  preferred_publish_hour INTEGER DEFAULT 10
                      CHECK (preferred_publish_hour >= 0 AND preferred_publish_hour <= 23),
  approval_mode       VARCHAR(20) DEFAULT 'auto'
                      CHECK (approval_mode IN ('auto', 'manual')),

  -- Budget & limits
  monthly_token_limit  BIGINT DEFAULT 1000000,
  monthly_cost_limit   DECIMAL(10,2) DEFAULT 100.00,

  -- Keyword preferences
  keyword_categories   TEXT[] DEFAULT '{}',
  blacklist_keywords   TEXT[] DEFAULT '{}',
  cta_template         TEXT,
  target_audience      TEXT,

  settings            JSONB DEFAULT '{}',
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);

-- ─── Users (Authentication) ──────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'editor'
                  CHECK (role IN ('super_admin', 'admin', 'editor', 'client')),
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_client ON users(client_id);

-- ─── Keywords ────────────────────────────────
CREATE TABLE IF NOT EXISTS keywords (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword           VARCHAR(500) NOT NULL,
  cluster_id        UUID,

  -- Metrics
  search_volume     INTEGER DEFAULT 0,
  competition       DECIMAL(5,2) DEFAULT 0,
  cpc               DECIMAL(8,2) DEFAULT 0,
  trend_score       DECIMAL(5,2) DEFAULT 0,
  relevance_score   DECIMAL(5,2) DEFAULT 0,

  -- Classification
  keyword_type      VARCHAR(50) DEFAULT 'long_tail'
                    CHECK (keyword_type IN ('short_tail', 'mid_tail', 'long_tail', 'question', 'local', 'product')),
  intent            VARCHAR(50) DEFAULT 'informational'
                    CHECK (intent IN ('informational', 'navigational', 'commercial', 'transactional')),

  source            VARCHAR(100) DEFAULT 'manual',
  metadata          JSONB DEFAULT '{}',
  is_active         BOOLEAN DEFAULT true,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keywords_client ON keywords(client_id);
CREATE INDEX IF NOT EXISTS idx_keywords_cluster ON keywords(cluster_id);
CREATE INDEX IF NOT EXISTS idx_keywords_relevance ON keywords(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_last_used ON keywords(last_used_at);
CREATE INDEX IF NOT EXISTS idx_keywords_active ON keywords(is_active);
CREATE INDEX IF NOT EXISTS idx_keywords_type ON keywords(keyword_type);
CREATE INDEX IF NOT EXISTS idx_keywords_intent ON keywords(intent);

-- ─── Keyword Clusters ────────────────────────
CREATE TABLE IF NOT EXISTS keyword_clusters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  cluster_name    VARCHAR(500) NOT NULL,
  primary_keyword VARCHAR(500) NOT NULL,
  silo_topic      VARCHAR(500),
  relevance_score DECIMAL(5,2) DEFAULT 0,
  metadata        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kc_client ON keyword_clusters(client_id);

-- ─── Articles ────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  keyword_id        UUID REFERENCES keywords(id) ON DELETE SET NULL,
  title             VARCHAR(500) NOT NULL,
  slug              VARCHAR(500) UNIQUE NOT NULL,
  content_md        TEXT NOT NULL,
  content_html      TEXT,
  meta_title        VARCHAR(500),
  meta_description  TEXT,
  tags              TEXT[] DEFAULT '{}',
  word_count        INTEGER DEFAULT 0,

  -- Pipeline tracking
  pipeline_stage    VARCHAR(50) DEFAULT 'draft'
                    CHECK (pipeline_stage IN ('draft', 'title', 'outline', 'article', 'seo_enhanced', 'cta_inserted', 'faq_added', 'metadata_generated', 'complete')),

  status            VARCHAR(50) DEFAULT 'draft'
                    CHECK (status IN ('draft', 'generated', 'reviewed', 'approved', 'rejected', 'published', 'failed', 'archived')),

  -- Scoring
  seo_score         DECIMAL(5,1),
  readability_score DECIMAL(5,1),
  quality_score     DECIMAL(5,1),
  eat_score         DECIMAL(5,1),

  source            VARCHAR(100) DEFAULT 'ai_generated',
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_client ON articles(client_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_pipeline ON articles(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);

-- ─── Article Images ──────────────────────────
CREATE TABLE IF NOT EXISTS article_images (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt            TEXT,
  image_url         TEXT,
  shopify_image_id  BIGINT,
  alt_text          VARCHAR(500),
  width             INTEGER,
  height            INTEGER,
  position          INTEGER DEFAULT 0,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_article ON article_images(article_id);
CREATE INDEX IF NOT EXISTS idx_ai_client ON article_images(client_id);

-- ─── Publishing History ──────────────────────
CREATE TABLE IF NOT EXISTS publishing_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  shopify_article_id BIGINT,
  shopify_blog_id   BIGINT,
  published_url     TEXT,
  status            VARCHAR(50) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'published', 'failed', 'updated')),
  error_message     TEXT,
  attempt_count     INTEGER DEFAULT 1,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pub_history_article ON publishing_history(article_id);
CREATE INDEX IF NOT EXISTS idx_pub_history_client ON publishing_history(client_id);
CREATE INDEX IF NOT EXISTS idx_pub_history_status ON publishing_history(status);

-- ─── Publishing Queue ────────────────────────
CREATE TABLE IF NOT EXISTS publishing_queue (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  blog_id           BIGINT,

  priority          INTEGER DEFAULT 0,
  scheduled_at      TIMESTAMPTZ,
  status            VARCHAR(50) DEFAULT 'queued'
                    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempt_count     INTEGER DEFAULT 0,
  max_attempts      INTEGER DEFAULT 3,
  last_error        TEXT,
  locked_until      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pq_client ON publishing_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_pq_status ON publishing_queue(status);
CREATE INDEX IF NOT EXISTS idx_pq_scheduled ON publishing_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pq_priority ON publishing_queue(priority DESC);

-- ─── Internal Links Cache ────────────────────
CREATE TABLE IF NOT EXISTS internal_links_cache (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  source_article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  target_article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  link_text         VARCHAR(500),
  link_url          TEXT,
  relevance_score   DECIMAL(5,2) DEFAULT 0,
  anchor_text       VARCHAR(300),
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ilc_client ON internal_links_cache(client_id);
CREATE INDEX IF NOT EXISTS idx_ilc_source ON internal_links_cache(source_article_id);
CREATE INDEX IF NOT EXISTS idx_ilc_target ON internal_links_cache(target_article_id);

-- ─── Content Embeddings (Vector Memory) ──────
CREATE TABLE IF NOT EXISTS content_embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id      UUID REFERENCES articles(id) ON DELETE CASCADE,
  chunk_index     INTEGER DEFAULT 0,
  content_chunk   TEXT NOT NULL,
  embedding       VECTOR(1536),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_client ON content_embeddings(client_id);
CREATE INDEX IF NOT EXISTS idx_ce_article ON content_embeddings(article_id);

-- ─── Schedules ───────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  frequency         VARCHAR(50) NOT NULL
                    CHECK (frequency IN ('cron', 'interval', 'once')),
  cron_expression   VARCHAR(100),
  interval_minutes  INTEGER,
  next_run_at       TIMESTAMPTZ,
  last_run_at       TIMESTAMPTZ,
  config            JSONB DEFAULT '{}',
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_client ON schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at);

-- ─── Webhooks ────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  name              VARCHAR(255),
  url               TEXT NOT NULL,
  events            TEXT[] NOT NULL DEFAULT '{}',
  secret            VARCHAR(255),
  retry_count       INTEGER DEFAULT 3,
  timeout_ms        INTEGER DEFAULT 10000,
  is_active         BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_client ON webhooks(client_id);

-- ─── Webhook Deliveries ──────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id        UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event             VARCHAR(100) NOT NULL,
  payload           JSONB,
  status            VARCHAR(50) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  response_code     INTEGER,
  response_body     TEXT,
  attempt_count     INTEGER DEFAULT 1,
  max_attempts      INTEGER DEFAULT 3,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wd_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_wd_status ON webhook_deliveries(status);

-- ─── Cost Tracking / API Usage ───────────────
CREATE TABLE IF NOT EXISTS cost_tracking (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id        UUID REFERENCES articles(id) ON DELETE SET NULL,
  provider          VARCHAR(50) NOT NULL
                    CHECK (provider IN ('openai', 'serpapi', 'shopify', 'other')),
  model             VARCHAR(100),
  tokens_in         INTEGER DEFAULT 0,
  tokens_out        INTEGER DEFAULT 0,
  cost_usd          DECIMAL(10,6) DEFAULT 0,
  duration_ms       INTEGER DEFAULT 0,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_client ON cost_tracking(client_id);
CREATE INDEX IF NOT EXISTS idx_ct_article ON cost_tracking(article_id);
CREATE INDEX IF NOT EXISTS idx_ct_created ON cost_tracking(created_at DESC);

-- ─── API Usage (rate limit tracking) ─────────
CREATE TABLE IF NOT EXISTS api_usage (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  provider          VARCHAR(50) NOT NULL,
  endpoint          VARCHAR(255),
  status_code       INTEGER,
  duration_ms       INTEGER DEFAULT 0,
  rate_limit_remaining INTEGER,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_au_client ON api_usage(client_id);
CREATE INDEX IF NOT EXISTS idx_au_provider ON api_usage(provider);
CREATE INDEX IF NOT EXISTS idx_au_created ON api_usage(created_at DESC);

-- ─── SEO Analytics ───────────────────────────
CREATE TABLE IF NOT EXISTS seo_analytics (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  tracked_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions       INTEGER DEFAULT 0,
  clicks            INTEGER DEFAULT 0,
  ctr               DECIMAL(5,4) DEFAULT 0,
  avg_position      DECIMAL(5,1) DEFAULT 0,
  indexed           BOOLEAN DEFAULT false,
  keyword_rankings  JSONB DEFAULT '{}',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, tracked_date)
);

CREATE INDEX IF NOT EXISTS idx_sa_client ON seo_analytics(client_id);
CREATE INDEX IF NOT EXISTS idx_sa_date ON seo_analytics(tracked_date DESC);

-- ─── Jobs / Queue History ────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id            VARCHAR(255) UNIQUE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  type              VARCHAR(100) NOT NULL,
  status            VARCHAR(50) DEFAULT 'queued'
                    CHECK (status IN ('queued', 'active', 'completed', 'failed', 'delayed', 'dead_lettered')),
  data              JSONB DEFAULT '{}',
  result            JSONB DEFAULT '{}',
  error_message     TEXT,
  attempts          INTEGER DEFAULT 1,
  max_attempts      INTEGER DEFAULT 3,
  queue_latency_ms  INTEGER,
  queued_at         TIMESTAMPTZ DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- ─── Workflow Logs ───────────────────────────
CREATE TABLE IF NOT EXISTS workflow_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id        UUID REFERENCES articles(id) ON DELETE SET NULL,
  workflow_type     VARCHAR(100) NOT NULL,
  stage             VARCHAR(100),
  status            VARCHAR(50) DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  duration_ms       INTEGER,
  token_usage       JSONB DEFAULT '{}',
  metrics           JSONB DEFAULT '{}',
  error_message     TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wfl_client ON workflow_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_wfl_article ON workflow_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_wfl_type ON workflow_logs(workflow_type);
CREATE INDEX IF NOT EXISTS idx_wfl_created ON workflow_logs(created_at DESC);

-- ─── Activity Logs ───────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  action            VARCHAR(100) NOT NULL,
  entity_type       VARCHAR(50),
  entity_id         UUID,
  level             VARCHAR(20) DEFAULT 'info'
                    CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message           TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_client ON activity_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_level ON activity_logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at DESC);

-- ══════════════════════════════════════════════
-- PLATFORM EXPANSION TABLES
-- ══════════════════════════════════════════════

-- ─── API Keys ────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  service           VARCHAR(100) NOT NULL,
  label             VARCHAR(255),
  key_value         VARCHAR(5000) NOT NULL,
  masked_value      VARCHAR(255),
  permissions       TEXT[] DEFAULT '{}',
  is_active         BOOLEAN DEFAULT true,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ak_client ON api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_ak_service ON api_keys(service);

-- ─── System Configuration ────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key               VARCHAR(255) UNIQUE NOT NULL,
  value             JSONB NOT NULL DEFAULT '{}',
  category          VARCHAR(100) DEFAULT 'general',
  description       TEXT,
  is_public         BOOLEAN DEFAULT false,
  is_encrypted      BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sc_category ON system_config(category);

-- ─── Prompt Templates ────────────────────────
CREATE TABLE IF NOT EXISTS prompt_templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  category          VARCHAR(100) DEFAULT 'general',
  system_prompt     TEXT NOT NULL,
  user_template     TEXT NOT NULL,
  model             VARCHAR(100) DEFAULT 'gpt-4o',
  temperature       DECIMAL(3,2) DEFAULT 0.7,
  max_tokens        INTEGER DEFAULT 2048,
  variables         TEXT[] DEFAULT '{}',
  version           INTEGER DEFAULT 1,
  is_system         BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pt_category ON prompt_templates(category);

-- ─── Prompt Versions (history) ───────────────
CREATE TABLE IF NOT EXISTS prompt_versions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id       UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  system_prompt     TEXT NOT NULL,
  user_template     TEXT NOT NULL,
  model             VARCHAR(100),
  temperature       DECIMAL(3,2),
  max_tokens        INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pv_template ON prompt_versions(template_id);

-- ─── Plugin Registry ─────────────────────────
CREATE TABLE IF NOT EXISTS plugin_registry (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(255) UNIQUE NOT NULL,
  description       TEXT,
  version           VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  author            VARCHAR(255),
  hooks             TEXT[] DEFAULT '{}',
  default_config    JSONB DEFAULT '{}',
  is_system         BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Plugin Instances ────────────────────────
CREATE TABLE IF NOT EXISTS plugin_instances (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_id         UUID REFERENCES plugin_registry(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  config            JSONB DEFAULT '{}',
  is_enabled        BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_pi_client ON plugin_instances(client_id);

-- ─── Chat Sessions ───────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(500) DEFAULT 'New Chat',
  context           JSONB DEFAULT '{}',
  message_count     INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_updated ON chat_sessions(updated_at DESC);

-- ─── Chat Messages ───────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role              VARCHAR(50) NOT NULL
                    CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content           TEXT NOT NULL,
  tool_calls        JSONB DEFAULT '[]',
  tool_results      JSONB DEFAULT '[]',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_cm_created ON chat_messages(created_at);

-- ─── Improvement Suggestions ─────────────────
CREATE TABLE IF NOT EXISTS improvement_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category          VARCHAR(100),
  metric            VARCHAR(100),
  suggestion        TEXT,
  value             DECIMAL(5,2),
  implemented       BOOLEAN DEFAULT false,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_il_category ON improvement_logs(category);
CREATE INDEX IF NOT EXISTS idx_il_implemented ON improvement_logs(implemented);

-- ══════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════

-- ─── Updated-at Trigger Function ─────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Apply updated_at triggers ────────────────
DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_keywords_updated_at ON keywords;
CREATE TRIGGER trg_keywords_updated_at
  BEFORE UPDATE ON keywords FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_kc_updated_at ON keyword_clusters;
CREATE TRIGGER trg_kc_updated_at
  BEFORE UPDATE ON keyword_clusters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_articles_updated_at ON articles;
CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON webhooks;
CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_schedules_updated_at ON schedules;
CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_pq_updated_at ON publishing_queue;
CREATE TRIGGER trg_pq_updated_at
  BEFORE UPDATE ON publishing_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Helper: Log Activity ────────────────────
CREATE OR REPLACE FUNCTION log_activity(
  p_client_id UUID,
  p_action VARCHAR(100),
  p_entity_type VARCHAR(50),
  p_entity_id UUID,
  p_level VARCHAR(20),
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO activity_logs (client_id, action, entity_type, entity_id, level, message, metadata)
  VALUES (p_client_id, p_action, p_entity_type, p_entity_id, p_level, p_message, p_metadata)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════
-- VIEWS (for analytics)
-- ══════════════════════════════════════════════

-- ─── Client Monthly Summary View ─────────────
CREATE OR REPLACE VIEW v_client_monthly_summary AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  COUNT(DISTINCT a.id) FILTER (WHERE a.created_at >= DATE_TRUNC('month', NOW())) as articles_this_month,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'published') as total_published,
  COUNT(DISTINCT k.id) FILTER (WHERE k.is_active) as active_keywords,
  COALESCE(SUM(ct.cost_usd) FILTER (WHERE ct.created_at >= DATE_TRUNC('month', NOW())), 0) as monthly_cost,
  COALESCE(SUM(ct.tokens_in + ct.tokens_out) FILTER (WHERE ct.created_at >= DATE_TRUNC('month', NOW())), 0) as monthly_tokens
FROM clients c
LEFT JOIN articles a ON a.client_id = c.id
LEFT JOIN keywords k ON k.client_id = c.id
LEFT JOIN cost_tracking ct ON ct.client_id = c.id
GROUP BY c.id, c.name;

-- ─── Workflow Performance View ───────────────
CREATE OR REPLACE VIEW v_workflow_performance AS
SELECT
  workflow_type,
  stage,
  status,
  COUNT(*) as total_runs,
  AVG(duration_ms)::INT as avg_duration_ms,
  SUM((token_usage->>'total_tokens')::BIGINT) as total_tokens_used
FROM workflow_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY workflow_type, stage, status;
