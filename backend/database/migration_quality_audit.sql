-- Migration: Quality Evaluations + Client Audits
-- Adds tables for article output evaluation and client AI SEO audits

BEGIN;

-- Article quality evaluations (Prompt Phase 2 — output evaluator)
CREATE TABLE IF NOT EXISTS article_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  dimensions JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (article_id)
);

CREATE INDEX IF NOT EXISTS idx_article_evaluations_client ON article_evaluations(client_id);
CREATE INDEX IF NOT EXISTS idx_article_evaluations_score ON article_evaluations(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_article_evaluations_article ON article_evaluations(article_id);

-- Client AI SEO audit results (AI SEO Phase 1)
CREATE TABLE IF NOT EXISTS client_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  results JSONB NOT NULL DEFAULT '{}',
  priority_score INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_audits_client ON client_audits(client_id);
CREATE INDEX IF NOT EXISTS idx_client_audits_date ON client_audits(audit_date DESC);

COMMIT;
