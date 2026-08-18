#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEPLOY_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

DB_USER="${DB_USER:?DB_USER is required}"
DB_NAME="${DB_NAME:?DB_NAME is required}"

# Sync ONLY non-secret fields (shop, apiVersion, endpoint_url, is_active)
# between clients and cms_connections for provider='shopify'. Token values are
# NEVER read, compared, or written here — they live only in clients, encrypted
# at rest by the application.
docker compose --env-file .env -f compose.yml exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" <<'SQL'
BEGIN;

WITH latest_connection AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    endpoint_url,
    COALESCE(config->>'apiVersion', '2025-07') AS api_version,
    COALESCE(config->>'shop', regexp_replace(endpoint_url, '^https?://', '')) AS shop
  FROM cms_connections
  WHERE provider = 'shopify'
    AND is_active = true
  ORDER BY client_id, id DESC
), repaired_clients AS (
  UPDATE clients c
     SET shopify_api_version = COALESCE(NULLIF(c.shopify_api_version, ''), latest_connection.api_version),
         shopify_shop = COALESCE(NULLIF(c.shopify_shop, ''), latest_connection.shop),
         is_active = true
    FROM latest_connection
   WHERE c.id = latest_connection.client_id
     AND (
       NULLIF(c.shopify_api_version, '') IS NULL
       OR NULLIF(c.shopify_shop, '') IS NULL
       OR c.is_active = false
     )
  RETURNING c.id
), repaired_connections AS (
  UPDATE cms_connections cc
     SET endpoint_url = 'https://' || c.shopify_shop,
         config = jsonb_set(
           jsonb_set(COALESCE(cc.config, '{}'::jsonb), '{shop}', to_jsonb(c.shopify_shop), true),
           '{apiVersion}', to_jsonb(COALESCE(NULLIF(c.shopify_api_version, ''), '2025-07')), true
         ),
         is_active = true
    FROM clients c
   WHERE cc.client_id = c.id
     AND cc.provider = 'shopify'
     AND NULLIF(c.shopify_shop, '') IS NOT NULL
     AND (
       cc.is_active = false
       OR cc.endpoint_url IS DISTINCT FROM 'https://' || c.shopify_shop
       OR COALESCE(cc.config->>'apiVersion', '2025-07') IS DISTINCT FROM COALESCE(NULLIF(c.shopify_api_version, ''), '2025-07')
       OR cc.config->>'shop' IS DISTINCT FROM c.shopify_shop
     )
  RETURNING cc.id
)
SELECT
  (SELECT count(*) FROM repaired_clients) AS repaired_clients,
  (SELECT count(*) FROM repaired_connections) AS repaired_connections;

COMMIT;
SQL

echo "shopify_token_sync_ok"