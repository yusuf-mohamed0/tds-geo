// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Plugin Management Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, authorizeClientAccess } from '../middleware/auth';
import { logger, logActivity } from '../utils/logger';
import pluginService from '../services/pluginService';

export function createPluginRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate);

  // ─── List all available plugins (system-wide) ──
  router.get('/', authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, name, slug, description, version, author, config_schema,
                default_config, hooks, is_active, is_system, installed_at
         FROM plugin_registry ORDER BY name`
      );
      res.json({ plugins: result.rows, total: result.rows.length });
    } catch (err) { next(err); }
  });

  // ─── Get client plugin instances ────────────
  router.get('/clients/:clientId', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plugins = await pluginService.getClientPlugins(req.params.clientId);
      res.json({ plugins, total: plugins.length });
    } catch (err) { next(err); }
  });

  // ─── Register a plugin for a client ─────────
  router.post('/clients/:clientId/register', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { pluginSlug, config } = req.body;
      if (!pluginSlug) {
        res.status(400).json({ error: 'pluginSlug is required' });
        return;
      }
      const instance = await pluginService.registerInstance(pluginSlug, req.params.clientId, config || {});
      await logActivity(pool, {
        clientId: req.params.clientId,
        action: 'plugin_registered',
        entityType: 'plugin',
        level: 'info',
        message: `Plugin registered: ${pluginSlug}`
      });
      res.status(201).json(instance);
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // ─── Toggle plugin instance ─────────────────
  router.patch('/clients/:clientId/instances/:instanceId/toggle', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pluginService.toggleInstance(req.params.instanceId, req.params.clientId);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // ─── Update plugin instance config ──────────
  router.put('/clients/:clientId/instances/:instanceId/config', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { config } = req.body;
      if (!config) {
        res.status(400).json({ error: 'config is required' });
        return;
      }
      const result = await pluginService.updateConfig(req.params.instanceId, req.params.clientId, config);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // ─── Execute a plugin hook (admin) ──────────
  router.post('/hooks/:hookName/execute', authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId, data } = req.body;
      const results = await pluginService.executeHook(req.params.hookName, {
        clientId,
        data: data || {}
      });
      res.json({ hook: req.params.hookName, results });
    } catch (err) { next(err); }
  });

  return router;
}
