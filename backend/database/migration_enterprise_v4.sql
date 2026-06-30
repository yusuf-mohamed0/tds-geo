-- ══════════════════════════════════════════════════════════════════
-- AI SEO Automation System — Enterprise v4 Migration
-- Adds production-grade editorial, fact-checking, brand voice,
-- multi-CMS, cost optimization, observability, security, and
-- content intelligence systems.
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- 1. HUMAN-IN-THE-LOOP EDITORIAL WORKFLOW
-- ══════════════════════════════════════════════════════════════════

-- Article editorial status: enum for precise workflow tracking
DO $$ BEGIN
  CREATE TYPE article_editorial_status AS ENUM (
    'draft', 'generated', 'in_review', 'in_seo_review', 'seo_reviewed',
    'in_editor_review', 'editor_reviewed', 'approved',
    'scheduled', 'published', 'rejected', 'failed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Editorial review assignments — who reviews what and when
CREATE TABLE IF NOT EXISTS editorial_review_assignments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  reviewer_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  review_type       VARCHAR(50) NOT NULL CHECK (review_type IN ('seo_review', 'editor_review', 'fact_check', 'final_approval')),
  status            VARCHAR(50) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'revision_requested')),
  priority          INTEGER DEFAULT 0,
  due_at            TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_era_article ON editorial_review_assignments(article_id);
CREATE INDEX IF NOT EXISTS idx_era_reviewer ON editorial_review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_era_status ON editorial_review_assignments(status);
CREATE INDEX IF NOT EXISTS idx_era_type ON editorial_review_assignments(review_type);

-- Editorial reviews — detailed review records with scores
CREATE TABLE IF NOT EXISTS editorial_reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  reviewer_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  review_type       VARCHAR(50) NOT NULL,
  decision          VARCHAR(50) NOT NULL CHECK (decision IN ('approved', 'rejected', 'revision_requested', 'needs_fact_check')),
  score             DECIMAL(5,2),
  comments          TEXT,
  suggestions       JSONB DEFAULT '[]',
  revision_notes    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erv_article ON editorial_reviews(article_id);
CREATE INDEX IF NOT EXISTS idx_erv_reviewer ON editorial_reviews(reviewer_id);

-- Editor comments (threaded)
CREATE TABLE IF NOT EXISTS editorial_comments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  parent_id         UUID REFERENCES editorial_comments(id) ON DELETE CASCADE,
  author_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  content           TEXT NOT NULL,
  resolved          BOOLEAN DEFAULT false,
  resolved_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_article ON editorial_comments(article_id);
CREATE INDEX IF NOT EXISTS idx_ec_parent ON editorial_comments(parent_id);

-- Content version history (full snapshots for rollback)
CREATE TABLE IF NOT EXISTS content_versions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL,
  title             VARCHAR(500) NOT NULL,
  content_md        TEXT NOT NULL,
  content_html      TEXT,
  meta_title        VARCHAR(500),
  meta_description  TEXT,
  tags              TEXT[] DEFAULT '{}',
  word_count        INTEGER DEFAULT 0,
  change_summary    TEXT,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_cv_article ON content_versions(article_id);

-- Content locking (prevent concurrent edits)
CREATE TABLE IF NOT EXISTS content_locks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE UNIQUE,
  locked_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at         TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cl_article ON content_locks(article_id);
CREATE INDEX IF NOT EXISTS idx_cl_expires ON content_locks(expires_at);

