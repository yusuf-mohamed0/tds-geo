import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorizeClientAccess } from '../middleware/auth';
import { logger } from '../utils/logger';
import backlinkAutomation from '../services/backlinkAutomation';

export function createBacklinkRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate);

  // ─── Discover Prospects ─────────────────────
  router.post('/discover', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
      const { targetDomain, limit } = req.body;
      if (!targetDomain) {
        res.status(400).json({ error: 'targetDomain is required' });
        return;
      }
      const prospects = await backlinkAutomation.discoverProspects(clientId, targetDomain, limit || 20);
      res.json({ prospects, count: prospects.length });
    } catch (err) {
      next(err);
    }
  });

  // ─── List Prospects ─────────────────────────
  router.get('/prospects', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
      const { status } = req.query;
      const prospects = await backlinkAutomation.getProspects(clientId, status as string);
      res.json({ prospects });
    } catch (err) {
      next(err);
    }
  });

  // ─── Create Outreach Email ──────────────────
  router.post('/outreach', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
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
  router.post('/outreach/:id/sent', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await backlinkAutomation.markSent(req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ─── List Outreach ──────────────────────────
  router.get('/outreach', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
      const { status } = req.query;
      const outreach = await backlinkAutomation.getOutreach(clientId, status as string);
      res.json({ outreach });
    } catch (err) {
      next(err);
    }
  });

  // ─── Generate Guest Post ────────────────────
  router.post('/generate-guest-post', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
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
  router.post('/track', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
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
  router.get('/', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
      const { status } = req.query;
      const backlinks = await backlinkAutomation.getBacklinks(clientId, status as string);
      res.json({ backlinks });
    } catch (err) {
      next(err);
    }
  });

  // ─── Verify Backlinks ───────────────────────
  router.post('/verify', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId || (req as any).user.clientId;
      const result = await backlinkAutomation.verifyBacklinks(clientId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
