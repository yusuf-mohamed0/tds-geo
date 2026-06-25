import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://13.48.59.201.nip.io';

const PLANS: Record<string, { name: string; amount: number; interval: 'EVERY_30_DAYS' | 'ANNUAL' }> = {
  starter: { name: 'Starter', amount: 2900, interval: 'EVERY_30_DAYS' },
  professional: { name: 'Professional', amount: 7900, interval: 'EVERY_30_DAYS' },
  enterprise: { name: 'Enterprise', amount: 19900, interval: 'EVERY_30_DAYS' },
};

async function shopifyGraphQL(shop: string, accessToken: string, query: string, variables?: Record<string, any>) {
  const res = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export function createBillingRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/plans', (_req: Request, res: Response) => {
    res.json({
      success: true,
      plans: Object.entries(PLANS).map(([key, plan]) => ({
        id: key,
        name: plan.name,
        amount: plan.amount,
        interval: plan.interval === 'EVERY_30_DAYS' ? 'monthly' : 'annual',
      })),
    });
  });

  router.post('/create', async (req: Request, res: Response) => {
    const { shop, plan: planId, returnUrl } = req.body;
    if (!shop || !planId) {
      res.status(400).json({ error: 'shop and plan required' });
      return;
    }

    const plan = PLANS[planId];
    if (!plan) {
      res.status(400).json({ error: `Unknown plan: ${planId}` });
      return;
    }

    try {
      const clientResult = await pool.query(
        'SELECT id, shopify_token, shopify_shop FROM clients WHERE shopify_shop = $1 AND is_active = true',
        [shop]
      );
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Client not found. Install the app first.' });
        return;
      }

      const client = clientResult.rows[0];
      const accessToken = client.shopify_token;

      const mutation = `
        mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!, $test: Boolean) {
          appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
            confirmationUrl
            appSubscription {
              id
              name
              status
            }
            userErrors { field message }
          }
        }
      `;

      const isDevStore = shop.includes('development') || shop.includes('test');
      const result = await shopifyGraphQL(shop, accessToken, mutation, {
        name: `TDS Geo - ${plan.name}`,
        returnUrl: returnUrl || `${SHOPIFY_APP_URL}/api/billing/callback?shop=${encodeURIComponent(shop)}&plan=${planId}`,
        lineItems: [{
          plan: { appRecurringPricingDetails: { interval: plan.interval, price: { amount: plan.amount / 100, currencyCode: 'USD' } } },
        }],
        test: isDevStore,
      });

      if (result.errors || result.data?.appSubscriptionCreate?.userErrors?.length > 0) {
        const errors = result.errors || result.data?.appSubscriptionCreate?.userErrors;
        logger.error('Billing creation failed', { shop, plan: planId, errors });
        res.status(400).json({ error: 'Failed to create subscription', details: errors });
        return;
      }

      const { confirmationUrl, appSubscription } = result.data.appSubscriptionCreate;

      await pool.query(
        `INSERT INTO billing_events (client_id, event_type, plan, subscription_id, status, metadata)
         VALUES ($1, 'subscription_created', $2, $3, $4, $5)`,
        [client.id, planId, appSubscription?.id || null, 'pending',
         JSON.stringify({ confirmationUrl, shop, isDevStore })]
      );

      res.json({
        success: true,
        confirmationUrl,
        subscription: appSubscription,
      });
    } catch (err) {
      logger.error('Billing creation error', { shop, plan: planId, error: (err as Error).message });
      res.status(500).json({ error: 'Internal server error', message: (err as Error).message });
    }
  });

  router.get('/callback', async (req: Request, res: Response) => {
    const { shop, plan } = req.query;
    const chargeId = req.query.charge_id ? parseInt(req.query.charge_id as string, 10) : null;

    if (!shop) {
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=billing_missing_params`);
      return;
    }

    try {
      const clientResult = await pool.query(
        'SELECT id, shopify_token FROM clients WHERE shopify_shop = $1',
        [shop]
      );
      if (clientResult.rows.length === 0) {
        res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=billing_no_client`);
        return;
      }

      const client = clientResult.rows[0];
      const accessToken = client.shopify_token;

      // Confirm the charge via GraphQL
      if (chargeId) {
        const query = `
          query {
            node(id: "gid://shopify/AppSubscription/${chargeId}") {
              ... on AppSubscription {
                id
                status
                createdAt
              }
            }
          }
        `;
        const result = await shopifyGraphQL(shop, accessToken, query);

        const status = result.data?.node?.status || 'ACTIVE';
        if (status === 'ACTIVE') {
          await pool.query(
            `UPDATE clients SET billing_status = 'active', billing_plan = $1, shopify_charge_id = $2, billing_activated_at = NOW()
             WHERE id = $3`,
            [plan || 'starter', chargeId, client.id]
          );

          await pool.query(
            `INSERT INTO billing_events (client_id, event_type, plan, charge_id, status)
             VALUES ($1, 'subscription_activated', $2, $3, 'active')`,
            [client.id, plan || 'starter', chargeId]
          );

          logger.info('Billing activated', { shop, plan, chargeId });
          res.redirect(`${SHOPIFY_APP_URL}/shopify/success?shop=${encodeURIComponent(shop as string)}&billing=active`);
        } else {
          logger.warn('Billing not active', { shop, chargeId, status });
          res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=billing_not_active`);
        }
      } else {
        // No charge_id means test mode — activate immediately
        await pool.query(
          `UPDATE clients SET billing_status = 'active', billing_plan = $1, billing_activated_at = NOW()
           WHERE id = $2`,
          [plan || 'starter', client.id]
        );
        logger.info('Billing activated (test)', { shop, plan });
        res.redirect(`${SHOPIFY_APP_URL}/shopify/success?shop=${encodeURIComponent(shop as string)}&billing=active`);
      }
    } catch (err) {
      logger.error('Billing callback error', { shop, error: (err as Error).message });
      res.redirect(`${SHOPIFY_APP_URL}/shopify/error?msg=billing_callback_error`);
    }
  });

  router.get('/status', async (req: Request, res: Response) => {
    const shop = req.query.shop as string;
    if (!shop) {
      res.status(400).json({ error: 'shop query parameter required' });
      return;
    }

    try {
      const result = await pool.query(
        `SELECT billing_status, billing_plan, billing_activated_at, shopify_subscription_id
         FROM clients WHERE shopify_shop = $1`,
        [shop]
      );

      if (result.rows.length === 0) {
        res.json({ success: true, status: 'not_installed' });
        return;
      }

      const billing = result.rows[0];
      res.json({
        success: true,
        status: billing.billing_status || 'pending',
        plan: billing.billing_plan || 'starter',
        activatedAt: billing.billing_activated_at,
        subscriptionId: billing.shopify_subscription_id,
        plans: Object.entries(PLANS).map(([key, p]) => ({
          id: key, name: p.name, amount: p.amount,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
