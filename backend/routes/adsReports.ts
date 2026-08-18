import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { adsReportingService, AdsArtifactStatus } from '../services/adsReporting';

export function createAdsReportRoutes(_pool: Pool): Router {
  const router = Router();

  router.use(authenticate);
  router.use(authorize('admin'));

  router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adsReportingService.status());
    } catch (err) {
      next(err);
    }
  });

  router.post('/:clientId/dry-run', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const month = String(req.body?.month || '');
      res.json(await adsReportingService.dryRun(req.params.clientId, month));
    } catch (err) {
      next(err);
    }
  });

  router.post('/:clientId/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const month = String(req.body?.month || '');
      res.json(await adsReportingService.generateInternal(req.params.clientId, month));
    } catch (err) {
      next(err);
    }
  });

  // ─── Artifact approval/delivery registry ───
  router.post('/registry/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await adsReportingService.syncRegistry(_pool));
    } catch (err) {
      next(err);
    }
  });

  router.get('/registry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.query.clientId ? String(req.query.clientId) : undefined;
      const month = req.query.month ? String(req.query.month) : undefined;
      const status = req.query.status ? String(req.query.status) as AdsArtifactStatus : undefined;
      res.json(await adsReportingService.listRegistry(_pool, { clientId, month, status }));
    } catch (err) {
      next(err);
    }
  });

  router.get('/registry/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await adsReportingService.getRegistryEntry(_pool, req.params.id);
      if (!entry) {
        res.status(404).json({ error: 'Registry entry not found' });
        return;
      }
      res.json(entry);
    } catch (err) {
      next(err);
    }
  });

  router.post('/registry/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await adsReportingService.transitionRegistryEntry(_pool, req.params.id, 'approve', {
        approvedBy: (req as any).user?.userId,
      });
      res.json(entry);
    } catch (err) {
      next(err);
    }
  });

  router.post('/registry/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reason = String(req.body?.reason || '');
      const entry = await adsReportingService.transitionRegistryEntry(_pool, req.params.id, 'reject', {
        rejectionReason: reason,
      });
      res.json(entry);
    } catch (err) {
      next(err);
    }
  });

  router.post('/registry/:id/deliver', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deliveredTo = String(req.body?.deliveredTo || '');
      const entry = await adsReportingService.transitionRegistryEntry(_pool, req.params.id, 'deliver', {
        deliveredTo,
      });
      res.json(entry);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