-- Editorial calendar
CREATE TABLE IF NOT EXISTS editorial_calendar (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_id        UUID REFERENCES articles(id) ON DELETE SET NULL,
  title             VARCHAR(500) NOT NULL,
  keyword           VARCHAR(500),
  assignee_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  status            VARCHAR(50) DEFAULT 'planned'
                    CHECK (status IN ('planned', 'in_progress', 'review', 'approved', 'published', 'cancelled')),
  priority          VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date          DATE,
  publish_date      DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_client ON editorial_calendar(client_id);
CREATE INDEX IF NOT EXISTS idx_ec_due ON editorial_calendar(due_date);

-- ══════════════════════════════════════════════════════════════════
-- 2. FACT CHECKING + SOURCE GROUNDING
-- ══════════════════════════════════════════════════════════════════

-- Trusted source domains / publications
CREATE TABLE IF NOT EXISTS trusted_sources (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  domain            VARCHAR(500) NOT NULL,
  source_name       VARCHAR(255),
  category          VARCHAR(100) DEFAULT 'general',
  authority_score   DECIMAL(5,2) DEFAULT 0.5,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_client ON trusted_sources(client_id);
CREATE INDEX IF NOT EXISTS idx_ts_domain ON trusted_sources(domain);

-- Fact-check results per claim
CREATE TABLE IF NOT EXISTS fact_checks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  claim             TEXT NOT NULL,
  verification      VARCHAR(50) NOT NULL CHECK (verification IN ('verified', 'likely_true', 'uncertain', 'likely_false', 'false', 'unverifiable')),
  confidence        DECIMAL(5,2) DEFAULT 0,
  source_url        TEXT,
  source_domain     VARCHAR(500),
  extracted_date    DATE,
  context           TEXT,
  reviewed_by_human BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fc_article ON fact_checks(article_id);
CREATE INDEX IF NOT EXISTS idx_fc_verification ON fact_checks(verification);

-- Citations extracted from generated content
CREATE TABLE IF NOT EXISTS citations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  claim_text        TEXT NOT NULL,
  source_text       TEXT,
  source_url        TEXT,
  source_title      VARCHAR(500),
  author            VARCHAR(255),
  publication_date  DATE,
  access_date       DATE DEFAULT CURRENT_DATE,
  citation_style    VARCHAR(50) DEFAULT 'web',
  confidence        DECIMAL(5,2) DEFAULT 0,
  is_validated      BOOLEAN DEFAULT false,
  position_in_article INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cit_article ON citations(article_id);

-- High-risk topic categories requiring mandatory citations
CREATE TABLE IF NOT EXISTS high_risk_topics (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  category          VARCHAR(100) NOT NULL,
  keywords          TEXT[] DEFAULT '{}',
  requires_citation BOOLEAN DEFAULT true,
  requires_human_review BOOLEAN DEFAULT true,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hrt_client ON high_risk_topics(client_id);

-- ══════════════════════════════════════════════════════════════════
-- 3. BRAND VOICE MEMORY SYSTEM
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brand_voice_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  -- Tone configuration
  tone_profile      JSONB DEFAULT '{"primary":"professional","secondary":"educational","formality":0.7,"enthusiasm":0.5,"empathy":0.6}',
  -- Vocabulary profile
  vocabulary_profile JSONB DEFAULT '{"preferred_terms":{},"avoided_terms":[],"industry_jargon":[],"power_words":[]}',
  -- Audience profile
  audience_profile  JSONB DEFAULT '{"demographics":{},"pain_points":[],"desires":[],"reading_level":"intermediate"}',
  -- Formatting preferences
  formatting_preferences JSONB DEFAULT '{"heading_style":"sentence","paragraph_length":"medium","use_bullets":true,"use_emphasis":true,"image_style":"professional"}',
  -- CTA style
  cta_style         VARCHAR(100) DEFAULT 'direct',
  -- Writing fingerprint (embedding of existing content)
  writing_fingerprint VECTOR(1536),
  -- Forbidden phrases
  forbidden_phrases TEXT[] DEFAULT '{}',
  preferred_terminology JSONB DEFAULT '{}',
  -- Sample content for reference
  sample_content    TEXT[] DEFAULT '{}',
  sample_articles   UUID[] DEFAULT '{}',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Brand voice embeddings for retrieval (sections of existing content)
CREATE TABLE IF NOT EXISTS brand_voice_embeddings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  content_snippet   TEXT NOT NULL,
  embedding         VECTOR(1536),
  source_type       VARCHAR(50) DEFAULT 'article',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bve_client ON brand_voice_embeddings(client_id);

-- ══════════════════════════════════════════════════════════════════
-- 4. MULTI-CMS PUBLISHING ARCHITECTURE
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE cms_provider AS ENUM ('shopify', 'wordpress', 'webflow', 'ghost', 'medium', 'headless_cms', 'notion', 'custom_rest');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cms_connections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  provider          cms_provider NOT NULL,
  label             VARCHAR(255),
  -- Connection details (encrypted at rest)
  endpoint_url      TEXT,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_url       TEXT,
  -- Provider-specific config
  config            JSONB DEFAULT '{}',
  -- Capabilities
  capabilities      TEXT[] DEFAULT '{}',
  is_primary        BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  last_sync_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_client ON cms_connections(client_id);
CREATE INDEX IF NOT EXISTS idx_cc_provider ON cms_connections(provider);

-- Publishing provider routing rules
CREATE TABLE IF NOT EXISTS publishing_routing_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  cms_connection_id UUID REFERENCES cms_connections(id) ON DELETE CASCADE,
  priority          INTEGER DEFAULT 0,
  condition_type    VARCHAR(50) DEFAULT 'always' CHECK (condition_type IN ('always', 'tag_match', 'keyword_match', 'topic_match', 'random')),
  condition_value   TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prr_client ON publishing_routing_rules(client_id);

-- Publishing history — tracks all CMS publish operations
CREATE TABLE IF NOT EXISTS publishing_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  cms_connection_id UUID REFERENCES cms_connections(id) ON DELETE SET NULL,
  provider          cms_provider NOT NULL,
  external_id       VARCHAR(255),
  external_url      TEXT,
  status            VARCHAR(50) DEFAULT 'published' CHECK (status IN ('published', 'updated', 'deleted', 'failed')),
  error_message     TEXT,
  published_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ph_article ON publishing_history(article_id);
CREATE INDEX IF NOT EXISTS idx_ph_client ON publishing_history(client_id);
CREATE INDEX IF NOT EXISTS idx_ph_provider ON publishing_history(provider);

-- ══════════════════════════════════════════════════════════════════
-- 5. PEXELS IMAGE MANAGEMENT
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pexels_cache (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  search_query      VARCHAR(500) NOT NULL,
  pexels_id         BIGINT NOT NULL,
  url               TEXT NOT NULL,
  photographer      VARCHAR(255),
  photographer_url  TEXT,
  alt_text          TEXT,
  width             INTEGER,
  height            INTEGER,
  orientation       VARCHAR(20) DEFAULT 'landscape',
  avg_color         VARCHAR(20),
  is_used           BOOLEAN DEFAULT false,
  article_id        UUID REFERENCES articles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, pexels_id)
);

CREATE INDEX IF NOT EXISTS idx_pc_client ON pexels_cache(client_id);
CREATE INDEX IF NOT EXISTS idx_pc_query ON pexels_cache(search_query);

-- ══════════════════════════════════════════════════════════════════
-- 6. COST OPTIMIZATION SYSTEM
-- ══════════════════════════════════════════════════════════════════

-- Model routing configuration
CREATE TABLE IF NOT EXISTS model_routing_config (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  task_type         VARCHAR(100) NOT NULL,
  preferred_model   VARCHAR(100) NOT NULL,
  fallback_model    VARCHAR(100),
  max_cost_per_call DECIMAL(10,6),
  max_tokens_per_call INTEGER,
  priority          INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, task_type)
);

-- Token budget tracking
CREATE TABLE IF NOT EXISTS token_budgets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  budget_period     VARCHAR(20) DEFAULT 'monthly' CHECK (budget_period IN ('daily', 'weekly', 'monthly')),
  token_limit       BIGINT NOT NULL,
  cost_limit        DECIMAL(10,2),
  tokens_used       BIGINT DEFAULT 0,
  cost_used         DECIMAL(10,2) DEFAULT 0,
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tb_client ON token_budgets(client_id);

-- Cost estimation cache
CREATE TABLE IF NOT EXISTS cost_estimates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_signature    VARCHAR(500) UNIQUE NOT NULL,
  estimated_tokens  INTEGER NOT NULL,
  estimated_cost    DECIMAL(10,6) NOT NULL,
  actual_tokens     INTEGER,
  actual_cost       DECIMAL(10,6),
  confidence        DECIMAL(5,2) DEFAULT 0.5,
  sample_count      INTEGER DEFAULT 1,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════
-- 7. OBSERVABILITY + MONITORING
-- ══════════════════════════════════════════════════════════════════

-- Structured trace spans (OpenTelemetry compatible)
CREATE TABLE IF NOT EXISTS trace_spans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id          VARCHAR(64) NOT NULL,
  parent_span_id    VARCHAR(64),
  span_name         VARCHAR(500) NOT NULL,
  service_name      VARCHAR(255) DEFAULT 'backend',
  span_kind         VARCHAR(50) DEFAULT 'internal',
  status            VARCHAR(20) DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'unset')),
  status_message    TEXT,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,
  duration_ms       INTEGER,
  attributes        JSONB DEFAULT '{}',
  resource_attrs    JSONB DEFAULT '{}',
  events            JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_trace ON trace_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_ts_parent ON trace_spans(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_ts_name ON trace_spans(span_name);
CREATE INDEX IF NOT EXISTS idx_ts_start ON trace_spans(start_time DESC);

-- Metrics snapshots (for Prometheus-style data)
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name       VARCHAR(255) NOT NULL,
  metric_type       VARCHAR(50) NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary')),
  value             DOUBLE PRECISION NOT NULL,
  labels            JSONB DEFAULT '{}',
  unit              VARCHAR(50),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ms_name ON metrics_snapshots(metric_name);
CREATE INDEX IF NOT EXISTS idx_ms_recorded ON metrics_snapshots(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_ms_labels ON metrics_snapshots USING gin(labels);

-- AI latency tracking
CREATE TABLE IF NOT EXISTS ai_latency_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  provider          VARCHAR(50) NOT NULL,
  model             VARCHAR(100),
  operation         VARCHAR(100) NOT NULL,
  prompt_tokens     INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens      INTEGER DEFAULT 0,
  latency_ms        INTEGER NOT NULL,
  cost_usd          DECIMAL(10,6) DEFAULT 0,
  success           BOOLEAN DEFAULT true,
  error_type        VARCHAR(100),
  queue_wait_ms     INTEGER,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alr_client ON ai_latency_records(client_id);
CREATE INDEX IF NOT EXISTS idx_alr_provider ON ai_latency_records(provider);
CREATE INDEX IF NOT EXISTS idx_alr_model ON ai_latency_records(model);
CREATE INDEX IF NOT EXISTS idx_alr_created ON ai_latency_records(created_at DESC);

-- System alerts
CREATE TABLE IF NOT EXISTS system_alerts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_name        VARCHAR(255) NOT NULL,
  severity          VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info', 'debug')),
  status            VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'suppressed')),
  message           TEXT NOT NULL,
  details           JSONB DEFAULT '{}',
  metric_value      DOUBLE PRECISION,
  threshold_value   DOUBLE PRECISION,
  acknowledged_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at   TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_status ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sa_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_sa_created ON system_alerts(created_at DESC);

