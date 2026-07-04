// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import { authenticate, authorize } from "../middleware/auth";
import { clientRateLimit } from "../middleware/rateLimiter";
import multiCmsPublisher from "../services/multiCmsPublisher";

export function createCmsRoutes(pool: Pool): Router {
  const router = Router();
  multiCmsPublisher.initialize(pool);

  router.get("/connections/:clientId", authenticate, async (req: Request, res: Response) => {
    try {
      const connections = await multiCmsPublisher.getConnections(req.params.clientId);
      res.json({ success: true, data: connections });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/connections", authenticate, authorize("admin"), async (req: Request, res: Response) => {
    try {
      const connection = await multiCmsPublisher.createConnection(req.body);
      res.json({ success: true, data: connection });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get("/providers", authenticate, async (_req: Request, res: Response) => {
    try {
      const providers = multiCmsPublisher.getAvailableProviders();
      res.json({ success: true, data: providers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/publish", clientRateLimit({ windowMs: 60_000, max: 20, name: 'cms-publish', message: 'Publish limit reached.' }), authenticate, authorize("admin", "editor"), async (req: Request, res: Response) => {
    try {
      const { article_id, connection_id } = req.body;
      const connections = await multiCmsPublisher.getConnections(req.body.client_id || (req as any).user.clientId);
      const connection = connections.find((c: any) => c.id === connection_id);
      if (!connection) return res.status(404).json({ success: false, error: "CMS connection not found" });

      const article = await pool.query("SELECT * FROM articles WHERE id = $1", [article_id]);
      if (article.rows.length === 0) return res.status(404).json({ success: false, error: "Article not found" });

      const result = await multiCmsPublisher.publishViaConnection(article.rows[0], connection);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/publish-all", clientRateLimit({ windowMs: 60_000, max: 10, name: 'cms-publish-all', message: 'Publish-all limit reached. Max 10 per minute.' }), authenticate, authorize("admin", "editor"), async (req: Request, res: Response) => {
    try {
      const { article_id, client_id } = req.body;
      const article = await pool.query("SELECT * FROM articles WHERE id = $1", [article_id]);
      if (article.rows.length === 0) return res.status(404).json({ success: false, error: "Article not found" });

      const results = await multiCmsPublisher.publishToAll(article.rows[0], client_id || article.rows[0].client_id);
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/connections/:connectionId/test", authenticate, async (req: Request, res: Response) => {
    try {
      const connections = await multiCmsPublisher.getConnections(req.body.client_id || (req as any).user.clientId);
      const connection = connections.find((c: any) => c.id === req.params.connectionId);
      if (!connection) return res.status(404).json({ success: false, error: "Connection not found" });

      const adapter = multiCmsPublisher.getAdapter(connection.provider);
      const result = adapter ? await adapter.testConnection() : false;
      res.json({ success: true, data: { connected: result } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
