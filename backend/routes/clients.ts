// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Client Management Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, authorizeClientAccess } from '../middleware/auth';
import { validate } from '../validators/index';
import { createClientSchema, updateClientSchema } from '../validators/index';
import { logger } from '../utils/logger';
import { encrypt } from '../services/credentialEncryption';

export function createClientRoutes(pool: Pool): Router {
  const router = Router();

  // All client routes require authentication
  router.use(authenticate);

  // GET /api/clients — list all clients (admin sees all; others see their own)
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      let result;
      if (user.role === 'admin' || user.role === 'super_admin') {
        result = await pool.query(
          `SELECT id, name, slug, shopify_shop, brand_voice, service_area,
                  timezone, publish_frequency, approval_mode, is_active, created_at, updated_at
           FROM clients ORDER BY name`
        );
      } else {
        result = await pool.query(
          `SELECT id, name, slug, shopify_shop, brand_voice, service_area,
                  timezone, publish_frequency, approval_mode, created_at, updated_at
           FROM clients WHERE id = $1 AND is_active = true`,
          [user.clientId]
        );
      }

      res.json({ clients: result.rows, total: result.rows.length });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/clients — create client (admin only)
  router.post('/', authorize('admin'), validate(createClientSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = (req as any).validated;

      const result = await pool.query(
        `INSERT INTO clients (name, slug, shopify_shop, shopify_token, shopify_api_version,
                              brand_voice, service_area, timezone, publish_frequency,
                              preferred_publish_hour, approval_mode, monthly_token_limit,
                              monthly_cost_limit, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, name, slug, shopify_shop, brand_voice, service_area,
                   timezone, publish_frequency, approval_mode, is_active, created_at`,
        [
          data.name, data.slug, data.shopifyShop, encrypt(data.shopifyToken || ''),
          data.shopifyApiVersion || '2025-07', data.brandVoice || null,
          data.serviceArea || null, data.timezone || 'UTC',
          data.publishFrequency || 'daily', data.preferredPublishHour || 10,
          data.approvalMode || 'auto', data.monthlyTokenLimit || 1000000,
          data.monthlyCostLimit || 100.00, JSON.stringify(data.settings || {})
        ]
      );

      logger.info('Client created', { clientId: result.rows[0].id, name: data.name });
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'Client slug already exists' });
        return;
      }
      next(err);
    }
  });

  // GET /api/clients/:id — get single client
  router.get('/:id', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, name, slug, shopify_shop, brand_voice, service_area,
                timezone, publish_frequency, preferred_publish_hour, approval_mode,
                monthly_token_limit, monthly_cost_limit, is_active, created_at, updated_at
         FROM clients WHERE id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      res.json({ client: result.rows[0] });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/clients/:id — update client (admin only)
  router.put('/:id', authorize('admin'), validate(updateClientSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = (req as any).validated;
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        name: 'name', slug: 'slug', shopifyShop: 'shopify_shop',
        shopifyToken: 'shopify_token', shopifyApiVersion: 'shopify_api_version',
        brandVoice: 'brand_voice', serviceArea: 'service_area',
        timezone: 'timezone', publishFrequency: 'publish_frequency',
        preferredPublishHour: 'preferred_publish_hour',
        approvalMode: 'approval_mode', monthlyTokenLimit: 'monthly_token_limit',
        monthlyCostLimit: 'monthly_cost_limit', isActive: 'is_active'
      };

      for (const [key, column] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          fields.push(`${column} = $${paramIndex++}`);
          let value = (data as any)[key];
          if (column === 'shopify_token') value = encrypt(value || '');
          values.push(value);
        }
      }

      if (data.locale) {
        fields.push(`locale = $${paramIndex++}`);
        values.push(data.locale);
      }

      if (data.settings) {
        fields.push(`settings = settings || $${paramIndex++}`);
        values.push(JSON.stringify(data.settings));
      }

      if (fields.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      values.push(req.params.id);
      fields.push(`updated_at = NOW()`);

      const result = await pool.query(
        `UPDATE clients SET ${fields.join(', ')} WHERE id = $${paramIndex}
         RETURNING id, name, slug, shopify_shop, brand_voice, is_active, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      logger.info('Client updated', { clientId: req.params.id });
      res.json(result.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'Client slug already exists' });
        return;
      }
      next(err);
    }
  });

  // DELETE /api/clients/:id — permanently delete client with full cascade (admin/super_admin only)
  router.delete('/:id', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      // First fetch client info for logging
      const clientInfo = await pool.query('SELECT name, slug FROM clients WHERE id = $1', [req.params.id]);
      if (clientInfo.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const client = clientInfo.rows[0];

      // Count related records for the response summary
      const counts = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM articles WHERE client_id = $1) as articles,
          (SELECT COUNT(*) FROM keywords WHERE client_id = $1) as keywords,
          (SELECT COUNT(*) FROM cost_tracking WHERE client_id = $1) as cost_entries,
          (SELECT COUNT(*) FROM webhooks WHERE client_id = $1) as webhooks,
          (SELECT COUNT(*) FROM schedules WHERE client_id = $1) as schedules,
          (SELECT COUNT(*) FROM jobs WHERE client_id = $1) as jobs,
          (SELECT COUNT(*) FROM publishing_history WHERE client_id = $1) as publishing_entries,
          (SELECT COUNT(*) FROM content_embeddings WHERE client_id = $1) as embeddings,
          (SELECT COUNT(*) FROM seo_analytics WHERE client_id = $1) as seo_analytics,
          (SELECT COUNT(*) FROM article_images WHERE client_id = $1) as images,
          (SELECT COUNT(*) FROM internal_links_cache WHERE client_id = $1) as internal_links,
          (SELECT COUNT(*) FROM plugin_instances WHERE client_id = $1) as plugins,
          (SELECT COUNT(*) FROM notification_settings WHERE client_id = $1) as notifications,
          (SELECT COUNT(*) FROM api_keys WHERE client_id = $1) as api_keys,
          (SELECT COUNT(*) FROM api_usage WHERE client_id = $1) as api_usage
      `, [req.params.id]);

      // Unlink users from this client before deleting
      await pool.query('UPDATE users SET client_id = NULL WHERE client_id = $1', [req.params.id]);

      // Hard delete — DB CASCADE deletes all related records
      await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);

      logger.info('Client permanently deleted with cascade', {
        clientId: req.params.id,
        name: client.name,
        slug: client.slug,
        ...counts.rows[0]
      });

      res.json({
        message: `Client "${client.name}" permanently deleted with all related data`,
        deleted: counts.rows[0]
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/clients/:id/test-shopify — test Shopify connection
  router.post('/:id/test-shopify', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const client = result.rows[0];
      const shopifyService = require('../services/shopify').default;

      const blogs = await shopifyService.fetchBlogs({
        shop: client.shopify_shop,
        accessToken: client.shopify_token,
        apiVersion: client.shopify_api_version
      });

      res.json({
        success: true,
        shop: client.shopify_shop,
        blogCount: blogs.length,
        blogs: blogs.map((b: any) => ({ id: b.id, title: b.title, handle: b.handle }))
      });
    } catch (err) {
      res.status(502).json({ success: false, error: (err as Error).message });
    }
  });

  return router;
}