-- Worker performance analytics
CREATE TABLE IF NOT EXISTS worker_performance (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_name       VARCHAR(255) NOT NULL,
  job_type          VARCHAR(100) NOT NULL,
  jobs_processed    INTEGER DEFAULT 0,
  jobs_failed       INTEGER DEFAULT 0,
  avg_processing_ms DOUBLE PRECISION,
  p95_processing_ms DOUBLE PRECISION,
  p99_processing_ms DOUBLE PRECISION,
  throughput_per_min DOUBLE PRECISION,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wp_worker ON worker_performance(worker_name);
CREATE INDEX IF NOT EXISTS idx_wp_recorded ON worker_performance(recorded_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- 8. ENTERPRISE SECURITY
-- ══════════════════════════════════════════════════════════════════

-- Audit log with full detail (for compliance)
CREATE TABLE IF NOT EXISTS audit_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id        VARCHAR(255),
  action            VARCHAR(255) NOT NULL,
  resource_type     VARCHAR(100),
  resource_id       VARCHAR(255),
  details           JSONB DEFAULT '{}',
  ip_address        INET,
  user_agent        TEXT,
  geo_location      JSONB DEFAULT '{}',
  severity          VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  outcome           VARCHAR(20) DEFAULT 'success' CHECK (outcome IN ('success', 'failure', 'denied')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_al_client ON audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_al_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_al_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_al_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_al_resource ON audit_log(resource_type, resource_id);

-- Permission matrix (RBAC)
CREATE TABLE IF NOT EXISTS permission_matrix (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role              VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'editor', 'client')),
  resource          VARCHAR(100) NOT NULL,
  action            VARCHAR(50) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'publish', 'approve', 'manage')),
  is_granted        BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, resource, action)
);

