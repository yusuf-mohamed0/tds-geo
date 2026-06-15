// ══════════════════════════════════════════════════════════════════
// Browser Use Routes
// API endpoints for triggering and managing browser-use AI agents
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import browserUseService from '../services/browserUseService';

export function createBrowserUseRoutes(pool: Pool): Router {
  const router = Router();

  // All routes require authentication
  router.use(authenticate);

  // ─── Health / Availability ───────────────────
  router.get('/status', async (_req: Request, res: Response) => {
    res.json({
      available: browserUseService.isAvailable,
      browser: 'chromium',
      library: 'browser-use',
    });
  });

  // ─── Run Agent Task ─────────────────────────
  router.post('/run', authorize('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { task, headless, timeout, model } = req.body;

      if (!task || typeof task !== 'string' || task.trim().length === 0) {
        res.status(400).json({ error: 'Task description is required' });
        return;
      }

      if (!browserUseService.isAvailable) {
        res.status(503).json({ error: 'Browser-use agent is not available' });
        return;
      }

      logger.info('Browser-use agent triggered', {
        task: task.slice(0, 100),
        timeout,
        model,
        user: (req as any).user?.email,
      });

      const result = await browserUseService.runAgent(task.trim(), {
        headless: headless !== false,
        timeout: timeout || 120,
        model: model || 'browser-use',
      });

      // Log to activity log
      try {
        const user = (req as any).user;
        await pool.query(
          `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
           VALUES ($1, 'browser_agent_run', 'browser_agent', $2, $3, $4)`,
          [
            user?.clientId || null,
            result.success ? 'info' : 'warn',
            `Browser agent ${result.success ? 'completed' : 'failed'}: ${task.slice(0, 80)}`,
            JSON.stringify({
              task: task.slice(0, 200),
              duration: result.duration_seconds,
              success: result.success,
            }),
          ]
        );
      } catch (logErr) {
        // Non-critical — don't fail the request
        logger.warn('Failed to log browser agent activity', { error: (logErr as Error).message });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
