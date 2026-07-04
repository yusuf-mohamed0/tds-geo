-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- AI SaaS Platform - Phase 1: Platform Expansion
-- Adds tables for full multi-tenant SaaS platform
-- ══════════════════════════════════════════════

-- ─── API Keys (per service, per client) ─────
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  service         VARCHAR(100) NOT NULL CHECK (service IN (
                    'openai', 'serpapi', 'shopify', 'google_trends',
                    'google_search_console', 'anthropic', 'stability_ai',
                    'custom'
                  )),
  label           VARCHAR(255) NOT NULL,
  key_value       VARCHAR(5000) NOT NULL,  -- encrypted at rest
  masked_value    VARCHAR(50) NOT NULL,  -- show last 4 chars only
  permissions     TEXT[] DEFAULT '{}',  -- fine-grained scopes
  is_active       BOOLEAN DEFAULT true,
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, service, label)
);

CREATE INDEX idx_api_keys_client ON api_keys(client_id);
CREATE INDEX idx_api_keys_service ON api_keys(service);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- ─── Plugin Registry ─────────────────────────
CREATE TABLE IF NOT EXISTS plugin_registry (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) UNIQUE NOT NULL,
  slug            VARCHAR(255) UNIQUE NOT NULL,
  description     TEXT,
  version         VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  author          VARCHAR(255),
  entry_point     VARCHAR(500) NOT NULL,  -- file path or npm package
  config_schema   JSONB DEFAULT '{}',  -- JSON Schema for UI config
  default_config  JSONB DEFAULT '{}',
  hooks           TEXT[] DEFAULT '{}',  -- lifecycle hooks
  dependencies    TEXT[] DEFAULT '{}',  -- plugin dependencies
  is_active       BOOLEAN DEFAULT true,
  is_system       BOOLEAN DEFAULT false,  -- core plugins cannot be disabled
  installed_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plugin_active ON plugin_registry(is_active);
CREATE INDEX idx_plugin_slug ON plugin_registry(slug);

-- ─── Plugin Instances (per client) ───────────
CREATE TABLE IF NOT EXISTS plugin_instances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_id       UUID REFERENCES plugin_registry(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  config          JSONB DEFAULT '{}',
  is_enabled      BOOLEAN DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plugin_id, client_id)
);

CREATE INDEX idx_pi_plugin ON plugin_instances(plugin_id);
CREATE INDEX idx_pi_client ON plugin_instances(client_id);

-- ─── Prompt Templates ────────────────────────
CREATE TABLE IF NOT EXISTS prompt_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) UNIQUE NOT NULL,
  description     TEXT,
  category        VARCHAR(100) DEFAULT 'general',
  system_prompt   TEXT NOT NULL,        -- the system prompt
  user_template   TEXT NOT NULL,        -- user message template with {{variables}}
  variables       TEXT[] DEFAULT '{}',  -- expected variable names
  model           VARCHAR(100) DEFAULT 'gpt-4o',
  temperature     DECIMAL(3,2) DEFAULT 0.7,
  max_tokens      INTEGER DEFAULT 2048,
  version         INTEGER DEFAULT 1,
  is_active       BOOLEAN DEFAULT true,
  is_system       BOOLEAN DEFAULT false,
  performance     JSONB DEFAULT '{"avg_score":0,"total_runs":0}',  -- self-improvement tracking
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pt_category ON prompt_templates(category);
CREATE INDEX idx_pt_active ON prompt_templates(is_active);

-- ─── Prompt Template Versions (history) ──────
CREATE TABLE IF NOT EXISTS prompt_template_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  system_prompt   TEXT NOT NULL,
  user_template   TEXT NOT NULL,
  model           VARCHAR(100),
  temperature     DECIMAL(3,2),
  max_tokens      INTEGER,
  changelog       TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, version)
);

-- ─── Chat Sessions (terminal interface) ──────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) DEFAULT 'New Session',
  context         JSONB DEFAULT '{}',  -- current working context
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cs_user ON chat_sessions(user_id);
CREATE INDEX idx_cs_active ON chat_sessions(is_active);

-- ─── Chat Messages ───────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content         TEXT NOT NULL,
  tool_calls      JSONB DEFAULT '[]',
  tool_results    JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cm_session ON chat_messages(session_id);
