// ──────────────────────────────────────────────
// Shopify OAuth Routes
// Handles the installation flow (start + callback)
// Routes are registered EXTERNALLY to /api/ for Shopify compliance
// ──────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { generateToken } from '../middleware/auth';import { normalizeShopDomain,
  isValidShopDomain,
  validateHmac,
  validateAndConsumeState,
  buildInstallUrl,
  exchangeAccessToken,
  storeSession,
  getAccessToken,
  isShopInstalled,
  ensureClientForShop,
} from '../services/shopifyOAuth';

const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || '';
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_products,write_products';

/**
 * Generate a JWT for a shop-based session (used in embedded admin mode).
 * Creates a synthetic user payload tied to the shop domain.
 * Looks up the clientId from the database for scoped access.
 */
async function generateShopJwt(shop: string, pool?: Pool): Promise<string> {
  const normalizedShop = normalizeShopDomain(shop);
  let clientId: string | undefined = undefined;

  // Look up the client ID if we have a DB connection
  if (pool) {
    try {
      const result = await pool.query(
        'SELECT id FROM clients WHERE shopify_shop = $1 AND is_active = true',
        [normalizedShop]
      );
      if (result.rows.length > 0) {
        clientId = result.rows[0].id;
      }
    } catch {
      // Non-fatal — continue without clientId
    }
  }

  return generateToken({
    userId: `shop:${normalizedShop}`,
    email: `admin@${normalizedShop}`,
    role: 'admin',
    clientId,
  });
}

/**
 * Create Shopify OAuth routes attached to the provided DB pool.
 * These are mounted at the app level (not under /api/).
 */
