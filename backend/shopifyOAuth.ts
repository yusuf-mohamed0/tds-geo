// ──────────────────────────────────────────────
// Shopify OAuth Service
// Handles the OAuth installation flow for Shopify embedded apps
// ──────────────────────────────────────────────

import crypto from 'crypto';
import { Pool } from 'pg';
import { logger } from './utils/logger';
import { generateSlug } from './utils/stringUtils';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || '';
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_products,write_products';

// ─── Helpers ──────────────────────────────────

/**
 * Extract the myshopify.com domain from a shop name/domain.
 * Accepts: "mystore", "mystore.myshopify.com", "mystore.shopify.com"
 * Returns: "mystore.myshopify.com"
 */
function normalizeShopDomain(shop: string): string {
  let s = shop.trim().toLowerCase();
  // Remove protocol and path if present
  s = s.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
  // Extract just the subdomain + .myshopify.com
  if (s.endsWith('.myshopify.com')) return s;
  if (s.endsWith('.shopify.com')) return s.replace(/\.shopify\.com$/, '.myshopify.com');
  return `${s}.myshopify.com`;
}

/**
 * Validate that the shop domain is a legitimate myshopify.com domain.
 */
function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

// ─── State Store (in-memory, for CSRF protection) ──
// Stores OAuth state values with TTL. In production, use Redis or DB.
const stateStore = new Map<string, { createdAt: number; shop: string }>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Clean expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of stateStore) {
    if (now - value.createdAt > STATE_TTL_MS) {
      stateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Generate a random state value for CSRF protection and store it.
 */
function generateAndStoreState(shop: string): string {
  const state = crypto.randomBytes(24).toString('hex');
  stateStore.set(state, { createdAt: Date.now(), shop: normalizeShopDomain(shop) });
  return state;
}

/**
 * Validate and consume a state value from the store.
 */
function validateAndConsumeState(state: string): boolean {
  const entry = stateStore.get(state);
  if (!entry) return false;

  // Check TTL
  if (Date.now() - entry.createdAt > STATE_TTL_MS) {
    stateStore.delete(state);
    return false;
  }

  // Consume (single-use)
  stateStore.delete(state);
  return true;
}

// ─── HMAC Validation ─────────────────────────

/**
 * Validate the HMAC signature from Shopify's OAuth callback.
 *
 * Shopify generates an HMAC-SHA256 of all query params (excluding hmac itself),
 * sorted alphabetically, using the app's client secret as the key.
 */
function validateHmac(queryParams: Record<string, string>): boolean {
  const { hmac: receivedHmac, ...paramsWithoutHmac } = queryParams;

  if (!receivedHmac) {
    logger.warn('Shopify OAuth: Missing HMAC in callback');
    return false;
  }

  // Sort params alphabetically by key and build the message string
  const message = Object.keys(paramsWithoutHmac)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${paramsWithoutHmac[key]}`)
    .join('&');

  // Generate expected HMAC using the API secret
  const expectedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const receivedBuf = Buffer.from(receivedHmac);
  const expectedBuf = Buffer.from(expectedHmac);

  if (receivedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
}

// ─── Install URL Generation ──────────────────

/**
 * Build the Shopify OAuth install URL for a given shop.
 * The merchant will be redirected here to authorize the app.
 */
function buildInstallUrl(shop: string): { url: string; state: string } {
  const normalizedShop = normalizeShopDomain(shop);

  if (!isValidShopDomain(normalizedShop)) {
    throw new Error(`Invalid shop domain: ${normalizedShop}`);
  }

  const state = generateAndStoreState(normalizedShop);
  const redirectUri = `${SHOPIFY_APP_URL}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': 'per-user', // For online tokens (embedded apps)
  });

  return {
    url: `https://${normalizedShop}/admin/oauth/authorize?${params.toString()}`,
    state,
  };
}

/**
 * Build an offline-token install URL (for back-office automation).
 * Offline tokens don't expire, suitable for backend content automation.
 */
function buildOfflineInstallUrl(shop: string): { url: string; state: string } {
  const normalizedShop = normalizeShopDomain(shop);

  if (!isValidShopDomain(normalizedShop)) {
    throw new Error(`Invalid shop domain: ${normalizedShop}`);
  }

  const state = generateAndStoreState(normalizedShop);
  const redirectUri = `${SHOPIFY_APP_URL}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': '', // No value = offline token
  });

  return {
    url: `https://${normalizedShop}/admin/oauth/authorize?${params.toString()}`,
    state,
  };
}

// ─── Access Token Exchange ───────────────────

/**
 * Exchange the temporary authorization code for a permanent access token.
 * Uses Shopify's token exchange endpoint.
 */