CREATE INDEX idx_cm_created ON chat_messages(created_at);

-- ─── System Configuration ────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key             VARCHAR(255) UNIQUE NOT NULL,
  value           JSONB NOT NULL,
  description     TEXT,
  category        VARCHAR(100) DEFAULT 'general',
  is_encrypted    BOOLEAN DEFAULT false,
  is_public       BOOLEAN DEFAULT false,  -- visible in /health
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sc_category ON system_config(category);

-- ─── Notification Settings ───────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  channel         VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'slack', 'webhook', 'in_app')),
  config          JSONB NOT NULL DEFAULT '{}',
  events          TEXT[] DEFAULT '{}',  -- which events trigger this
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, user_id, channel)
);

-- ─── Self-Improvement Logs ───────────────────
CREATE TABLE IF NOT EXISTS improvement_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category        VARCHAR(100) NOT NULL,
  metric          VARCHAR(255) NOT NULL,
  value           DECIMAL(15,4) NOT NULL,
  context         JSONB DEFAULT '{}',
  suggestion      TEXT,
  implemented     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_il_category ON improvement_logs(category);
CREATE INDEX idx_il_metric ON improvement_logs(metric);
CREATE INDEX idx_il_created ON improvement_logs(created_at);

-- ─── Seed Default System Configs ─────────────
INSERT INTO system_config (key, value, description, category, is_public) VALUES
  ('platform.name', '"AI SEO Automation"', 'Platform display name', 'general', true),
  ('platform.version', '"3.0.0"', 'Platform version', 'general', true),
  ('queue.default_concurrency', '3', 'Default BullMQ worker concurrency', 'queue', false),
  ('queue.max_attempts', '5', 'Maximum job retry attempts', 'queue', false),
  ('auth.jwt_expiry_hours', '24', 'JWT token expiration in hours', 'auth', false),
  ('auth.max_login_attempts', '5', 'Max failed login attempts before lockout', 'auth', false),
  ('content.default_min_words', '1200', 'Default minimum article word count', 'content', false),
  ('content.default_max_words', '2500', 'Default maximum article word count', 'content', false),
  ('analytics.retention_days', '365', 'Analytics data retention period', 'analytics', false),
  ('monitoring.alert_email', '""', 'System alert email address', 'monitoring', false)
ON CONFLICT (key) DO NOTHING;

