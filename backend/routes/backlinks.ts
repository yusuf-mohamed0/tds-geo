import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import backlinkAutomation from '../services/backlinkAutomation';

function normalizeDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, '');
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  }
}

export function createBacklinkRoutes(_pool: Pool): Router {
  const router = Router({ mergeParams: true });
  router.use(authenticate);
  router.use((req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const requestedClientId = req.params.clientId || req.query.clientId as string | undefined;
    if (user.role === 'admin' || user.role === 'super_admin') {
      if (!requestedClientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }
      (req as any).clientId = requestedClientId;
      next();
      return;
    }
    if (!user.clientId || (requestedClientId && requestedClientId !== user.clientId)) {
      res.status(403).json({ error: 'You do not have access to this client data' });
      return;
    }
    (req as any).clientId = user.clientId;
    next();
  });

  // ─── Discover Prospects ─────────────────────
  router.post('/discover', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const { targetDomain, limit } = req.body;
      const normalizedDomain = typeof targetDomain === 'string' ? normalizeDomain(targetDomain) : '';
      if (!normalizedDomain) {
        res.status(400).json({ error: 'targetDomain is required' });
        return;
      }
      const prospects = await backlinkAutomation.discoverProspects(clientId, normalizedDomain, limit || 20);
      res.json({ prospects, count: prospects.length });
    } catch (err) {
      next(err);
    }
  });

  // ─── List Prospects ─────────────────────────
  router.get('/prospects', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const { status } = req.query;
      const prospects = await backlinkAutomation.getProspects(clientId, status as string);
      res.json({ prospects });
    } catch (err) {
      next(err);
    }
  });

  // ─── Create Outreach Email ──────────────────
  router.post('/outreach', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const { prospectId, pitchType, articleId } = req.body;
      if (!prospectId) {
        res.status(400).json({ error: 'prospectId is required' });
        return;
      }
      const outreach = await backlinkAutomation.createOutreach(clientId, prospectId, pitchType, articleId);
      res.status(201).json(outreach);
    } catch (err) {
      next(err);
    }
  });

  // ─── Mark Outreach as Sent ──────────────────
  router.post('/outreach/:id/sent', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await backlinkAutomation.markSent(req.params.id, (req as any).clientId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ─── List Outreach ──────────────────────────
  router.get('/outreach', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const { status } = req.query;
      const outreach = await backlinkAutomation.getOutreach(clientId, status as string);
      res.json({ outreach });
    } catch (err) {
      next(err);
    }
  });

  // ─── Generate Guest Post ────────────────────
  router.post('/generate-guest-post', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const { prospectId, topic, tone } = req.body;
      if (!prospectId || !topic) {
        res.status(400).json({ error: 'prospectId and topic are required' });
        return;
      }
      const guestPost = await backlinkAutomation.generateGuestPost(clientId, prospectId, topic, tone);
      res.json(guestPost);
    } catch (err) {
      next(err);
    }
  });

  // ─── Track Backlink ─────────────────────────
  router.post('/track', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const { sourceUrl, targetUrl, anchorText, prospectId, outreachId, articleId } = req.body;
      if (!sourceUrl || !targetUrl || !anchorText) {
        res.status(400).json({ error: 'sourceUrl, targetUrl, and anchorText are required' });
        return;
      }
      const backlink = await backlinkAutomation.trackBacklink(clientId, sourceUrl, targetUrl, anchorText, prospectId, outreachId, articleId);
      res.status(201).json(backlink);
    } catch (err) {
      next(err);
    }
  });

  // ─── List Backlinks ─────────────────────────
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const { status } = req.query;
      const backlinks = await backlinkAutomation.getBacklinks(clientId, status as string);
      res.json({ backlinks });
    } catch (err) {
      next(err);
    }
  });

  // ─── Verify Backlinks ───────────────────────
  router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = (req as any).clientId;
      const result = await backlinkAutomation.verifyBacklinks(clientId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
