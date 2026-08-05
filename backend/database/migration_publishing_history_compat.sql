-- Publishing history compatibility migration
-- Reconciles Shopify history columns with generic CMS publishing fields.
-- Idempotent and additive: keeps existing Shopify-specific columns intact.

ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'shopify';
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS cms_connection_id UUID;
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Some installations created publishing_history from the generic CMS migration
-- first. Ensure Shopify publishing paths still have their tracking columns.
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS shopify_article_id BIGINT;
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS shopify_blog_id BIGINT;
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS published_url TEXT;
ALTER TABLE publishing_history ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'publishing_history'
      AND column_name = 'provider'
  ) THEN
    EXECUTE 'ALTER TABLE publishing_history ALTER COLUMN provider SET DEFAULT ''shopify''';
    EXECUTE 'UPDATE publishing_history SET provider = ''shopify'' WHERE provider IS NULL';
    EXECUTE 'ALTER TABLE publishing_history ALTER COLUMN provider DROP NOT NULL';
  END IF;
END $$;

-- Keep both historical schemas valid: the Shopify schema used pending/published,
-- while the enterprise CMS schema used published/updated/deleted/failed.
DO $$
DECLARE
  status_constraint_name TEXT;
BEGIN
  FOR status_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'publishing_history'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE publishing_history DROP CONSTRAINT %I', status_constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'publishing_history'::regclass
      AND conname = 'publishing_history_status_check'
  ) THEN
    ALTER TABLE publishing_history
      ADD CONSTRAINT publishing_history_status_check
      CHECK (status IN ('pending', 'published', 'failed', 'updated', 'deleted', 'success'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pub_history_provider ON publishing_history(provider);
CREATE INDEX IF NOT EXISTS idx_pub_history_external_id ON publishing_history(external_id);
