// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// ──────────────────────────────────────────────
// Demo / Free Trial Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import demoProvisioner from '../services/demoProvisioner';
import { logger } from '../utils/logger';

export function createDemoRoutes(pool: Pool): Router {
  const router = Router();

  demoProvisioner.initialize(pool);

  // ─── Sign up for demo ───────────────────────
  router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, password, company } = req.body;

      if (!email || !name || !password) {
        res.status(400).json({ error: 'email, name, and password are required' });
        return;
      }

      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      const result = await demoProvisioner.createDemoAccount({ email, name, password, company });

      res.status(201).json({
        success: true,
        message: 'Demo account created',
        clientId: result.clientId,
        userId: result.userId,
      });
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        res.status(409).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // ─── Check demo status ──────────────────────
  router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.query.clientId as string || (req as any).user?.clientId;

      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const status = await demoProvisioner.getDemoStatus(clientId);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  // ─── Upgrade from demo ──────────────────────
  router.post('/upgrade', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId, shopifyShop, shopifyToken } = req.body;

      if (!clientId || !shopifyShop || !shopifyToken) {
        res.status(400).json({ error: 'clientId, shopifyShop, and shopifyToken are required' });
        return;
      }

      await demoProvisioner.upgradeFromDemo(clientId, shopifyShop, shopifyToken);

      res.json({ success: true, message: 'Account upgraded' });
    } catch (err) {
      next(err);
    }
  });

  // ─── Check if generation is allowed (trial enforcement) ──
  router.get('/can-generate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.query.clientId as string || (req as any).user?.clientId;

      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      const result = await demoProvisioner.checkGenerationAllowed(clientId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
