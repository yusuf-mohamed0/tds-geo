-- ──────────────────────────────────────────────────────────
-- Migration Tracking System
-- Tracks which migrations have been applied and when.
-- Run ONCE to create the tracking infrastructure.
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  hash VARCHAR(64) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error TEXT
);

-- Migration status view
CREATE OR REPLACE VIEW _migration_status AS
SELECT
  filename,
  applied_at,
  duration_ms,
  success,
  CASE
    WHEN success IS NULL THEN 'pending'
    WHEN success = true THEN 'applied'
    ELSE 'failed'
  END AS status
FROM _migrations
ORDER BY applied_at DESC;

-- Apply a migration with tracking
CREATE OR REPLACE FUNCTION _apply_migration(m_filename TEXT, m_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  start_ts TIMESTAMP;
  sql_content TEXT;
BEGIN
  -- Check if already applied
  IF EXISTS (SELECT 1 FROM _migrations WHERE filename = m_filename AND success = true) THEN
    RAISE NOTICE 'Migration already applied: %', m_filename;
    RETURN true;
  END IF;

  start_ts := clock_timestamp();

  BEGIN
    -- Read and execute the migration file
    sql_content := pg_read_file(m_filename);
    EXECUTE sql_content;

    -- Record success
    INSERT INTO _migrations (filename, hash, duration_ms, success)
    VALUES (m_filename, m_hash, EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, true);

    RAISE NOTICE 'Migration applied: %', m_filename;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    -- Record failure
    INSERT INTO _migrations (filename, hash, duration_ms, success, error)
    VALUES (m_filename, m_hash, EXTRACT(EPOCH FROM (clock_timestamp() - start_ts)) * 1000, false, SQLERRM);

    RAISE WARNING 'Migration failed: % — %', m_filename, SQLERRM;
    RETURN false;
  END;
END;
$$;