async function exchangeAccessToken(shop: string, code: string): Promise<string | null> {
  const normalizedShop = normalizeShopDomain(shop);

  const url = `https://${normalizedShop}/admin/oauth/access_token`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Shopify OAuth: Token exchange failed', {
        status: response.status,
        shop: normalizedShop,
        error: errorText,
      });
      return null;
    }

    const data = await response.json() as { access_token?: string };
    const accessToken = data.access_token;

    if (!accessToken) {
      logger.error('Shopify OAuth: No access token in response', { shop: normalizedShop });
      return null;
    }

    return accessToken;
  } catch (err) {
    logger.error('Shopify OAuth: Token exchange error', {
      shop: normalizedShop,
      error: (err as Error).message,
    });
    return null;
  }
}

// ─── Database Operations ─────────────────────

/**
 * Store a Shopify session (shop domain + access token) in the database.
 */
async function storeSession(pool: Pool, shop: string, accessToken: string, scopes: string): Promise<void> {
  const normalizedShop = normalizeShopDomain(shop);

  await pool.query(
    `INSERT INTO shopify_sessions (shop, access_token, scopes, installed_at, last_used_at, is_active)
     VALUES ($1, $2, $3, NOW(), NOW(), true)
     ON CONFLICT (shop)
     DO UPDATE SET access_token = $2, scopes = $3, last_used_at = NOW(), is_active = true`,
    [normalizedShop, accessToken, scopes]
  );

  logger.info('Shopify OAuth: Session stored', { shop: normalizedShop });
}

/**
 * Retrieve an access token for a shop from the database.
 */
async function getAccessToken(pool: Pool, shop: string): Promise<string | null> {
  const normalizedShop = normalizeShopDomain(shop);

  const result = await pool.query(
    `SELECT access_token, scopes FROM shopify_sessions
     WHERE shop = $1 AND is_active = true
     ORDER BY last_used_at DESC LIMIT 1`,
    [normalizedShop]
  );

  if (result.rows.length === 0) return null;

  // Update last_used_at
  await pool.query(
    `UPDATE shopify_sessions SET last_used_at = NOW() WHERE shop = $1`,
    [normalizedShop]
  );

  return result.rows[0].access_token;
}

/**
 * Check if a shop has already installed the app with an active session.
 */
async function isShopInstalled(pool: Pool, shop: string): Promise<boolean> {
  const normalizedShop = normalizeShopDomain(shop);

  const result = await pool.query(
    `SELECT 1 FROM shopify_sessions WHERE shop = $1 AND is_active = true LIMIT 1`,
    [normalizedShop]
  );

  return result.rows.length > 0;
}

/**
 * Deactivate a shop's session (uninstall).
 */
async function deactivateSession(pool: Pool, shop: string): Promise<void> {
  const normalizedShop = normalizeShopDomain(shop);

  await pool.query(
    `UPDATE shopify_sessions SET is_active = false WHERE shop = $1`,
    [normalizedShop]
  );

  logger.info('Shopify OAuth: Session deactivated', { shop: normalizedShop });
}

// ─── Client Auto-Creation ────────────────────

/**
 * Ensure a client record exists for a given Shopify shop.
 * Called after successful OAuth to auto-provision a client in the system.
 */
async function ensureClientForShop(pool: Pool, shop: string, accessToken: string): Promise<{ id: string; created: boolean }> {
  const normalizedShop = normalizeShopDomain(shop);

  // Check if client already exists for this shop
  const existing = await pool.query(
    'SELECT id FROM clients WHERE shopify_shop = $1',
    [normalizedShop]
  );

  if (existing.rows.length > 0) {
    // Update the token on the existing client
    await pool.query(
      `UPDATE clients SET shopify_token = $1, updated_at = NOW() WHERE id = $2`,
      [accessToken, existing.rows[0].id]
    );
    logger.info('Shopify OAuth: Updated existing client token', {
      shop: normalizedShop,
      clientId: existing.rows[0].id,
    });
    return { id: existing.rows[0].id, created: false };
  }

  // Create a new client for this shop
  const name = normalizedShop.replace('.myshopify.com', '');
  const slug = generateSlug(name);

  const result = await pool.query(
    `INSERT INTO clients (name, slug, shopify_shop, shopify_token, shopify_api_version, is_active)
     VALUES ($1, $2, $3, $4, '2024-07', true)
     RETURNING id`,
    [name, slug, normalizedShop, accessToken]
  );

  logger.info('Shopify OAuth: Auto-created client for shop', {
    shop: normalizedShop,
    clientId: result.rows[0].id,
    name,
    slug,
  });

  return { id: result.rows[0].id, created: true };
}

/**
 * Find the client ID for a given Shopify shop domain.
 */
async function findClientIdByShop(pool: Pool, shop: string): Promise<string | null> {
  const normalizedShop = normalizeShopDomain(shop);
  const result = await pool.query(
    'SELECT id FROM clients WHERE shopify_shop = $1 AND is_active = true',
    [normalizedShop]
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// ─── Exports ─────────────────────────────────

export {
  normalizeShopDomain,
  isValidShopDomain,
  validateHmac,
  validateAndConsumeState,
  buildInstallUrl,
  buildOfflineInstallUrl,
  exchangeAccessToken,
  storeSession,
  getAccessToken,
  isShopInstalled,
  deactivateSession,
  ensureClientForShop,
  findClientIdByShop,
};
