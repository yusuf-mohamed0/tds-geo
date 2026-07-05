import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import kaliTools from '../services/kaliTools';

export function createSecurityScanRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // Detect available Kali/security tools
  router.get('/tools', authorize('admin', 'super_admin'), async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tools = await kaliTools.detectTools();
      res.json({ tools, availableCount: tools.filter(t => t.available).length });
    } catch (err) {
      next(err);
    }
  });

  // Run whatweb against a target
  router.post('/whatweb', authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { target } = req.body;
      if (!target) { res.status(400).json({ error: 'target is required' }); return; }
      const result = await kaliTools.runWhatweb(target);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Run wpscan against a WordPress target
  router.post('/wpscan', authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { target, enumerate } = req.body;
      if (!target) { res.status(400).json({ error: 'target is required' }); return; }
      const result = await kaliTools.runWpscan(target, { enumerate });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Run nikto against a target
  router.post('/nikto', authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { target } = req.body;
      if (!target) { res.status(400).json({ error: 'target is required' }); return; }
      const result = await kaliTools.runNikto(target);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Run nmap against a target
  router.post('/nmap', authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { target, ports } = req.body;
      if (!target) { res.status(400).json({ error: 'target is required' }); return; }
      const result = await kaliTools.runNmap(target, ports);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Full scan of a target (runs all available tools)
  router.post('/full-scan', authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { target, clientId } = req.body;
      if (!target) { res.status(400).json({ error: 'target is required' }); return; }

      // Detect tools first
      await kaliTools.detectTools();
      const results = await kaliTools.scanTarget(target);

      // Store results if clientId provided
      if (clientId && results.length > 0) {
        try {
          await pool.query(
            `INSERT INTO client_audits (client_id, audit_date, results, priority_score)
             VALUES ($1, NOW(), $2, $3)`,
            [clientId, JSON.stringify({ scanResults: results, target }), 100]
          );
        } catch (dbErr) {
          logger.warn('Failed to store scan results', { error: (dbErr as Error).message });
        }
      }

      res.json({ target, toolCount: results.length, results });
    } catch (err) {
      next(err);
    }
  });

  // Get scan history for a client
  router.get('/history/:clientId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT id, audit_date, results, created_at
         FROM client_audits
         WHERE client_id = $1 AND results->'scanResults' IS NOT NULL
         ORDER BY created_at DESC LIMIT 20`,
        [req.params.clientId]
      );
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
