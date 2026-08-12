-- Align prompt/self-improvement tables with the live route and service code.
-- Safe to run repeatedly on restored or partially migrated databases.

ALTER TABLE prompt_templates
  ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS performance JSONB DEFAULT '{"avgScore":0,"totalRuns":0}',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

WITH generated AS (
  SELECT
    id,
    NULLIF(regexp_replace(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), '-+', '-', 'g'), '') as base_slug
  FROM prompt_templates
  WHERE slug IS NULL OR slug = ''
), numbered AS (
  SELECT
    id,
    COALESCE(base_slug, 'prompt') || CASE
      WHEN row_number() OVER (PARTITION BY COALESCE(base_slug, 'prompt') ORDER BY id) = 1 THEN ''
      ELSE '-' || row_number() OVER (PARTITION BY COALESCE(base_slug, 'prompt') ORDER BY id)::text
    END as generated_slug
  FROM generated
)
UPDATE prompt_templates pt
SET slug = numbered.generated_slug
FROM numbered
WHERE pt.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_templates_slug_unique
  ON prompt_templates(slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pt_active ON prompt_templates(is_active);

CREATE TABLE IF NOT EXISTS prompt_template_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL,
  user_template TEXT NOT NULL,
  model VARCHAR(100),
  temperature DECIMAL(3,2),
  max_tokens INTEGER,
  changelog TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ptv_template ON prompt_template_versions(template_id);

ALTER TABLE improvement_logs
  ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}';
