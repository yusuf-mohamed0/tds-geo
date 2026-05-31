// ══════════════════════════════════════════════════════════════════
// Content Intelligence Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import contentIntelligence from '../services/contentIntelligence';

export function createContentIntelRoutes(pool: Pool): Router {
  const router = Router();
  contentIntelligence.initialize(pool);

  // Detect cannibalization for an article
  router.post('/cannibalization/detect', authenticate, authorize('editor'), async (req: Request, res: Response) => {
    try {
      const { article_id, client_id } = req.body;
      const article = await pool.query('SELECT * FROM articles WHERE id = $1', [article_id]);
      if (article.rows.length === 0) return res.status(404).json({ success: false, error: 'Article not found' });

      const a = article.rows[0];
      const results = await contentIntelligence.detectCannibalization(
        client_id || a.client_id,
        article_id,
        a.title,
        a.content_md || ''
      );
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Analyze topic saturation
  router.get('/saturation/:clientId/:topic', authenticate, async (req: Request, res: Response) => {
    try {
      const saturation = await contentIntelligence.analyzeTopicSaturation(req.params.clientId, decodeURIComponent(req.params.topic));
      res.json({ success: true, data: saturation });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get saturated topics
  router.get('/saturated/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const topics = await contentIntelligence.getSaturatedTopics(req.params.clientId);
      res.json({ success: true, data: topics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Knowledge graph routes
  router.get('/knowledge-graph/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const graph = await contentIntelligence.getKnowledgeGraph(req.params.clientId);
      res.json({ success: true, data: graph });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/knowledge-graph/extract', authenticate, async (req: Request, res: Response) => {
    try {
      const entities = await contentIntelligence.extractEntities(req.body.content, req.body.client_id);
      res.json({ success: true, data: entities });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/knowledge-graph/build/:articleId', authenticate, async (req: Request, res: Response) => {
    try {
      const graph = await contentIntelligence.buildContentGraph(req.params.articleId);
      res.json({ success: true, data: graph });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Internal linking opportunities
  router.post('/linking-opportunities', authenticate, async (req: Request, res: Response) => {
    try {
      const { client_id, content, exclude_article_id } = req.body;
      const opportunities = await contentIntelligence.findLinkingOpportunities(client_id, content, exclude_article_id);
      res.json({ success: true, data: opportunities });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
