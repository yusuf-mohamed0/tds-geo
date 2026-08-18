// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Pool } from 'pg';
import { encrypt, mask, maybeDecrypt } from './credentialEncryption';
import { logger } from '../utils/logger';

const CIPHERTEXT_RE = /^[0-9a-f]{32}:[0-9a-f]{32}:/;

function isCiphertext(value: string | null | undefined): boolean {
  return !!value && CIPHERTEXT_RE.test(value);
}

/**
 * Idempotent startup hardening step.
 *
 * Encrypts any plaintext Shopify tokens still sitting in `clients`
 * (legacy rows, restored dumps, manual inserts) and creates the
 * credential-vault policy row per client (masked only — no plaintext)
 * that anchors the rotation/audit policy. Safe to run on every boot:
 * ciphertext rows are skipped and vault rows are upserted with NOT EXISTS.
 */
export async function hardenShopifyTokensAtBoot(pool: Pool): Promise<{
  encrypted: number;
  vaultRows: number;
}> {
  let encrypted = 0;
  let vaultRows = 0;

  try {
    const result = await pool.query(
      `SELECT id, name, slug, shopify_shop,
              shopify_token, shopify_refresh_token
       FROM clients
       WHERE is_active = true
         AND (shopify_token IS NOT NULL OR shopify_refresh_token IS NOT NULL)`
    );

    for (const row of result.rows) {
      const shop = row.shopify_shop || row.slug || row.name || 'unknown';
      const token = row.shopify_token;
      const refreshToken = row.shopify_refresh_token;

      // 1) Encrypt plaintext tokens in place (skip already-encrypted rows).
      if (token && !isCiphertext(token)) {
        await pool.query(
          `UPDATE clients SET shopify_token = $1 WHERE id = $2`,
          [encrypt(token), row.id]
        );
        encrypted++;
      }
      if (refreshToken && !isCiphertext(refreshToken)) {
        await pool.query(
          `UPDATE clients SET shopify_refresh_token = $1 WHERE id = $2`,
          [encrypt(refreshToken), row.id]
        );
      }

      // 2) Ensure a masked vault policy row exists (rotation/audit anchor).
      if (token || refreshToken) {
        const masked = mask(maybeDecrypt(token) || '') || '';
        const insert = await pool.query(
          `INSERT INTO credential_vault
             (client_id, category, service, label, masked_password, rotation_days)
           SELECT $1, 'api', 'shopify', $2, $3, 30
           WHERE NOT EXISTS (
             SELECT 1 FROM credential_vault
             WHERE client_id = $1 AND service = 'shopify' AND deleted_at IS NULL
           )
           RETURNING id`,
          [row.id, `Shopify OAuth — ${shop}`, masked]
        );
        if (insert.rows.length > 0) vaultRows++;
      }
    }

    if (encrypted > 0 || vaultRows > 0) {
      logger.info('Shopify token hardening applied at boot', { encrypted, vaultRows });
    }
    return { encrypted, vaultRows };
  } catch (err) {
    logger.warn('Shopify token hardening failed at boot (non-fatal)', {
      error: (err as Error).message,
    });
    return { encrypted, vaultRows };
  }
}