-- ─── Seed Default Prompt Templates ───────────
INSERT INTO prompt_templates (name, slug, description, category, system_prompt, user_template, variables, is_system) VALUES
  (
    'SEO Blog Writer',
    'seo-blog-writer',
    'Generates SEO-optimized blog posts for Shopify stores',
    'content',
    'You are an expert SEO content writer specializing in e-commerce blog posts. Write in a professional, informative tone. Follow SEO best practices: use proper heading hierarchy (H1, H2, H3), include the primary keyword naturally, write compelling meta descriptions, and structure content for readability. Write in {{language}}.',
    'Write an SEO-optimized blog post about "{{keyword}}". Target word count: {{minWords}}-{{maxWords}} words. The audience is {{audience}}. Include: an engaging intro, 5-7 H2 sections with H3 subsections, a FAQ section with 5 questions, and a strong conclusion with CTA.\n\nBrand voice: {{brandVoice}}\nTarget keywords: {{keyword}}, {{secondaryKeywords}}',
    ARRAY['keyword', 'language', 'minWords', 'maxWords', 'audience', 'brandVoice', 'secondaryKeywords'],
    true
  ),
  (
    'Product Description Writer',
    'product-description-writer',
    'Generates compelling product descriptions',
    'content',
    'You are an expert copywriter for e-commerce product pages. Write persuasive, benefit-driven product descriptions that convert browsers into buyers. Focus on unique selling points and address customer pain points.',
    'Write a product description for "{{productName}}". Key features: {{features}}. Target audience: {{audience}}. Tone: {{tone}}. Include: a hook headline, 3 key benefits, specifications, and a call to action.',
    ARRAY['productName', 'features', 'audience', 'tone'],
    true
  ),
  (
    'Keyword Research Analyst',
    'keyword-research-analyst',
    'Analyzes and clusters keywords for SEO strategy',
    'research',
    'You are an SEO keyword research specialist. Analyze seed keywords and generate related long-tail keywords with search intent categorization.',
    'Analyze the following seed keywords for the {{industry}} industry: {{seedKeywords}}. Generate {{count}} related long-tail keywords grouped by search intent (informational, commercial, transactional, navigational). For each keyword, provide: the keyword, search intent, and a suggested article angle.',
    ARRAY['industry', 'seedKeywords', 'count'],
    true
  ),
  (
    'Content Rewriter',
    'content-rewriter',
    'Rewrites content while preserving SEO value',
    'content',
    'You are an expert content editor. Rewrite the provided content to be fresh and original while preserving all SEO value, keyword placement, and factual accuracy. Improve readability and engagement.',
    'Rewrite the following content about "{{topic}}". Make it {{tone}} in tone. Preserve all key information and {{keyword}} placement. Target length: {{targetWords}} words.\n\nOriginal content:\n{{originalContent}}',
    ARRAY['topic', 'tone', 'keyword', 'targetWords', 'originalContent'],
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Seed System Plugins ─────────────────────
INSERT INTO plugin_registry (name, slug, description, version, author, entry_point, config_schema, default_config, hooks, is_system) VALUES
  (
    'SEO Content Agent',
    'seo-content-agent',
    'Generates and optimizes SEO blog content for Shopify stores',
    '1.0.0',
    'System',
    '/plugins/seo-content-agent',
    '{"type":"object","properties":{"tone":{"type":"string","enum":["professional","conversational","educational"],"default":"educational"},"minWords":{"type":"integer","default":1200},"maxWords":{"type":"integer","default":2500},"generateImages":{"type":"boolean","default":true}}}',
    '{"tone":"educational","minWords":1200,"maxWords":2500,"generateImages":true}',
    ARRAY['before_content_generation', 'after_content_generation', 'before_publish'],
    true
  ),
  (
    'Shopify Publisher',
    'shopify-publisher',
    'Publishes articles to Shopify stores with image upload',
    '1.0.0',
    'System',
    '/plugins/shopify-publisher',
    '{"type":"object","properties":{"autoPublish":{"type":"boolean","default":false},"defaultBlogId":{"type":["integer","null"],"default":null},"generateImages":{"type":"boolean","default":true}}}',
    '{"autoPublish":false,"defaultBlogId":null,"generateImages":true}',
    ARRAY['before_publish', 'after_publish', 'on_publish_failed'],
    true
  ),
  (
    'Trend Analyzer',
    'trend-analyzer',
    'Analyzes search trends and suggests trending topics',
    '1.0.0',
    'System',
    '/plugins/trend-analyzer',
    '{"type":"object","properties":{"region":{"type":"string","default":"EG"},"updateFrequency":{"type":"string","enum":["daily","weekly","monthly"],"default":"weekly"},"maxKeywords":{"type":"integer","default":50}}}',
    '{"region":"EG","updateFrequency":"weekly","maxKeywords":50}',
    ARRAY['on_schedule', 'after_keyword_discovery'],
    true
  ),
  (
    'Content Rewriter',
    'content-rewriter-plugin',
    'Rewrites and refreshes existing content with fresh angles',
    '1.0.0',
    'System',
    '/plugins/content-rewriter',
    '{"type":"object","properties":{"rewriteFrequency":{"type":"string","enum":["never","monthly","quarterly"],"default":"quarterly"},"maxRewriteWords":{"type":"integer","default":3000}}}',
    '{"rewriteFrequency":"quarterly","maxRewriteWords":3000}',
    ARRAY['after_content_generation', 'on_content_aging'],
    true
  ),
  (
    'Analytics Tracker',
    'analytics-tracker',
    'Tracks article performance and generates SEO insights',
    '1.0.0',
    'System',
    '/plugins/analytics-tracker',
    '{"type":"object","properties":{"trackImpressions":{"type":"boolean","default":true},"trackClicks":{"type":"boolean","default":true},"reportFrequency":{"type":"string","enum":["daily","weekly","monthly"],"default":"weekly"}}}',
    '{"trackImpressions":true,"trackClicks":true,"reportFrequency":"weekly"}',
    ARRAY['on_schedule', 'after_publish', 'on_performance_update'],
    true
  )
ON CONFLICT (slug) DO NOTHING;
