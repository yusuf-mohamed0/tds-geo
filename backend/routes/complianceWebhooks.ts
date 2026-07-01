import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';
import { logger } from '../utils/logger';
import { SHOPIFY_COMPLIANCE_WEBHOOKS, verifyShopifyWebhookHmac } from '../utils/shopifyWebhook';

const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://16.192.29.174.nip.io';
const WEBHOOK_API_VERSION = '2025-07';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

function verifyHmac(rawBody: string, hmacHeader: string | undefined): boolean {
  return verifyShopifyWebhookHmac(rawBody, hmacHeader, SHOPIFY_API_SECRET);
}

function rawBodyCapture(req: Request, _res: Response, next: () => void) {
  let data = '';
  req.on('data', (chunk: Buffer) => { data += chunk.toString('utf8'); });
  req.on('end', () => {
    (req as any).rawBody = data;
    if (data) {
      try { req.body = JSON.parse(data); } catch { req.body = {}; }
    }
    next();
  });
}

function hmacMiddleware(req: Request, res: Response, next: () => void) {
  const rawBody = (req as any).rawBody || '';
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string | undefined;

  if (!verifyHmac(rawBody, hmacHeader)) {
    logger.warn('Invalid HMAC on compliance webhook', { path: req.path });
    res.status(401).json({ error: 'Invalid HMAC signature' });
    return;
  }
  next();
}

async function handleAppUninstalled(req: Request, res: Response, pool: Pool) {
  const shop = req.body?.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
  logger.info('APP_UNINSTALLED webhook received', { shop });
  try {
    await pool.query(
      `UPDATE clients SET is_active = false, billing_status = 'cancelled'
       WHERE shopify_shop = $1`,
      [shop]
    );
    await pool.query(
      `UPDATE cms_connections SET is_active = false
       WHERE provider = 'shopify' AND config->>'shop' = $1`,
      [shop]
    );
    await pool.query(
      `INSERT INTO billing_events (client_id, event_type, status, metadata)
       SELECT id, 'app_uninstalled', 'cancelled', $2::jsonb
       FROM clients WHERE shopify_shop = $1`,
      [shop, JSON.stringify({ source: 'app/uninstalled webhook' })]
    );
    logger.info('Shop deactivated after uninstall', { shop });
  } catch (err) {
    logger.error('Failed to process app uninstall', { shop, error: (err as Error).message });
  }
  res.status(200).json({ success: true });
}

async function handleCustomersDataRequest(req: Request, res: Response, pool: Pool) {
  const shop = req.body?.shop_domain || req.body?.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
  const customerId = req.body?.customer?.id || null;
  const requestId = req.body?.data_request?.id || null;
  logger.info('CUSTOMERS_DATA_REQUEST webhook received', { shop, customerId, requestId });

  try {
    // Query customer data from our system
    const articles = await pool.query(
      `SELECT id, title, created_at FROM articles
       WHERE client_id IN (SELECT id FROM clients WHERE shopify_shop = $1)
       ORDER BY created_at DESC`,
      [shop]
    );

    const result = {
      shopify_domain: shop,
      customer_id: customerId,
      request_id: requestId,
      data: {
        articles: articles.rows.map(a => ({
          id: a.id,
          title: a.title,
          created_at: a.created_at,
        })),
        article_count: articles.rows.length,
      },
      generated_at: new Date().toISOString(),
    };

    // Log the data request fulfillment
    await pool.query(
      `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
       VALUES (NULL, 'gdpr_data_request', 'compliance', 'info', $1, $2)`,
      [`GDPR data request processed for shop ${shop}, customer ${customerId}`,
       JSON.stringify({ shop, customerId, requestId, articleCount: articles.rows.length })]
    );

    res.status(200).json(result);
  } catch (err) {
    logger.error('Failed to process GDPR data request', { shop, customerId, error: (err as Error).message });
    res.status(200).json({ success: true, error: 'Internal processing error' });
  }
}

