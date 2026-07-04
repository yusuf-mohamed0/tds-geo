// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// System Configuration Routes
// Live-editable platform settings via UI
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { logger, logActivity } from '../utils/logger';

export function createSystemConfigRoutes(pool: Pool): Router {
  const router = Router();

  // ─── Public config (unauthenticated) ────────
  router.get('/public', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        'SELECT key, value, description FROM system_config WHERE is_public = true ORDER BY key'
      );
      res.json({ config: result.rows });
    } catch (err) { next(err); }
  });

  // ─── All config (admin only) ────────────────
  router.get('/', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.query;
      let query = 'SELECT * FROM system_config';
      const params: any[] = [];
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
      }
      query += ' ORDER BY category, key';
      const result = await pool.query(query, params);
      res.json({ config: result.rows, total: result.rows.length });
    } catch (err) { next(err); }
  });

  // ─── Get single config key ─────────────────
  router.get('/:key', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query('SELECT * FROM system_config WHERE key = $1', [req.params.key]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Config key not found' });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── Update config value ───────────────────
  router.put('/:key', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { value, description, category, isPublic } = req.body;
      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (value !== undefined) { updates.push(`value = $${idx++}`); params.push(JSON.stringify(value)); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
      if (category !== undefined) { updates.push(`category = $${idx++}`); params.push(category); }
      if (isPublic !== undefined) { updates.push(`is_public = $${idx++}`); params.push(isPublic); }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updates.push('updated_at = NOW()');
      params.push(req.params.key);

      const result = await pool.query(
        `UPDATE system_config SET ${updates.join(', ')} WHERE key = $${idx} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Config key not found' });
        return;
      }

      await logActivity(pool, {
        clientId: '',
        action: 'system_config_updated',
        entityType: 'system_config',
        entityId: result.rows[0].id,
        level: 'info',
        message: `System config updated: ${req.params.key}`
      });

      res.json(result.rows[0]);
    } catch (err) { next(err); }
  });

  // ─── Create new config key ─────────────────
  router.post('/', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key, value, description, category, isEncrypted, isPublic } = req.body;
      if (!key || value === undefined) {
        res.status(400).json({ error: 'key and value are required' });
        return;
      }
      const result = await pool.query(
        `INSERT INTO system_config (key, value, description, category, is_encrypted, is_public)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [key, JSON.stringify(value), description || '', category || 'general', isEncrypted || false, isPublic || false]
      );
      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'Config key already exists' });
        return;
      }
      next(err);
    }
  });

  // ─── Get config categories ─────────────────
  router.get('/categories/list', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        'SELECT category, COUNT(*)::int as count FROM system_config GROUP BY category ORDER BY category'
      );
      res.json({ categories: result.rows });
    } catch (err) { next(err); }
  });

  return router;
}
