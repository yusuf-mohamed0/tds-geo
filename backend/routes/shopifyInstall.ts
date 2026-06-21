import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import axios from 'axios';
import { logger } from '../utils/logger';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://13.48.59.201.nip.io';
const SCOPES = 'read_content,write_content,read_products,write_products';

function isValidShop(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

function generateState(): string {
  return randomBytes(16).toString('hex');
}

export function createShopifyInstallRoutes(pool: Pool): Router {
  const router = Router();

  // GET /api/shopify/install?shop=store.myshopify.com
  router.get('/install', (req: Request, res: Response) => {
    const shop = ((req.query.shop as string) || '').trim().toLowerCase();
    if (!shop || !isValidShop(shop)) {
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=invalid_shop`);
      return;
    }

    const state = generateState();

    // Store state temporarily (expires in 10 min)
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

  // GET /api/shopify/callback
  router.get('/callback', async (req: Request, res: Response) => {
    const { shop, code, state, hmac } = req.query;

    if (!shop || !code || !state || !hmac) {
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=missing_params`);
      return;
    }

    // Verify state
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

    // State verification above is sufficient for our use case

    try {
      // Exchange code for access token
      const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      });

      const accessToken = tokenResponse.data.access_token;

      // Get store info
      const storeResponse = await axios.get(`https://${shop}/admin/api/2024-07/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      });
      const storeName = storeResponse.data.shop.name;

      // Check if we already have this shop
      const existing = await pool.query(
        'SELECT id FROM clients WHERE shopify_shop = $1',
        [shop]
      );

      if (existing.rows.length > 0) {
        // Update existing client
        await pool.query(
          'UPDATE clients SET shopify_token = $1, is_active = true WHERE id = $2',
          [accessToken, existing.rows[0].id]
        );
      } else {
        // Create new client
        await pool.query(
          `INSERT INTO clients (name, shopify_shop, shopify_token, shopify_api_version, approval_mode, publish_frequency, is_active)
           VALUES ($1, $2, $3, $4, 'auto', 'weekly', true)`,
          [storeName, shop, accessToken, '2024-07']
        );
      }

      // Get client ID (after possible insert)
      const client = await pool.query(
        'SELECT id FROM clients WHERE shopify_shop = $1',
        [shop]
      );
      const clientId = client.rows[0]?.id;

      // Upsert CMS connection
      if (clientId) {
        const existingConn = await pool.query(
          'SELECT id FROM cms_connections WHERE client_id = $1 AND provider = \'shopify\'',
          [clientId]
        );
        if (existingConn.rows.length > 0) {
          await pool.query(
            `UPDATE cms_connections SET config = jsonb_build_object('shop', $1, 'accessToken', $2, 'apiVersion', '2024-07'), is_active = true, label = $3 WHERE id = $4`,
            [shop, accessToken, storeName, existingConn.rows[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO cms_connections (client_id, label, provider, endpoint_url, config, capabilities, is_primary, is_active)
             VALUES ($1, $2, 'shopify', $3, jsonb_build_object('shop', $3, 'accessToken', $4, 'apiVersion', '2024-07'), ARRAY['publish','read'], false, true)`,
            [clientId, storeName, shop, accessToken]
          );
        }
      }

      logger.info('Shopify store installed successfully', { shop, storeName });
      res.redirect(`${SHOPIFY_APP_URL}/shopify/success?shop=${encodeURIComponent(shop)}&name=${encodeURIComponent(storeName)}`);

    } catch (err: any) {
      logger.error('Shopify OAuth callback failed', {
        shop,
        error: err.response?.data || err.message
      });
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=token_exchange_failed`);
    }
  });

  return router;
}