-- Seed default permissions
INSERT INTO permission_matrix (role, resource, action, is_granted) VALUES
  ('super_admin', '*', 'manage', true),
  ('admin', '*', 'read', true),
  ('admin', 'client', 'manage', true),
  ('admin', 'user', 'manage', true),
  ('admin', 'article', 'publish', false),
  ('editor', 'article', 'create', true),
  ('editor', 'article', 'read', true),
  ('editor', 'article', 'update', true),
  ('editor', 'article', 'approve', false),
  ('editor', 'article', 'publish', false),
  ('client', 'article', 'read', true),
  ('client', 'article', 'create', false),
  ('client', 'keyword', 'read', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- API rate limiting per client
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  requests_per_minute  INTEGER DEFAULT 60,
  requests_per_hour    INTEGER DEFAULT 1000,
  requests_per_day     INTEGER DEFAULT 10000,
  burst_limit          INTEGER DEFAULT 10,
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Secret rotation tracking
CREATE TABLE IF NOT EXISTS secret_rotation (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  secret_type       VARCHAR(50) NOT NULL CHECK (secret_type IN ('api_key', 'webhook_secret', 'jwt_secret', 'cms_token')),
  previous_value_hash VARCHAR(255),
  current_value_hash  VARCHAR(255) NOT NULL,
  rotated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  rotation_reason   TEXT,
  expires_at        TIMESTAMPTZ,
  rotated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_client ON secret_rotation(client_id);

-- ══════════════════════════════════════════════════════════════════
-- 9. ADVANCED CONTENT INTELLIGENCE
-- ══════════════════════════════════════════════════════════════════

-- Knowledge graph nodes (entities)
CREATE TABLE IF NOT EXISTS knowledge_graph_entities (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  entity_name       VARCHAR(500) NOT NULL,
  entity_type       VARCHAR(100) NOT NULL,
  description       TEXT,
  embedding         VECTOR(1536),
  metadata          JSONB DEFAULT '{}',
  source            VARCHAR(100) DEFAULT 'extracted',
  confidence        DECIMAL(5,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, entity_name)
);

CREATE INDEX IF NOT EXISTS idx_kge_client ON knowledge_graph_entities(client_id);
CREATE INDEX IF NOT EXISTS idx_kge_type ON knowledge_graph_entities(entity_type);

-- Knowledge graph relationships
CREATE TABLE IF NOT EXISTS knowledge_graph_relationships (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  source_entity_id  UUID REFERENCES knowledge_graph_entities(id) ON DELETE CASCADE,
  target_entity_id  UUID REFERENCES knowledge_graph_entities(id) ON DELETE CASCADE,
  relationship_type VARCHAR(100) NOT NULL,
  strength          DECIMAL(5,2) DEFAULT 1.0,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_kgr_client ON knowledge_graph_relationships(client_id);
CREATE INDEX IF NOT EXISTS idx_kgr_source ON knowledge_graph_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_kgr_target ON knowledge_graph_relationships(target_entity_id);

-- Content cannibalization detection
CREATE TABLE IF NOT EXISTS content_cannibalization (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_a_id      UUID REFERENCES articles(id) ON DELETE CASCADE,
  article_b_id      UUID REFERENCES articles(id) ON DELETE CASCADE,
  similarity_score  DECIMAL(5,2) NOT NULL,
  overlap_type      VARCHAR(50) CHECK (overlap_type IN ('keyword', 'topic', 'entity', 'semantic')),
  overlap_details   JSONB DEFAULT '{}',
  recommendation    TEXT,
  detected_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  UNIQUE(article_a_id, article_b_id)
);

CREATE INDEX IF NOT EXISTS idx_cc_client ON content_cannibalization(client_id);

-- Topic saturation tracking
CREATE TABLE IF NOT EXISTS topic_saturation (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  topic             VARCHAR(500) NOT NULL,
  article_count     INTEGER DEFAULT 0,
  saturation_score  DECIMAL(5,2) DEFAULT 0,
  last_article_at   TIMESTAMPTZ,
  recommendation    VARCHAR(100) DEFAULT 'continue' CHECK (recommendation IN ('continue', 'reduce', 'stop', 'diversify')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_ts_client ON topic_saturation(client_id);

-- ══════════════════════════════════════════════════════════════════
-- 10. CLOSED FEEDBACK LOOP / PERFORMANCE
-- ══════════════════════════════════════════════════════════════════

-- Performance feedback records (rankings, engagement, conversions)
CREATE TABLE IF NOT EXISTS content_performance_feedback (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id        UUID REFERENCES articles(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  metric_name       VARCHAR(100) NOT NULL,
  metric_value      DOUBLE PRECISION NOT NULL,
  change_vs_baseline DOUBLE PRECISION,
  improvement_suggestion TEXT,
  auto_improved     BOOLEAN DEFAULT false,
  regression_id     UUID,  -- link to regeneration version
  collected_at      DATE DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpf_article ON content_performance_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_cpf_metric ON content_performance_feedback(metric_name);
CREATE INDEX IF NOT EXISTS idx_cpf_collected ON content_performance_feedback(collected_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- 11. AI EVALUATION FRAMEWORK
-- ══════════════════════════════════════════════════════════════════

-- Benchmark datasets
CREATE TABLE IF NOT EXISTS benchmark_datasets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  category          VARCHAR(100) NOT NULL,
  version           VARCHAR(20) DEFAULT '1.0',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Benchmark test cases
CREATE TABLE IF NOT EXISTS benchmark_test_cases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id        UUID REFERENCES benchmark_datasets(id) ON DELETE CASCADE,
  input             TEXT NOT NULL,
  expected_output   TEXT,
  evaluation_criteria JSONB DEFAULT '{}',
  difficulty        VARCHAR(50) DEFAULT 'medium',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_btc_dataset ON benchmark_test_cases(dataset_id);

-- Evaluation results (LLM-as-a-judge or human)
CREATE TABLE IF NOT EXISTS evaluation_results (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluator_type    VARCHAR(50) NOT NULL CHECK (evaluator_type IN ('llm_judge', 'human', 'automated')),
  target_type       VARCHAR(50) NOT NULL CHECK (target_type IN ('article', 'prompt', 'keyword', 'seo')),
  target_id         UUID NOT NULL,
  criteria          VARCHAR(100) NOT NULL,
  score             DECIMAL(5,2) NOT NULL,
  confidence        DECIMAL(5,2),
  feedback          TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_er_target ON evaluation_results(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_er_criteria ON evaluation_results(criteria);

-- A/B test tracking
CREATE TABLE IF NOT EXISTS ab_tests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  article_base_id   UUID REFERENCES articles(id) ON DELETE CASCADE,
  article_variant_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  test_name         VARCHAR(255),
  status            VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled')),
  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,
  winner            UUID,
  metrics           JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_client ON ab_tests(client_id);

-- ══════════════════════════════════════════════════════════════════
-- 12. PLUGIN ECOSYSTEM ENHANCEMENTS
-- ══════════════════════════════════════════════════════════════════

-- Plugin permissions
CREATE TABLE IF NOT EXISTS plugin_permissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_id         UUID REFERENCES plugin_registry(id) ON DELETE CASCADE,
  permission        VARCHAR(100) NOT NULL CHECK (permission IN (
                      'network_access', 'filesystem_read', 'filesystem_write',
                      'database_read', 'database_write', 'env_access',
                      'webhook_send', 'execute_code', 'user_data_access'
                    )),
  is_granted        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, permission)
);

-- Plugin execution logs
CREATE TABLE IF NOT EXISTS plugin_execution_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_instance_id UUID REFERENCES plugin_instances(id) ON DELETE CASCADE,
  hook              VARCHAR(100) NOT NULL,
  status            VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timed_out')),
  duration_ms       INTEGER,
  error_message     TEXT,
  output_size_bytes INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pel_instance ON plugin_execution_logs(plugin_instance_id);
CREATE INDEX IF NOT EXISTS idx_pel_hook ON plugin_execution_logs(hook);

-- ══════════════════════════════════════════════════════════════════
-- 13. RESILIENCE & CIRCUIT BREAKERS
-- ══════════════════════════════════════════════════════════════════

-- Circuit breaker state
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_name      VARCHAR(255) NOT NULL UNIQUE,
  state             VARCHAR(20) NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count     INTEGER DEFAULT 0,
  success_count     INTEGER DEFAULT 0,
  last_failure_at   TIMESTAMPTZ,
  last_success_at   TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  threshold         INTEGER DEFAULT 5,
  recovery_timeout_seconds INTEGER DEFAULT 30,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Dead-letter queue storage
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type          VARCHAR(100) NOT NULL,
  job_data          JSONB NOT NULL,
  error_message     TEXT,
  error_stack       TEXT,
  failed_attempts   INTEGER DEFAULT 1,
  failed_at         TIMESTAMPTZ DEFAULT NOW(),
  retry_later_at    TIMESTAMPTZ,
  is_resolved       BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_dlq_type ON dead_letter_queue(job_type);
CREATE INDEX IF NOT EXISTS idx_dlq_retry ON dead_letter_queue(retry_later_at);
CREATE INDEX IF NOT EXISTS idx_dlq_resolved ON dead_letter_queue(is_resolved);

-- ══════════════════════════════════════════════════════════════════
-- VIEWS & REPORTING
-- ══════════════════════════════════════════════════════════════════

-- Editorial pipeline health view
CREATE OR REPLACE VIEW v_editorial_pipeline AS
SELECT
  e.review_type,
  e.status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (COALESCE(e.completed_at, NOW()) - e.created_at)) / 3600)::NUMERIC(10,2) as avg_hours_to_complete
FROM editorial_review_assignments e
WHERE e.created_at >= NOW() - INTERVAL '30 days'
GROUP BY e.review_type, e.status;

-- Multi-CMS publishing health view
CREATE OR REPLACE VIEW v_cms_publishing_health AS
SELECT
  cc.provider,
  cc.is_active,
  COUNT(ph.id) as total_publishes,
  COUNT(ph.id) FILTER (WHERE ph.status = 'published') as successful_publishes,
  COUNT(ph.id) FILTER (WHERE ph.status = 'failed') as failed_publishes
FROM cms_connections cc
LEFT JOIN publishing_history ph ON ph.client_id = cc.client_id
GROUP BY cc.provider, cc.is_active;

-- Fact-check summary view
CREATE OR REPLACE VIEW v_fact_check_summary AS
SELECT
  client_id,
  verification,
  COUNT(*) as count,
  AVG(confidence)::DECIMAL(5,2) as avg_confidence
FROM fact_checks
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY client_id, verification;

-- Cost efficiency view
CREATE OR REPLACE VIEW v_cost_efficiency AS
SELECT
  client_id,
  provider,
  model,
  COUNT(*) as total_calls,
  SUM(cost_usd) as total_cost,
  SUM(tokens_in + tokens_out) as total_tokens,
  AVG(duration_ms)::INT as avg_duration_ms,
  SUM(cost_usd) / NULLIF(COUNT(*), 0) as avg_cost_per_call
FROM cost_tracking
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY client_id, provider, model;

-- ══════════════════════════════════════════════════════════════════
-- INDEXES ON EXISTING TABLES (for performance)
-- ══════════════════════════════════════════════════════════════════

-- Extended articles index for editorial workflow
CREATE INDEX IF NOT EXISTS idx_articles_editorial_status ON articles(editorial_status) WHERE editorial_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_client_status ON articles(client_id, status);

-- ══════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════

-- Auto-create content version on article update
CREATE OR REPLACE FUNCTION auto_version_content()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.content_md IS DISTINCT FROM NEW.content_md) OR (OLD.title IS DISTINCT FROM NEW.title) THEN
    INSERT INTO content_versions (article_id, version_number, title, content_md, content_html, meta_title, meta_description, tags, word_count, change_summary)
    VALUES (
      NEW.id,
      (SELECT COALESCE(MAX(version_number), 0) + 1 FROM content_versions WHERE article_id = NEW.id),
      NEW.title, NEW.content_md, NEW.content_html, NEW.meta_title, NEW.meta_description, NEW.tags, NEW.word_count,
      'Auto-saved version'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_articles_auto_version ON articles;
CREATE TRIGGER trg_articles_auto_version
  AFTER UPDATE OF content_md, title ON articles
  FOR EACH ROW EXECUTE FUNCTION auto_version_content();

-- Update article editorial_status from status column for backward compat
CREATE OR REPLACE FUNCTION sync_editorial_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.editorial_status = CASE NEW.status
    WHEN 'draft' THEN 'draft'::article_editorial_status
    WHEN 'generated' THEN 'generated'::article_editorial_status
    WHEN 'in_review' THEN 'in_review'::article_editorial_status
    WHEN 'reviewed' THEN 'seo_reviewed'::article_editorial_status
    WHEN 'approved' THEN 'approved'::article_editorial_status
    WHEN 'rejected' THEN 'rejected'::article_editorial_status
    WHEN 'published' THEN 'published'::article_editorial_status
    WHEN 'failed' THEN 'failed'::article_editorial_status
    WHEN 'archived' THEN 'archived'::article_editorial_status
    ELSE 'draft'::article_editorial_status
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ══════════════════════════════════════════════════════════════════
