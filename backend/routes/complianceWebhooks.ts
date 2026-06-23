import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://13.48.59.201.nip.io';
const WEBHOOK_API_VERSION = '2024-07';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

function verifyHmac(rawBody: string, hmacHeader: string | undefined): boolean {
  if (!hmacHeader || !SHOPIFY_API_SECRET) return false;
  const calculated = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated, 'base64'), Buffer.from(hmacHeader, 'base64'));
  } catch {
    return false;
  }
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
      `UPDATE clients SET is_active = false, shopify_shop = NULL
       WHERE shopify_shop = $1`,
      [shop]
    );
    await pool.query(
      `UPDATE cms_connections SET is_active = false
       WHERE provider = 'shopify' AND config->>'shop' = $1`,
      [shop]
    );
    logger.info('Shop deactivated after uninstall', { shop });
  } catch (err) {
    logger.error('Failed to process app uninstall', { shop, error: (err as Error).message });
  }
  res.status(200).json({ success: true });
}

async function handleCustomersDataRequest(req: Request, res: Response, _pool: Pool) {
  const shop = req.body?.shop_domain || req.body?.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
  const customerId = req.body?.customer?.id || null;
  const requestId = req.body?.data_request?.id || null;
  logger.info('CUSTOMERS_DATA_REQUEST webhook received', { shop, customerId, requestId });
  res.status(200).json({ success: true });
}

async function handleCustomersRedact(req: Request, res: Response, _pool: Pool) {
  const shop = req.body?.shop_domain || req.body?.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
  const customerId = req.body?.customer?.id || null;
  logger.info('CUSTOMERS_REDACT webhook received', { shop, customerId });
  res.status(200).json({ success: true });
}

async function handleShopRedact(req: Request, res: Response, pool: Pool) {
  const shop = req.body?.shop_domain || req.body?.shop || req.headers['x-shopify-shop-domain'] || 'unknown';
  logger.info('SHOP_REDACT webhook received', { shop });
  try {
    await pool.query(
      `UPDATE clients SET is_active = false, shopify_shop = NULL, brand_voice = NULL
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
    const complianceTopics = [
      { topic: 'customers/data_request', path: '/api/webhooks/compliance/customers-data-request' },
      { topic: 'customers/redact', path: '/api/webhooks/compliance/customers-redact' },
      { topic: 'shop/redact', path: '/api/webhooks/compliance/shop-redact' },
    ];

    const results: { topic: string; created: boolean; error?: string }[] = [];

    for (const { topic, path } of complianceTopics) {
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
