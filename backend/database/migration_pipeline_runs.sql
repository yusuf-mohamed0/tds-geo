-- ══════════════════════════════════════════════
-- Migration: Pipeline Runs Table
-- Stores enterprise pipeline execution snapshots
-- for history and status tracking in the UI
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword VARCHAR(500) NOT NULL,
  title VARCHAR(500),
  success BOOLEAN NOT NULL DEFAULT false,
  stages JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  pipeline_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast client-scoped history queries
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_client_id ON pipeline_runs(client_id, created_at DESC);

-- Index for single-run status lookups
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_id ON pipeline_runs(id);
