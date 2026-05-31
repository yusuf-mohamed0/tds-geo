// ──────────────────────────────────────────────
// API Key Management Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, authorizeClientAccess } from '../middleware/auth';
import { logger, logActivity } from '../utils/logger';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function maskValue(value: string): string {
  if (value.length <= 8) return '****' + value.slice(-4);
  return value.slice(0, 4) + '...' + value.slice(-4);
}

export function createApiKeyRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate);

  // GET /api/clients/:clientId/api-keys — list keys
  router.get('/:clientId/api-keys', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, service, label, masked_value, permissions, is_active, last_used_at, expires_at, created_at
         FROM api_keys WHERE client_id = $1 ORDER BY created_at DESC`,
        [req.params.clientId]
      );
      res.json({ keys: result.rows, total: result.rows.length });
    } catch (err) { next(err); }
  });

  // POST /api/clients/:clientId/api-keys — create key
  router.post('/:clientId/api-keys', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { service, label, keyValue, permissions, expiresAt } = req.body;
      if (!service || !label || !keyValue) {
        res.status(400).json({ error: 'service, label, and keyValue are required' });
        return;
      }
      const encrypted = encrypt(keyValue);
      const masked = maskValue(keyValue);
      const result = await pool.query(
        `INSERT INTO api_keys (client_id, service, label, key_value, masked_value, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, service, label, masked_value, permissions, is_active, created_at`,
        [req.params.clientId, service, label, encrypted, masked, permissions || [], expiresAt || null]
      );
      await logActivity(pool, {
        clientId: req.params.clientId,
        action: 'api_key_created',
        entityType: 'api_key',
        entityId: result.rows[0].id,
        level: 'info',
        message: `API key created: ${label} (${service})`
      });
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'Key with this service and label already exists' });
        return;
      }
      next(err);
    }
  });

  // DELETE /api/clients/:clientId/api-keys/:keyId — delete key
  router.delete('/:clientId/api-keys/:keyId', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `DELETE FROM api_keys WHERE id = $1 AND client_id = $2 RETURNING id, label, service`,
        [req.params.keyId, req.params.clientId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }
      await logActivity(pool, {
        clientId: req.params.clientId,
        action: 'api_key_deleted',
        entityType: 'api_key',
        entityId: req.params.keyId,
        level: 'warn',
        message: `API key deleted: ${result.rows[0].label} (${result.rows[0].service})`
      });
      res.json({ message: 'API key deleted' });
    } catch (err) { next(err); }
  });

  // PATCH /api/clients/:clientId/api-keys/:keyId/toggle — enable/disable
  router.patch('/:clientId/api-keys/:keyId/toggle', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `UPDATE api_keys SET is_active = NOT is_active, updated_at = NOW()
         WHERE id = $1 AND client_id = $2 RETURNING id, label, is_active`,
        [req.params.keyId, req.params.clientId]
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  return router;
}
