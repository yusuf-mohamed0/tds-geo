-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- Shopify token encryption hardening
--  - Widen clients.shopify_token / shopify_refresh_token to TEXT
--    (aes-256-gcm ciphertext is 66 + 2×len chars and overflows VARCHAR(255))
--  - Remove raw token JSON from cms_connections.config
--  - Allow 'refresh' in credential_access_log.action for token-refresh audit
-- All statements are idempotent and safe to re-run.
-- ══════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'shopify_token'
  ) THEN
    ALTER TABLE clients ALTER COLUMN shopify_token TYPE TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'shopify_refresh_token'
  ) THEN
    ALTER TABLE clients ALTER COLUMN shopify_refresh_token TYPE TEXT;
  END IF;
END $$;

UPDATE cms_connections
   SET config = config - 'accessToken' - 'access_token' - 'token'
 WHERE provider = 'shopify'
   AND (config ? 'accessToken' OR config ? 'access_token' OR config ? 'token');

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'credential_access_log'
  ) THEN
    SELECT conname INTO constraint_name
      FROM pg_constraint
     WHERE conrelid = 'credential_access_log'::regclass
       AND contype = 'c'
     LIMIT 1;

    IF constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE credential_access_log DROP CONSTRAINT %I', constraint_name);
    END IF;

    EXECUTE 'ALTER TABLE credential_access_log ADD CONSTRAINT credential_access_log_action_check CHECK (action IN (''view'',''create'',''update'',''delete'',''rotate'',''export'',''import'',''refresh''))';
  END IF;
END $$;