// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Observability Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import observability from '../services/observability';

export function createObservabilityRoutes(pool: Pool): Router {
  const router = Router();
  observability.initialize(pool);

  // Dashboard metrics
  router.get('/dashboard', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const metrics = await observability.getDashboardMetrics(req.query.clientId as string);
      res.json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // AI latency over time
  router.get('/latency', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const data = await observability.getAILatencyOverTime(hours);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get a trace by ID
  router.get('/traces/:traceId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const spans = await observability.getTrace(req.params.traceId);
      res.json({ success: true, data: spans });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get active alerts
  router.get('/alerts', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const alerts = await observability.getActiveAlerts(req.query.severity as string);
      res.json({ success: true, data: alerts });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Acknowledge alert
  router.patch('/alerts/:alertId/acknowledge', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      await observability.acknowledgeAlert(req.params.alertId, (req as any).user.userId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Resolve alert
  router.patch('/alerts/:alertId/resolve', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      await observability.resolveAlert(req.params.alertId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // System health check
  router.get('/health', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
      const health = await observability.checkSystemHealth();
      res.json({ success: true, data: health });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