export function createShopifyAuthRoutes(pool: Pool): Router {
  const router = Router();

  // ─── GET /auth ──────────────────────────────
  // Start the Shopify OAuth installation flow.
  // Expects ?shop=mystore.myshopify.com or ?shop=mystore
  //
  // If the store is already installed:
  //   -> Generate a JWT, redirect directly back to the app with token
  // Otherwise:
  //   -> Redirect to Shopify's OAuth authorization page
  router.get('/', async (req: Request, res: Response) => {
    try {
      const rawShop = (req.query.shop as string || '').trim().toLowerCase();
      const host = req.query.host as string | undefined;

      if (!rawShop) {
        logger.warn('Shopify OAuth: Missing shop parameter');
        res.redirect(`${SHOPIFY_APP_URL}/?error=missing_shop`);
        return;
      }

      const shop = rawShop.endsWith('.myshopify.com') ? rawShop : `${rawShop}.myshopify.com`;

      if (!isValidShopDomain(shop)) {
        logger.warn('Shopify OAuth: Invalid shop domain', { shop: rawShop });
        res.redirect(`${SHOPIFY_APP_URL}/?error=invalid_shop`);
        return;
      }

      // Check if this shop has already installed the app
      const installed = await isShopInstalled(pool, shop);

      if (installed) {
        logger.info('Shopify OAuth: Shop already installed, issuing JWT', { shop });

        // Ensure a client record exists for this shop (backfills pre-existing installs)
        try {
          const accessToken = await getAccessToken(pool, shop);
          if (accessToken) {
            await ensureClientForShop(pool, shop, accessToken);
          }
        } catch (clientErr) {
          // Non-fatal
          logger.warn('Shopify OAuth: Failed to ensure client for returning shop', {
            shop,
            error: (clientErr as Error).message,
          });
        }

        // Generate a JWT for the shop so the frontend can authenticate
        const token = await generateShopJwt(shop, pool);

        // Redirect with token — include host for embedded SPA navigation
        let redirectUrl: string;
        if (host) {
          redirectUrl = `${SHOPIFY_APP_URL}/?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}&embedded=1&token=${encodeURIComponent(token)}`;
        } else {
          redirectUrl = `${SHOPIFY_APP_URL}/?shop=${encodeURIComponent(shop)}&token=${encodeURIComponent(token)}`;
        }

        res.redirect(redirectUrl);
        return;
      }

      // Build OAuth install URL with CSRF state
      const { url: installUrl } = buildInstallUrl(shop);
      logger.info('Shopify OAuth: Redirecting to install', { shop });

      res.redirect(302, installUrl);
    } catch (err) {
      logger.error('Shopify OAuth: Failed to start installation', {
        error: (err as Error).message,
      });
      res.redirect(`${SHOPIFY_APP_URL}/?error=installation_failed`);
    }
  });

  // ─── GET /auth/callback ─────────────────────
  // Handle the OAuth callback from Shopify after the merchant authorizes.
  // Validates HMAC, validates state (CSRF), exchanges code for token,
  // saves session, issues JWT, redirects to frontend.
  router.get('/callback', async (req: Request, res: Response) => {
    try {
      const queryParams = req.query as Record<string, string>;
      const { shop, code, hmac, timestamp, state, host } = queryParams;

      // ── Step 1: Validate required params ──
      if (!shop || !code || !hmac || !timestamp || !state) {
        logger.warn('Shopify OAuth: Missing required callback params', {
          hasShop: !!shop,
          hasCode: !!code,
          hasHmac: !!hmac,
          hasTimestamp: !!timestamp,
          hasState: !!state,
        });
        res.redirect(`${SHOPIFY_APP_URL}/?error=invalid_callback`);
        return;
      }

      // ── Step 2: Validate CSRF state ──
      if (!validateAndConsumeState(state)) {
        logger.warn('Shopify OAuth: Invalid or expired state (CSRF)', { shop, state: state.substring(0, 8) + '...' });
        res.redirect(`${SHOPIFY_APP_URL}/?error=csrf_invalid`);
        return;
      }

      // ── Step 3: Validate HMAC ──
      if (!validateHmac(queryParams)) {
        logger.warn('Shopify OAuth: HMAC validation failed', { shop });
        res.redirect(`${SHOPIFY_APP_URL}/?error=hmac_invalid`);
        return;
      }

      // ── Step 4: Validate shop domain ──
      const normalizedShop = normalizeShopDomain(shop);
      if (!isValidShopDomain(normalizedShop)) {
        logger.warn('Shopify OAuth: Invalid shop domain in callback', { shop });
        res.redirect(`${SHOPIFY_APP_URL}/?error=invalid_shop`);
        return;
      }

      // ── Step 5: Check if already installed (reinstallation) ──
      const alreadyInstalled = await isShopInstalled(pool, normalizedShop);
      if (alreadyInstalled) {
        logger.info('Shopify OAuth: Re-installation detected, updating token', { shop: normalizedShop });
      }

      // ── Step 6: Exchange code for access token ──
      const accessToken = await exchangeAccessToken(normalizedShop, code);

      if (!accessToken) {
        logger.error('Shopify OAuth: Failed to obtain access token', { shop: normalizedShop });
        res.redirect(`${SHOPIFY_APP_URL}/?error=token_exchange_failed`);
        return;
      }

      // ── Step 7: Store the session ──
      await storeSession(pool, normalizedShop, accessToken, SHOPIFY_SCOPES);

      // ── Step 7b: Auto-create a client record for this shop (if not exists) ──
      try {
        await ensureClientForShop(pool, normalizedShop, accessToken);
      } catch (clientErr) {
        // Non-fatal: client creation failure shouldn't break OAuth
        logger.warn('Shopify OAuth: Failed to auto-create client', {
          shop: normalizedShop,
          error: (clientErr as Error).message,
        });
      }

      // ── Step 8: Issue JWT for the shop ──
      const jwt = await generateShopJwt(normalizedShop, pool);

      logger.info('Shopify OAuth: Installation successful', {
        shop: normalizedShop,
        scopes: SHOPIFY_SCOPES,
      });

      // ── Step 9: Redirect to frontend with JWT ──
      // Include just_installed=1 so the frontend shows the welcome page
      const redirectUrl = host
        ? `${SHOPIFY_APP_URL}/?shop=${encodeURIComponent(normalizedShop)}&host=${encodeURIComponent(host)}&embedded=1&token=${encodeURIComponent(jwt)}&just_installed=1`
        : `${SHOPIFY_APP_URL}/?shop=${encodeURIComponent(normalizedShop)}&token=${encodeURIComponent(jwt)}&just_installed=1`;

      res.redirect(redirectUrl);
    } catch (err) {
      logger.error('Shopify OAuth: Callback processing failed', {
        error: (err as Error).message,
      });
      res.redirect(`${SHOPIFY_APP_URL}/?error=callback_failed`);
    }
  });

  return router;
}
