// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Global Memory Routes
// Site context, article history, knowledge graph, performance
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import globalMemory from '../services/globalMemory';

export function createMemoryRoutes(pool: Pool): Router {
  const router = Router();
  globalMemory.initialize(pool);

  router.use(authenticate);

  // ── Site Context ────────────────────────────
  router.get('/sites/:clientId', async (req: Request, res: Response) => {
    try {
      const site = await globalMemory.getSite(req.params.clientId);
      if (!site) return res.status(404).json({ error: 'Site not found' });
      res.json({ success: true, data: site });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/sites/:clientId', async (req: Request, res: Response) => {
    try {
      await globalMemory.updateSite(req.params.clientId, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Article History ─────────────────────────
  router.get('/articles/:clientId', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const articles = await globalMemory.getArticleHistory(req.params.clientId, limit);
      res.json({ success: true, data: articles });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Knowledge Graph ─────────────────────────
  router.get('/graph/:clientId', async (req: Request, res: Response) => {
    try {
      const graph = await globalMemory.getEntityGraph(req.params.clientId);
      res.json({ success: true, data: graph });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/entities', async (req: Request, res: Response) => {
    try {
      const id = await globalMemory.storeEntity(req.body);
      res.status(201).json({ success: true, data: { id } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/relations', async (req: Request, res: Response) => {
    try {
      const id = await globalMemory.storeRelationship(req.body);
      res.status(201).json({ success: true, data: { id } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/entities/:clientId/related/:entityName', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const related = await globalMemory.findRelatedEntities(
        req.params.clientId,
        req.params.entityName,
        limit
      );
      res.json({ success: true, data: related });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Performance ─────────────────────────────
  router.post('/performance', async (req: Request, res: Response) => {
    try {
      await globalMemory.recordPerformance(req.body.client_id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Stats ───────────────────────────────────
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await globalMemory.getStats();
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
