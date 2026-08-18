// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Webhook & Webhook Delivery Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, authorizeClientAccess } from '../middleware/auth';
import { validate } from '../validators/index';
import { createWebhookSchema, updateWebhookSchema } from '../validators/index';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { encrypt as encryptSecret, decrypt as decryptSecret } from '../services/credentialEncryption';
import { normalizeWebhookBody, verifyShopifyWebhookHmac } from '../utils/shopifyWebhook';
import { redactJsonString } from '../utils/redact';

export function createWebhookRoutes(pool: Pool): Router {
  const router = Router();

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/events/receive') {
      next();
      return;
    }
    authenticate(req, res, next);
  });

  // ─── List Webhooks for Client ───────────────
  router.get('/:clientId/webhooks', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, name, url, events, retry_count, timeout_ms, is_active, last_triggered_at, created_at
         FROM webhooks WHERE client_id = $1 ORDER BY created_at DESC`,
        [req.params.clientId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // ─── Create Webhook ─────────────────────────
  router.post('/:clientId/webhooks', authorize('admin', 'editor'), validate(createWebhookSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = (req as any).validated;
      const rawSecret = data.secret || crypto.randomBytes(32).toString('hex');
      const secret = encryptSecret(rawSecret);

      const result = await pool.query(
        `INSERT INTO webhooks (client_id, name, url, events, secret, retry_count, timeout_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, url, events, retry_count, timeout_ms, is_active, created_at`,
        [req.params.clientId, data.name || null, data.url, data.events, secret, data.retryCount, data.timeoutMs]
      );

      logger.info('Webhook created', { webhookId: result.rows[0].id, clientId: req.params.clientId });
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Get Webhook ────────────────────────────
  router.get('/:clientId/webhooks/:webhookId', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, name, url, events, retry_count, timeout_ms, is_active, last_triggered_at, created_at, updated_at
         FROM webhooks WHERE id = $1 AND client_id = $2`,
        [req.params.webhookId, req.params.clientId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Update Webhook ─────────────────────────
  router.put('/:clientId/webhooks/:webhookId', authorize('admin', 'editor'), validate(updateWebhookSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = (req as any).validated;
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.name) { fields.push(`name = $${paramIndex++}`); values.push(data.name); }
      if (data.url) { fields.push(`url = $${paramIndex++}`); values.push(data.url); }
      if (data.events) { fields.push(`events = $${paramIndex++}`); values.push(data.events); }
      if (data.secret) { fields.push(`secret = $${paramIndex++}`); values.push(encryptSecret(data.secret)); }
      if (data.retryCount !== undefined) { fields.push(`retry_count = $${paramIndex++}`); values.push(data.retryCount); }
      if (data.timeoutMs !== undefined) { fields.push(`timeout_ms = $${paramIndex++}`); values.push(data.timeoutMs); }
      if (data.isActive !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(data.isActive); }
      fields.push('updated_at = NOW()');

      if (fields.length === 1) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      values.push(req.params.webhookId, req.params.clientId);

      const result = await pool.query(
        `UPDATE webhooks SET ${fields.join(', ')} WHERE id = $${paramIndex++} AND client_id = $${paramIndex}
         RETURNING id, name, url, events, retry_count, timeout_ms, is_active, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Delete Webhook ─────────────────────────
  router.delete('/:clientId/webhooks/:webhookId', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        'DELETE FROM webhooks WHERE id = $1 AND client_id = $2 RETURNING id',
        [req.params.webhookId, req.params.clientId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      res.json({ message: 'Webhook deleted' });
    } catch (err) {
      next(err);
    }
  });

  // ─── Get Webhook Delivery Log ─────────────
  router.get('/:clientId/webhooks/:webhookId/deliveries', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await pool.query(
        `SELECT * FROM webhook_deliveries
         WHERE webhook_id = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.params.webhookId, limit, offset]
      );

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // ─── Test Webhook ───────────────────────────
  router.post('/:clientId/webhooks/:webhookId/test', authorize('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        'SELECT * FROM webhooks WHERE id = $1 AND client_id = $2',
        [req.params.webhookId, req.params.clientId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      const webhook = result.rows[0];
      const axios = require('axios');

      const payload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: { message: 'This is a test webhook from Kivo OS' }
      };

      const signature = webhook.secret
        ? crypto.createHmac('sha256', webhook.secret).update(JSON.stringify(payload)).digest('hex')
        : undefined;

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Webhook-Signature': signature } : {})
        },
        timeout: webhook.timeout_ms || 10000
      });

      res.json({ success: true, statusCode: response.status });
    } catch (err: any) {
      res.status(502).json({
        success: false,
        error: err.response?.status
          ? `HTTP ${err.response.status}: ${err.response.statusText}`
          : (err as Error).message
      });
    }
  });

  // ─── Event Receiver (for Shopify/webhook callbacks) ──
  router.post('/events/receive', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawBody = normalizeWebhookBody(req.body, (req as any).rawBody);
      const event = rawBody ? JSON.parse(rawBody) : {};
      // Log incoming webhook events
      logger.info('Webhook event received', { event: event.event || 'unknown' });

      // Verify Shopify webhook HMAC if present
      const hmac = req.headers['x-shopify-hmac-sha256'] as string | string[] | undefined;
      if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
        logger.warn('Invalid Shopify webhook HMAC');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Store the webhook event
      const result = await pool.query(
        `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
         VALUES (NULL, $1, 'webhook', 'info', $2, $3) RETURNING id`,
        [event.event || 'unknown', `Webhook received: ${event.event || 'unknown'}`, redactJsonString(event)]
      );

      res.status(200).json({ received: true, id: result.rows[0]?.id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
