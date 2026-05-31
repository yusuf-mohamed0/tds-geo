// ──────────────────────────────────────────────
// Shopify Store Info & Registration Routes
// ──────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { logger, logActivity } from '../utils/logger';
import { authenticate, generateToken } from '../middleware/auth';
import { getAccessToken, findClientIdByShop, ensureClientForShop } from '../services/shopifyOAuth';

/**
 * Fetch store information from Shopify using the Admin GraphQL API.
 */
async function fetchStoreInfo(shop: string, accessToken: string) {
  const query = `
    query {
      shop {
        name
        email
        myshopifyDomain
        primaryDomain {
          url
        }
        plan {
          displayName
          partnerDevelopment
        }
        currencyCode
        timezoneAbbreviation
        ianaTimezone
        planName
        createdAt
        description
        contactEmail
        customerAccountsVersion
        moneyFormat
        weightUnit
        county
        provinceCode
      }
    }
  `;

  const response = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API error (${response.status}): ${text}`);
  }

  const data = await response.json() as { data?: { shop?: any }; errors?: any[] };
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data?.shop || null;
}

/**
 * Create Shopify store info and registration routes.
 */
export function createShopifyStoreRoutes(pool: Pool): Router {
  const router = Router();

  // ─── GET /api/shopify/store-info ────────────
  // Returns store details for the authenticated shop.
  router.get('/store-info', authenticate, async (req: Request, res: Response) => {
    try {
      const shop = (req.query.shop as string) || null;

      if (!shop) {
        res.status(400).json({ error: 'Missing shop parameter' });
        return;
      }

      const normalizedShop = shop.toLowerCase().trim();
      if (!normalizedShop.endsWith('.myshopify.com')) {
        res.status(400).json({ error: 'Invalid shop domain' });
        return;
      }

      const accessToken = await getAccessToken(pool, normalizedShop);
      if (!accessToken) {
        res.status(404).json({ error: 'Shop not installed or session expired' });
        return;
      }

      const storeInfo = await fetchStoreInfo(normalizedShop, accessToken);
      if (!storeInfo) {
        res.status(502).json({ error: 'Failed to fetch store info from Shopify' });
        return;
      }

      res.json({
        shop: normalizedShop,
        store: {
          name: storeInfo.name,
          email: storeInfo.email || storeInfo.contactEmail,
          domain: storeInfo.myshopifyDomain,
          primaryDomain: storeInfo.primaryDomain?.url,
          plan: storeInfo.plan?.displayName || storeInfo.planName || 'Unknown',
          isPartnerDev: storeInfo.plan?.partnerDevelopment || false,
          currency: storeInfo.currencyCode,
          timezone: storeInfo.ianaTimezone || storeInfo.timezoneAbbreviation,
          country: storeInfo.county,
          province: storeInfo.provinceCode,
          createdAt: storeInfo.createdAt,
          description: storeInfo.description,
          weightUnit: storeInfo.weightUnit,
          customerAccountsVersion: storeInfo.customerAccountsVersion,
        },
      });
    } catch (err) {
      logger.error('Shopify store-info error', { error: (err as Error).message });
      res.status(502).json({ error: 'Failed to retrieve store information' });
    }
  });

  // ─── POST /api/shopify/register ─────────────
  // Creates a user account for a Shopify store owner.
  // Auto-creates a client record if one doesn't exist for the shop.
  // Returns a JWT with the user's clientId for scoped access.
  router.post('/register', authenticate, async (req: Request, res: Response) => {
    try {
      const tokenUser = (req as any).user;
      const { email, password, name, shop } = req.body;

      // Validate inputs
      if (!email || !password || !name) {
        res.status(400).json({ error: 'Email, password, and name are required' });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      // Determine shop from request body or JWT (shop-based token)
      const shopDomain = shop || (tokenUser?.userId?.startsWith('shop:')
        ? tokenUser.userId.replace('shop:', '')
        : null);

      if (!shopDomain) {
        res.status(400).json({
          error: 'Shop domain is required. Please provide a shop parameter or re-install the app.',
        });
        return;
      }

      // Check for existing user with this email
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        res.status(409).json({
          error: 'A user with this email already exists. Please log in instead.',
        });
        return;
      }

      // Look up the client for this shop (should already exist from OAuth install)
      let clientId = await findClientIdByShop(pool, shopDomain);

      // If client doesn't exist yet (rare edge case), create it with the real token
      if (!clientId) {
        const accessToken = await getAccessToken(pool, shopDomain);
        if (!accessToken) {
          res.status(500).json({ error: 'No Shopify session found for this store. Please re-install the app.' });
          return;
        }
        const result = await ensureClientForShop(pool, shopDomain, accessToken);
        clientId = result.id;
      }

      if (!clientId) {
        res.status(500).json({ error: 'Failed to find or create client record for this shop' });
        return;
      }

      // Hash password and create user
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);

      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, client_id)
         VALUES ($1, $2, $3, 'client', $4)
         RETURNING id, email, name, role, client_id, created_at`,
        [email, passwordHash, name, clientId]
      );

      const user = result.rows[0];

      // Generate JWT with clientId so the user's access is scoped
      const jwt = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        clientId: user.client_id,
      });

      logger.info('Shopify registration: User account created', {
        userId: user.id,
        shop: shopDomain,
        clientId,
        role: 'client',
      });

      // Log activity so admin users can see new store owner signups
      await logActivity(pool, {
        clientId,
        action: 'shopify_store_registered',
        entityType: 'user',
        entityId: user.id,
        level: 'info',
        message: `New store owner registered: ${name} (${email}) — Store: ${shopDomain}`,
        metadata: {
          userId: user.id,
          shop: shopDomain,
          storeOwnerName: name,
          storeOwnerEmail: email,
        },
      });

      res.status(201).json({
        token: jwt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          client_id: user.client_id,
        },
        shop: shopDomain,
        clientId,
      });
    } catch (err) {
      logger.error('Shopify registration error', { error: (err as Error).message });
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  });

  return router;
}
