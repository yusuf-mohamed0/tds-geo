// ══════════════════════════════════════════════════════════════════
// Fact Checking Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import factCheckService from '../services/factCheckService';

export function createFactCheckRoutes(pool: Pool): Router {
  const router = Router();
  factCheckService.initialize(pool);

  // Verify an article
  router.post('/verify/:articleId', authenticate, authorize('editor'), async (req: Request, res: Response) => {
    try {
      const article = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.articleId]);
      if (article.rows.length === 0) return res.status(404).json({ success: false, error: 'Article not found' });

      const result = await factCheckService.verifyArticle(
        req.params.articleId,
        article.rows[0].client_id,
        article.rows[0].content_md || ''
      );
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Extract claims from content
  router.post('/extract-claims', authenticate, async (req: Request, res: Response) => {
    try {
      const claims = await factCheckService.extractClaims(req.body.content, req.body.client_id);
      res.json({ success: true, data: claims });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify a single claim
  router.post('/verify-claim', authenticate, async (req: Request, res: Response) => {
    try {
      const result = await factCheckService.verifyClaim(req.body.claim, req.body.context || '');
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get fact checks for an article
  router.get('/articles/:articleId/fact-checks', authenticate, async (req: Request, res: Response) => {
    try {
      const factChecks = await factCheckService.getFactChecksForArticle(req.params.articleId);
      const citations = await factCheckService.getCitationsForArticle(req.params.articleId);
      res.json({ success: true, data: { factChecks, citations } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Trusted sources management
  router.get('/trusted-sources', authenticate, async (req: Request, res: Response) => {
    try {
      const sources = await factCheckService.getTrustedSources((req.query.clientId as string) || (req as any).user.clientId);
      res.json({ success: true, data: sources });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/trusted-sources', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      await factCheckService.addTrustedSource(req.body);
      res.json({ success: true, message: 'Trusted source added' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // High-risk topics management
  router.get('/high-risk-topics', authenticate, async (req: Request, res: Response) => {
    try {
      const topics = await factCheckService.getHighRiskTopics((req.query.clientId as string) || (req as any).user.clientId);
      res.json({ success: true, data: topics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/high-risk-topics', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      await factCheckService.addHighRiskTopic(req.body);
      res.json({ success: true, message: 'High-risk topic added' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
