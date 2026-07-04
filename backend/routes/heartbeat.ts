// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response } from 'express';
import { heartbeatService } from '../services/heartbeatService';
import { authenticate, authorize } from '../middleware/auth';

export function createHeartbeatRoutes(): Router {
  const router = Router();

  router.get('/status', async (_req: Request, res: Response) => {
    const report = await heartbeatService.getLastReport();
    if (!report) {
      res.json({ status: 'pending', message: 'Heartbeat has not run yet. Trigger one with POST /api/heartbeat/run' });
      return;
    }
    res.json({ success: true, data: report });
  });

  router.post('/run', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
      const report = await heartbeatService.run();
      res.json({ success: true, data: report });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  router.post('/test-email', authenticate, authorize('admin'), async (_req: Request, res: Response) => {
    try {
      await heartbeatService.sendTestEmail();
      res.json({ success: true, message: 'Test email sent!' });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  return router;
}
