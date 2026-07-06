-- Migration 006: Add scheduled_at for auto-publishing support
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_articles_scheduled_at ON articles (scheduled_at) WHERE status = 'approved' AND published_at IS NULL;
