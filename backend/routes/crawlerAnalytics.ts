// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import crawlerTrackerService, { identifyCrawler } from '../services/crawlerTracker';

export function createCrawlerAnalyticsRoutes(): Router {
  const router = Router();

  // GET /api/crawler-analytics/stats — crawler analytics for a client
  router.get('/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const clientId = req.query.client_id as string;
      const days = parseInt(req.query.days as string) || 30;
      if (!clientId) {
        res.status(400).json({ success: false, error: 'client_id required' });
        return;
      }
      const stats = await crawlerTrackerService.getStats(clientId, days);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/crawler-analytics/identify — identify a crawler from user-agent
  router.post('/identify', (_req: Request, res: Response) => {
    try {
      const { user_agent } = _req.body as { user_agent?: string };
      if (!user_agent) {
        res.status(400).json({ success: false, error: 'user_agent required' });
        return;
      }
      const name = identifyCrawler(user_agent);
      res.json({ success: true, data: { name, is_crawler: name !== null } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
