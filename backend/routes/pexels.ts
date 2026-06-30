// ══════════════════════════════════════════════════════════════════
// Pexels Image Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import pexelsService from '../services/pexelsService';

export function createPexelsRoutes(pool: Pool): Router {
  const router = Router();
  pexelsService.initialize(pool);

  // Find images for an article
  router.post('/find-article-images', authenticate, async (req: Request, res: Response) => {
    try {
      const { client_id, article_title, keyword, sections } = req.body;
      if (!article_title || !keyword) return res.status(400).json({ success: false, error: 'Article title and keyword required' });

      const images = await pexelsService.findImagesForArticle(
        client_id || (req as any).user.clientId,
        article_title,
        keyword,
        sections
      );
      res.json({ success: true, data: images });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check if Pexels is available
  router.get('/available', authenticate, async (_req: Request, res: Response) => {
    try {
      const available = await pexelsService.isPexelsAvailable();
      res.json({ success: true, data: { available } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get cached images for a client
  router.get('/cache/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const cachedIds = await pexelsService.getCachedImageIds(req.params.clientId);
      res.json({ success: true, data: cachedIds });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get image attributions for an article
  router.get('/attribution/:clientId/:articleId', authenticate, async (req: Request, res: Response) => {
    try {
      const attributions = await pexelsService.getImageAttribution(req.params.clientId, req.params.articleId);
      res.json({ success: true, data: attributions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
