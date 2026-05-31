// ══════════════════════════════════════════════════════════════════
// Multi-CMS Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import multiCmsPublisher from '../services/multiCmsPublisher';

export function createCmsRoutes(pool: Pool): Router {
  const router = Router();
  multiCmsPublisher.initialize(pool);

  // Get all connections for a client
  router.get('/connections/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const connections = await multiCmsPublisher.getConnections(req.params.clientId);
      res.json({ success: true, data: connections });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create a new CMS connection
  router.post('/connections', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const connection = await multiCmsPublisher.createConnection(req.body);
      res.json({ success: true, data: connection });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get available providers
  router.get('/providers', authenticate, async (_req: Request, res: Response) => {
    try {
      const providers = multiCmsPublisher.getAvailableProviders();
      res.json({ success: true, data: providers });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Publish an article via specific connection
  router.post('/publish', authenticate, authorize('editor'), async (req: Request, res: Response) => {
    try {
      const { article_id, connection_id } = req.body;
      const connections = await multiCmsPublisher.getConnections(req.body.client_id || (req as any).user.clientId);
      const connection = connections.find(c => c.id === connection_id);
      if (!connection) return res.status(404).json({ success: false, error: 'CMS connection not found' });

      const article = await pool.query('SELECT * FROM articles WHERE id = $1', [article_id]);
      if (article.rows.length === 0) return res.status(404).json({ success: false, error: 'Article not found' });

      const result = await multiCmsPublisher.publishViaConnection(article.rows[0], connection);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Publish to all active connections
  router.post('/publish-all', authenticate, authorize('editor'), async (req: Request, res: Response) => {
    try {
      const { article_id, client_id } = req.body;
      const article = await pool.query('SELECT * FROM articles WHERE id = $1', [article_id]);
      if (article.rows.length === 0) return res.status(404).json({ success: false, error: 'Article not found' });

      const results = await multiCmsPublisher.publishToAll(article.rows[0], client_id || article.rows[0].client_id);
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Test a connection
  router.post('/connections/:connectionId/test', authenticate, async (req: Request, res: Response) => {
    try {
      const connections = await multiCmsPublisher.getConnections(req.body.client_id || (req as any).user.clientId);
      const connection = connections.find(c => c.id === req.params.connectionId);
      if (!connection) return res.status(404).json({ success: false, error: 'Connection not found' });

      const adapter = multiCmsPublisher.getAdapter(connection.provider);
      const result = adapter ? await adapter.testConnection() : false;
      res.json({ success: true, data: { connected: result } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
