// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from '../../utils/logger';
import { ShopifyConfig } from '../../types';
import { encrypt, maybeDecrypt } from '../credentialEncryption';

let pool: any = null;

export function init(dbPool: any): void {
  pool = dbPool;
}

export interface ForceRefreshResult {
  success: boolean;
  shop: string;
  rotatedAt: string;
  error?: string;
}

/**
 * On-demand, admin-triggered token rotation.
 *
 * Forces an OAuth refresh_token exchange for the given shop regardless of the
 * stored expiry, writes the rotated tokens back to `clients` (encrypted at
 * rest), and records an auditable 'rotate' row in credential_access_log.
 * Idempotent by nature: repeated calls re-exchange the current refresh token.
 *
 * Never throws — always resolves with a success/failure result.
 */
export async function forceRefreshToken(shop: string): Promise<ForceRefreshResult> {
  const rotatedAt = new Date().toISOString();

  if (!shop) {
    logger.warn('Shopify token rotation failed', { shop, reason: 'invalid_shop' });
    return { success: false, shop, rotatedAt, error: 'Invalid shop' };
  }

  if (!pool) {
    logger.warn('Shopify token rotation failed', { shop, reason: 'pool_not_initialized' });
    return { success: false, shop, rotatedAt, error: 'Database pool not initialized' };
  }

  try {
    const result = await pool.query(
      `SELECT shopify_token, shopify_refresh_token, shopify_token_expires_at
       FROM clients WHERE shopify_shop = $1 AND is_active = true`,
      [shop]
    );

    if (result.rows.length === 0) {
      logger.warn('Shopify token rotation failed', { shop, reason: 'no_active_client' });
      return { success: false, shop, rotatedAt, error: 'No active client for shop' };
    }

    const row = result.rows[0];

    if (!row.shopify_refresh_token) {
      logger.warn('Shopify token rotation failed', { shop, reason: 'no_refresh_token' });
      return { success: false, shop, rotatedAt, error: 'No refresh token stored' };
    }

    const refreshResp = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.SHOPIFY_API_KEY || '',
          client_secret: process.env.SHOPIFY_API_SECRET || '',
          grant_type: 'refresh_token',
          refresh_token: maybeDecrypt(row.shopify_refresh_token) || '',
        }).toString(),
      }
    );

    if (!refreshResp.ok) {
      logger.warn('Shopify token rotation failed', {
        shop,
        reason: 'rejected',
        status: refreshResp.status,
      });
      return { success: false, shop, rotatedAt, error: `Shopify refresh rejected: ${refreshResp.status}` };
    }

    const data: any = await refreshResp.json();
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    // Keep the prior stored refresh token when the refresh response omits one.
    const refreshToken = data.refresh_token ? encrypt(data.refresh_token) : row.shopify_refresh_token;

    await pool.query(
      `UPDATE clients SET shopify_token = $1, shopify_refresh_token = $2, shopify_token_expires_at = $3 WHERE shopify_shop = $4`,
      [encrypt(data.access_token), refreshToken, expiresAt, shop]
    );

    await pool.query(
      `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, metadata)
       VALUES (NULL, NULL, 'rotate', NULL, $1)`,
      [JSON.stringify({ resource: 'clients.shopify_token', shop, rotatedAt })]
    ).catch(() => {});

    logger.info('Shopify token rotated', { shop });
    return { success: true, shop, rotatedAt };
  } catch (err) {
    logger.warn('Shopify token rotation failed', { shop, error: (err as Error).message });
    return { success: false, shop, rotatedAt, error: (err as Error).message };
  }
}

export async function refreshIfExpired(shopConfig: ShopifyConfig): Promise<ShopifyConfig> {
  if (!pool || !shopConfig.shop) return shopConfig;

  const result = await pool.query(
    `SELECT shopify_token, shopify_refresh_token, shopify_token_expires_at
     FROM clients WHERE shopify_shop = $1 AND is_active = true`,
    [shopConfig.shop]
  );

  if (result.rows.length === 0) return shopConfig;

  const row = result.rows[0];

  // Always use the latest token from the database, even if not expired
  const dbToken = maybeDecrypt(row.shopify_token);
  if (dbToken && dbToken !== shopConfig.accessToken) {
    shopConfig = { ...shopConfig, accessToken: dbToken };
  }

  const now = new Date();

  if (row.shopify_refresh_token && row.shopify_token_expires_at &&
      new Date(row.shopify_token_expires_at) <= new Date(now.getTime() + 5 * 60 * 1000)) {
    try {
      const refreshResp = await fetch(
        `https://${shopConfig.shop}/admin/oauth/access_token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.SHOPIFY_API_KEY || '',
            client_secret: process.env.SHOPIFY_API_SECRET || '',
            grant_type: 'refresh_token',
            refresh_token: maybeDecrypt(row.shopify_refresh_token) || '',
          }).toString(),
        }
      );

      if (refreshResp.ok) {
        const data: any = await refreshResp.json();
        const expiresAt = data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : null;

        // Keep the prior stored refresh token when the refresh response omits one.
        const refreshToken = data.refresh_token ? encrypt(data.refresh_token) : row.shopify_refresh_token;

        await pool.query(
          `UPDATE clients SET shopify_token = $1, shopify_refresh_token = $2, shopify_token_expires_at = $3 WHERE shopify_shop = $4`,
          [encrypt(data.access_token), refreshToken, expiresAt, shopConfig.shop]
        );

        await pool.query(
          `INSERT INTO credential_access_log (credential_id, user_id, action, ip_address, metadata)
           VALUES (NULL, NULL, 'refresh', NULL, $1)`,
          [JSON.stringify({ resource: 'clients.shopify_token', shop: shopConfig.shop })]
        ).catch(() => {});

        logger.info('Shopify token refreshed', { shop: shopConfig.shop });
        return { ...shopConfig, accessToken: data.access_token };
      } else {
        logger.warn('Shopify token refresh failed, using existing token', { shop: shopConfig.shop });
      }
    } catch (err) {
      logger.warn('Shopify token refresh error, using existing token', {
        shop: shopConfig.shop,
        error: (err as Error).message,
      });
    }
  }

  return shopConfig;
}
