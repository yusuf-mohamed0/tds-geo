// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// ──────────────────────────────────────────────
// Google Search Console Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import gscService from '../services/googleSearchConsole';

export function createGscRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // ─── OAuth — redirect to Google ─────────────
  router.get('/auth', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.query.clientId as string;
      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Access control: admin/super_admin can connect any client;
      // client-role users can only connect their own
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        if (user.clientId !== clientId) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
      }

      if (!gscService.isConfigured()) {
        res.status(503).json({
          error: 'Google Search Console not configured',
          message: 'Set GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REDIRECT_URI in environment',
        });
        return;
      }

      const state = await gscService.createOAuthState(clientId);
      const authUrl = gscService.getAuthUrl(state);
      res.json({ url: authUrl, state });
    } catch (err) {
      next(err);
    }
  });

  // ─── OAuth callback ─────────────────────────
  router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        res.status(400).json({ error: 'Missing code or state parameter' });
        return;
      }

      const clientId = await gscService.handleCallback(code as string, state as string);
      res.redirect(`/gsc?clientId=${clientId}&connected=1`);
    } catch (err) {
      next(err);
    }
  });

  // ─── Connection status ──────────────────────
  router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.query.clientId as string;
      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'super_admin' && user.clientId !== clientId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const status = await gscService.getAuthStatus(clientId);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  // ─── Overview dashboard data ─────────────────
  router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.query.clientId as string;
      const days = Math.min(parseInt(req.query.days as string, 10) || 30, 365);

      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'super_admin' && user.clientId !== clientId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const topLimit = Math.min(parseInt(req.query.topLimit as string, 10) || 10, 100);
      const overview = await gscService.getOverview(clientId, days, topLimit);
      res.json(overview);
    } catch (err) {
      next(err);
    }
  });

  // ─── Sync data from GSC API ─────────────────
  router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId, siteUrl, days } = req.body;

      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'super_admin' && user.clientId !== clientId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      if (siteUrl) {
        await gscService.syncSearchAnalytics(clientId, siteUrl, days || 30);
      } else {
        await gscService.syncAll(clientId);
      }

      res.json({ success: true, message: 'GSC data synced' });
    } catch (err) {
      next(err);
    }
  });

  // ─── Disconnect GSC ─────────────────────────
  router.post('/disconnect', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.body;
      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const user = (req as any).user;
      if (user.role !== 'admin' && user.role !== 'super_admin' && user.clientId !== clientId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await gscService.disconnect(clientId);
      res.json({ success: true, message: 'GSC disconnected' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
