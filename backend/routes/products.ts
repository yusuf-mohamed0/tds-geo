// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import ollamaService from '../services/ollama';
import shopifyService from '../services/shopify';

function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()); } catch {}
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const cleaned = objMatch[0]
        .replace(/[\u0000-\u001F]+/g, ' ')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\n\s*/g, ' ');
      return JSON.parse(cleaned);
    } catch {}
  }
  return null;
}

function buildProductPrompt(product: any): string {
  return `Generate SEO-optimized product content for:
Product Name: ${product.name}
Type: ${product.type || 'Product'}
Vendor: ${product.vendor || ''}
Tags: ${product.tags || ''}
Existing description: ${(product.existingDesc || '').slice(0, 200) || 'none'}`;
}

const SHOPIFY_DESCRIPTION_PROMPT = `You are a senior e-commerce copywriter. Return ONLY valid JSON, no markdown:
{
  "description": "HTML product description with <h2> sections. 300-500 words.",
  "shortDescription": "2-3 sentence summary, HTML allowed",
  "metaTitle": "SEO title max 60 chars",
  "metaDescription": "Meta description max 155 chars"
}`;

export function createProductRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate);

  // List products (auto-detects Shopify vs WooCommerce)
  router.get('/list/:clientId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const isShopify = req.query.provider === 'shopify';

      if (isShopify) {
        const clientResult = await pool.query(
          'SELECT shopify_shop, shopify_token, shopify_api_version, name FROM clients WHERE id = $1 AND is_active = true',
          [clientId]
        );
        if (clientResult.rows.length === 0) {
          res.status(404).json({ error: 'Active client not found' });
          return;
        }
        const client = clientResult.rows[0];
        if (!client.shopify_shop || !client.shopify_token) {
          res.json({ products: [], provider: 'shopify', message: 'Shopify not configured' });
          return;
        }
        const products = await shopifyService.fetchProducts(
          { shop: client.shopify_shop, accessToken: client.shopify_token, apiVersion: client.shopify_api_version },
          { fields: 'id,title,handle,body_html,product_type,vendor,tags,status,published_at,images' }
        );
        res.json({
          products: products.map(p => ({
            id: p.id,
            title: p.title,
            hasDescription: (p.body_html || '').length > 20,
            productType: p.product_type,
            vendor: p.vendor,
            status: p.status,
            hasImage: (p.images || []).length > 0,
            provider: 'shopify',
          })),
          provider: 'shopify',
          clientName: client.name,
        });
      } else {
        // WooCommerce via CMS connections
        const cmsResult = await pool.query(
          `SELECT * FROM cms_connections WHERE client_id = $1 AND provider = 'woocommerce' AND is_active = true`,
          [clientId]
        );
        const connections = cmsResult.rows;
        if (connections.length === 0) {
          res.json({ products: [], provider: 'woocommerce', message: 'No WooCommerce connection found' });
          return;
        }
        const products: any[] = [];
        for (const conn of connections) {
          try {
            const wpRes = await fetch(
              `${conn.endpoint_url}/wp-json/tds-geo/v1/posts?post_type=product&limit=100`,
              { headers: { 'X-TDS-GEO-Key': conn.api_key || '' } }
            );
            if (wpRes.ok) {
              const d = await wpRes.json();
              const items = (d.data || []).filter(p => p.type === 'product');
              for (const p of items) {
                products.push({
                  id: p.id,
                  title: p.title || '',
                  hasDescription: (p.content || '').length > 20,
                  slug: p.slug || '',
                  connectionId: conn.id,
                  provider: 'woocommerce',
                });
              }
            }
          } catch (err) {
            logger.warn('Failed to fetch products from CMS', {
              connectionId: conn.id,
              error: (err as Error).message,
            });
          }
        }
        res.json({ products, provider: 'woocommerce', connections: connections.map(c => ({ id: c.id, label: c.label })) });
      }
    } catch (err) {
      next(err);
    }
  });

  // Generate product description
  router.post('/generate/:clientId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const { productName, productInfo, provider } = req.body;

      if (!productName) {
        res.status(400).json({ error: 'productName is required' });
        return;
      }

      const clientResult = await pool.query(
        'SELECT * FROM clients WHERE id = $1 AND is_active = true', [clientId]
      );
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Active client not found' });
        return;
      }

      const prompt = buildProductPrompt({ name: productName, ...productInfo });
      const template = provider === 'shopify' ? SHOPIFY_DESCRIPTION_PROMPT : undefined;

      const { content: raw } = await ollamaService.generateBlogPost({
        keyword: productName,
        promptTemplate: template,
        tone: 'professional',
        clientSettings: clientResult.rows[0].settings || {},
      });

      const parsed = extractJSON(raw);
      if (!parsed) {
        res.status(500).json({ error: 'AI returned unparseable response', raw: raw.slice(0, 500) });
        return;
      }

      res.json({
        success: true,
        data: {
          productName,
          description: parsed.description,
          shortDescription: parsed.shortDescription,
          metaTitle: (parsed.metaTitle || '').slice(0, 60),
          metaDescription: (parsed.metaDescription || '').slice(0, 155),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Update product on Shopify
  router.put('/update/:clientId/shopify/:productId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId, productId } = req.params;
      const { description, metaTitle, metaDescription, tags } = req.body;

      const clientResult = await pool.query(
        'SELECT shopify_shop, shopify_token, shopify_api_version FROM clients WHERE id = $1 AND is_active = true',
        [clientId]
      );
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Active client not found' });
        return;
      }
      const client = clientResult.rows[0];
      if (!client.shopify_shop) {
        res.status(400).json({ error: 'Client does not have Shopify configured' });
        return;
      }

      const result = await shopifyService.updateProduct(
        { shop: client.shopify_shop, accessToken: client.shopify_token, apiVersion: client.shopify_api_version },
        parseInt(productId),
        { bodyHtml: description, metaTitle, metaDescription, tags }
      );

      res.json({ success: true, data: { id: result.id, title: result.title } });
    } catch (err) {
      next(err);
    }
  });

  // Update product on WooCommerce (via TDS Geo plugin)
  router.put('/update/:clientId/woocommerce/:productId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId, productId } = req.params;
      const { description, shortDescription, metaTitle, metaDescription } = req.body;

      const cmsResult = await pool.query(
        `SELECT endpoint_url, api_key FROM cms_connections WHERE client_id = $1 AND provider = 'woocommerce' AND is_active = true LIMIT 1`,
        [clientId]
      );
      if (cmsResult.rows.length === 0) {
        res.status(404).json({ error: 'No WooCommerce connection found for this client' });
        return;
      }
      const conn = cmsResult.rows[0];

      const body: Record<string, any> = { post_type: 'product' };
      if (description) body.content = description;
      if (shortDescription) body.excerpt = shortDescription;
      if (metaTitle) body.meta_title = metaTitle;
      if (metaDescription) body.meta_description = metaDescription;

      const wpRes = await fetch(`${conn.endpoint_url}/wp-json/tds-geo/v1/posts/${productId}`, {
        method: 'PUT',
        headers: { 'X-TDS-GEO-Key': conn.api_key || '', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!wpRes.ok) {
        const text = await wpRes.text();
        res.status(wpRes.status).json({ error: `Update failed: ${text.slice(0, 200)}` });
        return;
      }

      const result = await wpRes.json();
      res.json({ success: true, data: result.data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
