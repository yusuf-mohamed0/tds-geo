// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Worker Performance Scoring Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import scoringEngine from '../services/workerScoringEngine';
import { WorkerTier } from '../types';

export function createWorkerScoringRoutes(pool: Pool): Router {
  const router = Router();

  // All routes require admin auth
  router.use(authenticate);
  router.use(authorize('admin'));

  // ─── Get full hierarchy (all workers ranked) ───────────
  router.get('/hierarchy', async (_req: Request, res: Response) => {
    try {
      const hierarchy = await scoringEngine.getHierarchy();
      const byTier = await scoringEngine.getHierarchyByTier();
      const summary = {
        total: hierarchy.length,
        byTier: Object.fromEntries(
          Object.entries(byTier).map(([tier, workers]) => [tier, workers.length])
        )
      };

      res.json({ success: true, data: { hierarchy, byTier, summary } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Get scores for a specific worker ─────────────────
  router.get('/workers/:workerName/scores', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const scores = await scoringEngine.getWorkerHistory(req.params.workerName, limit);
      res.json({ success: true, data: scores });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Get promotion/demotion history ───────────────────
  router.get('/promotions', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await scoringEngine.getPromotionHistory(limit);
      res.json({ success: true, data: history });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Get performance thresholds ───────────────────────
  router.get('/thresholds', async (_req: Request, res: Response) => {
    try {
      const thresholds = await scoringEngine.getThresholdsConfig();
      res.json({ success: true, data: thresholds });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Update performance thresholds for a tier ──────────
  router.put('/thresholds/:tierName', async (req: Request, res: Response) => {
    try {
      const { tierName } = req.params;
      const validTiers: WorkerTier[] = ['elite', 'senior', 'standard', 'junior', 'probation'];

      if (!validTiers.includes(tierName as WorkerTier)) {
        res.status(400).json({ success: false, error: `Invalid tier: ${tierName}` });
        return;
      }

      await scoringEngine.updateThreshold(tierName as WorkerTier, req.body);
      const thresholds = await scoringEngine.getThresholdsConfig();
      res.json({ success: true, data: thresholds });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Manually set a worker's tier ─────────────────────
  router.post('/workers/:workerName/tier', async (req: Request, res: Response) => {
    try {
      const { workerName } = req.params;
      const { jobType, newTier, reason } = req.body;
      const validTiers: WorkerTier[] = ['elite', 'senior', 'standard', 'junior', 'probation'];

      if (!jobType) {
        res.status(400).json({ success: false, error: 'jobType is required' });
        return;
      }
      if (!validTiers.includes(newTier as WorkerTier)) {
        res.status(400).json({ success: false, error: `Invalid tier: ${newTier}` });
        return;
      }

      await scoringEngine.manuallySetTier(workerName, jobType, newTier as WorkerTier,
        reason || 'Manual override by admin', (req as any).user?.userId);

      res.json({ success: true, message: `Worker ${workerName} set to ${newTier}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Trigger a full evaluation run ────────────────────
  router.post('/evaluate', async (_req: Request, res: Response) => {
    try {
      const result = await scoringEngine.evaluateAllWorkers();
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Evaluate a single worker ─────────────────────────
  router.post('/evaluate/:workerName', async (req: Request, res: Response) => {
    try {
      const { jobType } = req.body;
      if (!jobType) {
        res.status(400).json({ success: false, error: 'jobType is required' });
        return;
      }
      const result = await scoringEngine.evaluateWorker(req.params.workerName, jobType);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── Get worker org chart ─────────────────────────────
  router.get('/org-chart', async (_req: Request, res: Response) => {
    try {
      const byTier = await scoringEngine.getHierarchyByTier();
      res.json({ success: true, data: byTier });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