async function handleCustomersRedact(req: Request, res: Response, pool: Pool) {
  const shop = req.body?.shop_domain || req.body?.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
  const customerId = req.body?.customer?.id || null;
  logger.info('CUSTOMERS_REDACT webhook received', { shop, customerId });

  try {
    // TDS Geo does not store individual customer PII — articles are linked
    // to the shop (client), not the customer. Acknowledge and log redact request.
    await pool.query(
      `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
       VALUES (NULL, 'gdpr_customer_redact', 'compliance', 'info', $1, $2)`,
      [`GDPR customer redact processed for shop ${shop}, customer ${customerId}`,
       JSON.stringify({ shop, customerId })]
    );

    logger.info('Customer redact acknowledged', { shop, customerId, note: 'No customer PII stored by app' });
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error('Failed to process GDPR customer redact', { shop, customerId, error: (err as Error).message });
    res.status(200).json({ success: true, error: 'Internal processing error' });
  }
}

async function handleShopRedact(req: Request, res: Response, pool: Pool) {
  const shop = req.body?.shop_domain || req.body?.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
  logger.info('SHOP_REDACT webhook received', { shop });
  try {
    await pool.query(
      `UPDATE clients SET is_active = false, brand_voice = NULL
       WHERE shopify_shop = $1`,
      [shop]
    );
    await pool.query(
      `DELETE FROM articles WHERE client_id IN (SELECT id FROM clients WHERE shopify_shop = $1)`,
      [shop]
    );
    logger.info('Shop data redacted', { shop });
  } catch (err) {
    logger.error('Failed to redact shop data', { shop, error: (err as Error).message });
  }
  res.status(200).json({ success: true });
}

export function createComplianceWebhookRoutes(pool: Pool): Router {
  const router = Router();

  router.post('/subscribe', async (req: Request, res: Response) => {
    const { shop, accessToken } = req.body;
    if (!shop || !accessToken) {
      res.status(400).json({ error: 'shop and accessToken required' });
      return;
    }

    const baseUrl = `https://${shop}/admin/api/${WEBHOOK_API_VERSION}`;
    const results: { topic: string; created: boolean; error?: string }[] = [];

    for (const { topic, path } of SHOPIFY_COMPLIANCE_WEBHOOKS) {
      try {
        const webhookRes = await axios.post(`${baseUrl}/webhooks.json`, {
          webhook: {
            topic,
            address: `${SHOPIFY_APP_URL}${path}`,
            format: 'json',
          },
        }, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });
        results.push({ topic, created: webhookRes.status === 201 });
        logger.info('Compliance webhook subscribed', { shop, topic });
      } catch (err: any) {
        const errorMessage = err.response?.data?.errors?.address?.[0] || err.response?.data?.errors?.topic?.[0] || err.message;
        logger.error('Failed to subscribe webhook', { shop, topic, error: errorMessage });
        results.push({ topic, created: false, error: errorMessage });
      }
    }

    res.status(200).json({ success: true, results });
  });

  router.use(rawBodyCapture, hmacMiddleware);

  router.post('/', async (req: Request, res: Response) => {
    const topic = req.headers['x-shopify-topic'] as string || '';
    switch (topic) {
      case 'customers/data_request':
        await handleCustomersDataRequest(req, res, pool);
        break;
      case 'customers/redact':
        await handleCustomersRedact(req, res, pool);
        break;
      case 'shop/redact':
        await handleShopRedact(req, res, pool);
        break;
      case 'app/uninstalled':
        await handleAppUninstalled(req, res, pool);
        break;
      default:
        logger.warn('Unknown compliance webhook topic', { topic });
        res.status(200).json({ success: true });
    }
  });

  router.post('/app-uninstalled', (req, res) => handleAppUninstalled(req, res, pool));
  router.post('/customers-data-request', (req, res) => handleCustomersDataRequest(req, res, pool));
  router.post('/customers-redact', (req, res) => handleCustomersRedact(req, res, pool));
  router.post('/shop-redact', (req, res) => handleShopRedact(req, res, pool));

  return router;
}
