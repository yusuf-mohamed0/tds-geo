import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { sitesService } from '../services/sitesService';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://13.51.207.126.nip.io';
const SCOPES = 'read_content,read_products,write_content,write_products';
const WEBHOOK_API_VERSION = '2024-07';

function isValidShop(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

function generateState(): string {
  return randomBytes(16).toString('hex');
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'store';
}

export function createShopifyInstallRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/install', (req: Request, res: Response) => {
    const shop = ((req.query.shop as string) || '').trim().toLowerCase();
    if (!shop || !isValidShop(shop)) {
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=invalid_shop`);
      return;
    }

    const state = generateState();

    pool.query(
      `INSERT INTO shopify_oauth_states (state, shop, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (state) DO NOTHING`,
      [state, shop]
    ).catch(err => logger.error('Failed to store OAuth state', { error: err.message }));

    const installUrl = `https://${shop}/admin/oauth/authorize` +
      `?client_id=${SHOPIFY_API_KEY}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(`${SHOPIFY_APP_URL}/api/shopify/callback`)}` +
      `&state=${state}`;

    res.redirect(302, installUrl);
  });

  router.get('/callback', async (req: Request, res: Response) => {
    const shop = String(req.query.shop || '');
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const hmac = String(req.query.hmac || '');

    if (!shop || !code || !state || !hmac) {
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=missing_params`);
      return;
    }

    try {
      const result = await pool.query(
        'DELETE FROM shopify_oauth_states WHERE state = $1 AND created_at > NOW() - INTERVAL \'10 minutes\' RETURNING shop',
        [state]
      );
      if (result.rows.length === 0) {
        res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=invalid_state`);
        return;
      }
    } catch {
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=state_error`);
      return;
    }

    try {
      // Step 1: Exchange OAuth code for expiring access token
      const params = new URLSearchParams({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
        expiring: '1',
      });
      const tokenResp = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!tokenResp.ok) {
        const body = await tokenResp.text();
        logger.error('Shopify OAuth token exchange failed', { shop, status: tokenResp.status, body: body.substring(0, 500) });
        res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=token_exchange_failed`);
        return;
      }

      const tokenData: any = await tokenResp.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;
      const expiresIn = tokenData.expires_in || null;
      const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

      // Step 2: Save token to DB immediately
      await pool.query(
        `UPDATE clients SET shopify_token = $1, shopify_refresh_token = $2, shopify_token_expires_at = $3, is_active = true WHERE shopify_shop = $4`,
        [accessToken, refreshToken, tokenExpiresAt, shop]
      );

      // Step 3: Update CMS connection
      const clientResult = await pool.query('SELECT id FROM clients WHERE shopify_shop = $1', [shop]);
      const clientId = clientResult.rows[0]?.id;
      if (clientId) {
        const existingConn = await pool.query(
          'SELECT id FROM cms_connections WHERE client_id = $1 AND provider = \'shopify\'',
          [clientId]
        );
        const storeName = shop.replace('.myshopify.com', '').replace(/^[a-z0-9]-/, match => match.toUpperCase());
        const connConfig = JSON.stringify({ shop, accessToken, apiVersion: '2024-07' });
        if (existingConn.rows.length > 0) {
          await pool.query(
            `UPDATE cms_connections SET config = $1::jsonb, is_active = true WHERE id = $2`,
            [connConfig, existingConn.rows[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO cms_connections (client_id, label, provider, endpoint_url, config, capabilities, is_primary, is_active)
             VALUES ($1, $2, 'shopify', $3, $4::jsonb, ARRAY['publish','read'], false, true)`,
            [clientId, storeName, shop, connConfig]
          );
        }
      }

      // Step 4: Try fetching shop info (non-fatal if fails)
      let storeName = shop.replace('.myshopify.com', '');
      try {
        const shopResp = await fetch(`https://${shop}/admin/api/2024-07/shop.json`, {
          headers: { 'X-Shopify-Access-Token': accessToken }
        });
        if (shopResp.ok) {
          const shopData: any = await shopResp.json();
          storeName = shopData.shop?.name || storeName;
          await pool.query('UPDATE clients SET name = $1 WHERE shopify_shop = $2', [storeName, shop]);
        }
      } catch (shopErr) {
        logger.warn('Failed to fetch shop info (non-fatal)', { shop, error: (shopErr as Error).message });
      }

      await sitesService.register({
        platform: 'shopify',
        site_name: storeName,
        domain: shop,
        owner_name: storeName,
        connector_id: clientId,
        encrypted_credentials: accessToken,
        connection_status: 'connected',
      });

      // Step 5: Subscribe GDPR compliance webhooks (non-fatal)
      try {
        const complianceTopics = [
          { topic: 'customers/data_request', path: '/api/webhooks/compliance/customers-data-request' },
          { topic: 'customers/redact', path: '/api/webhooks/compliance/customers-redact' },
          { topic: 'shop/redact', path: '/api/webhooks/compliance/shop-redact' },
          { topic: 'app/uninstalled', path: '/api/webhooks/compliance/app-uninstalled' },
        ];
        for (const { topic, path } of complianceTopics) {
          const webhookUrl = `${SHOPIFY_APP_URL}${path}`;
          const existingRes = await fetch(`https://${shop}/admin/api/${WEBHOOK_API_VERSION}/webhooks.json?topic=${encodeURIComponent(topic)}&address=${encodeURIComponent(webhookUrl)}`, {
            headers: { 'X-Shopify-Access-Token': accessToken },
          });
          const existingData: any = await existingRes.json();
          const alreadyExists = existingData?.webhooks?.length > 0;
          if (!alreadyExists) {
            await fetch(`https://${shop}/admin/api/${WEBHOOK_API_VERSION}/webhooks.json`, {
              method: 'POST',
              headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
              body: JSON.stringify({ webhook: { topic, address: webhookUrl, format: 'json' } }),
            });
            logger.info('Compliance webhook registered', { shop, topic });
          }
        }
      } catch (webhookErr) {
        logger.warn('Failed to subscribe compliance webhooks (non-fatal)', { shop, error: (webhookErr as Error).message });
      }

      logger.info('Shopify store installed successfully', { shop, storeName });
      res.redirect(`${SHOPIFY_APP_URL}/shopify/success?shop=${encodeURIComponent(shop)}&name=${encodeURIComponent(storeName)}`);

    } catch (err: any) {
      logger.error('Shopify OAuth callback failed', {
        shop,
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 3).join('; ')
      });
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=token_exchange_failed`);
    }
  });

  return router;
}
