// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Cost Optimization Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import costTracker from '../services/costTracker';
import CostOptimizationService from '../services/costOptimization';

export function createCostRoutes(pool: Pool): Router {
  const router = Router();
  const costOpt = CostOptimizationService.getInstance();
  costOpt.initialize(pool);
  costTracker.initialize(pool);

  // Get monthly usage for a client
  router.get('/usage/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const usage = await costTracker.getMonthlyUsage(req.params.clientId);
      res.json({ success: true, data: usage });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check budget
  router.get('/budget/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const budgetCheck = await costOpt.checkBudget(req.params.clientId, 0);
      res.json({ success: true, data: budgetCheck });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get cost report (global — all clients)
  router.get('/report/global', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const result = await pool.query(`
        SELECT COALESCE(SUM(cost_usd)::decimal(10,2), 0) as total
        FROM cost_tracking
        WHERE created_at >= NOW() - ($1 || ' days')::interval
      `, [days]);
      const dailyResult = await pool.query(`
        SELECT DATE(created_at) as date, SUM(cost_usd)::decimal(10,2) as cost
        FROM cost_tracking
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY DATE(created_at) ORDER BY date
      `, [days]);
      const providerResult = await pool.query(`
        SELECT COALESCE(model, 'unknown') as provider, SUM(cost_usd)::decimal(10,2) as cost
        FROM cost_tracking
        WHERE created_at >= NOW() - ($1 || ' days')::interval
        GROUP BY model ORDER BY cost DESC
      `, [days]);
      res.json({
        success: true,
        data: {
          total: parseFloat(result.rows[0].total),
          daily: dailyResult.rows,
          byProvider: providerResult.rows,
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get cost report (by client)
  router.get('/report/:clientId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const report = await costOpt.getCostReport(req.params.clientId, days);
      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Route a task (get optimal model recommendation)
  router.post('/route', authenticate, async (req: Request, res: Response) => {
    try {
      const routing = await costOpt.routeTask(
        req.body.client_id || (req as any).user.clientId,
        req.body.task_requirements
      );
      res.json({ success: true, data: routing });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Set routing config
  router.post('/route-config', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      await costOpt.setRoutingConfig(req.body);
      res.json({ success: true, message: 'Routing config updated' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
