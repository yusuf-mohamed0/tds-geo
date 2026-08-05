-- Ensure active CMS connections are unique per client/provider for ON CONFLICT usage.
-- Idempotent: if duplicates exist, keep the most recently updated active row.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY client_id, provider
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM cms_connections
  WHERE is_active = true
)
UPDATE cms_connections
SET is_active = false,
    updated_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_connections_active_provider_per_client
  ON cms_connections (client_id, provider)
  WHERE is_active = true;
