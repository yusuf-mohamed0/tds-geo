import { logger } from '../../utils/logger';
import { ShopifyConfig } from '../../types';

let pool: any = null;

export function init(dbPool: any): void {
  pool = dbPool;
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
            refresh_token: row.shopify_refresh_token,
          }).toString(),
        }
      );

      if (refreshResp.ok) {
        const data: any = await refreshResp.json();
        const expiresAt = data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : null;

        await pool.query(
          `UPDATE clients SET shopify_token = $1, shopify_refresh_token = $2, shopify_token_expires_at = $3 WHERE shopify_shop = $4`,
          [data.access_token, data.refresh_token || row.shopify_refresh_token, expiresAt, shopConfig.shop]
        );

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
