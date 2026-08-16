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

docker compose --env-file .env -f compose.yml exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" <<'SQL'
BEGIN;

WITH latest_connection AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    endpoint_url,
    COALESCE(config->>'accessToken', config->>'access_token', config->>'token') AS token,
    COALESCE(config->>'apiVersion', '2025-07') AS api_version,
    COALESCE(config->>'shop', regexp_replace(endpoint_url, '^https?://', '')) AS shop
  FROM cms_connections
  WHERE provider = 'shopify'
    AND is_active = true
    AND COALESCE(config->>'accessToken', config->>'access_token', config->>'token') IS NOT NULL
  ORDER BY client_id, id DESC
), repaired_clients AS (
  UPDATE clients c
     SET shopify_token = COALESCE(NULLIF(c.shopify_token, ''), latest_connection.token),
         shopify_api_version = COALESCE(NULLIF(c.shopify_api_version, ''), latest_connection.api_version),
         shopify_shop = COALESCE(NULLIF(c.shopify_shop, ''), latest_connection.shop),
         is_active = true
    FROM latest_connection
   WHERE c.id = latest_connection.client_id
     AND (
       NULLIF(c.shopify_token, '') IS NULL
       OR NULLIF(c.shopify_api_version, '') IS NULL
       OR NULLIF(c.shopify_shop, '') IS NULL
       OR c.is_active = false
     )
  RETURNING c.id
), inserted_connections AS (
  INSERT INTO cms_connections (client_id, label, provider, endpoint_url, config, capabilities, is_primary, is_active)
  SELECT
    c.id,
    COALESCE(NULLIF(c.name, ''), c.slug, c.shopify_shop),
    'shopify',
    'https://' || c.shopify_shop,
    jsonb_build_object(
      'shop', c.shopify_shop,
      'accessToken', c.shopify_token,
      'apiVersion', COALESCE(NULLIF(c.shopify_api_version, ''), '2025-07')
    ),
    ARRAY['publish','read'],
    false,
    true
  FROM clients c
  WHERE NULLIF(c.shopify_shop, '') IS NOT NULL
    AND NULLIF(c.shopify_token, '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM cms_connections cc
      WHERE cc.client_id = c.id
        AND cc.provider = 'shopify'
    )
  RETURNING id
), repaired_connections AS (
  UPDATE cms_connections cc
     SET endpoint_url = 'https://' || c.shopify_shop,
         config = jsonb_set(
           jsonb_set(
             jsonb_set(COALESCE(cc.config, '{}'::jsonb), '{shop}', to_jsonb(c.shopify_shop), true),
             '{accessToken}', to_jsonb(c.shopify_token), true
           ),
           '{apiVersion}', to_jsonb(COALESCE(NULLIF(c.shopify_api_version, ''), '2025-07')), true
         ),
         is_active = true
    FROM clients c
   WHERE cc.client_id = c.id
     AND cc.provider = 'shopify'
     AND NULLIF(c.shopify_shop, '') IS NOT NULL
     AND NULLIF(c.shopify_token, '') IS NOT NULL
     AND (
       cc.is_active = false
       OR cc.endpoint_url IS DISTINCT FROM 'https://' || c.shopify_shop
       OR COALESCE(cc.config->>'accessToken', cc.config->>'access_token', cc.config->>'token') IS DISTINCT FROM c.shopify_token
       OR COALESCE(cc.config->>'apiVersion', '2025-07') IS DISTINCT FROM COALESCE(NULLIF(c.shopify_api_version, ''), '2025-07')
       OR cc.config->>'shop' IS DISTINCT FROM c.shopify_shop
     )
  RETURNING cc.id
)
SELECT
  (SELECT count(*) FROM repaired_clients) AS repaired_clients,
  (SELECT count(*) FROM inserted_connections) AS inserted_connections,
  (SELECT count(*) FROM repaired_connections) AS repaired_connections;

COMMIT;
SQL

echo "shopify_token_sync_ok"
