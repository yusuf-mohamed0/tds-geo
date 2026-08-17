import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { adsReportingService } from '../services/adsReporting';

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

  return router;
}
