// ══════════════════════════════════════════════════════════════════
// Crawl4AI Routes
// API endpoints for web scraping via crawl4ai
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import crawl4aiService from '../services/crawl4aiService';

export function createCrawl4aiRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // ─── Health / Availability ───────────────────
  router.get('/status', async (_req: Request, res: Response) => {
    res.json({
      available: crawl4aiService.isAvailable,
      library: 'crawl4ai',
      version: '0.8.9',
    });
  });

  // ─── Scrape URL ──────────────────────────────
  router.post('/scrape', authorize('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, output, timeout, query } = req.body;

      if (!url || typeof url !== 'string' || url.trim().length === 0) {
        res.status(400).json({ error: 'URL is required' });
        return;
      }

      if (!crawl4aiService.isAvailable) {
        res.status(503).json({ error: 'Crawl4ai scraper is not available' });
        return;
      }

      logger.info('Crawl4ai scrape triggered', {
        url: url.slice(0, 100),
        output,
        timeout,
        user: (req as any).user?.email,
      });

      const result = await crawl4aiService.scrapeUrl(url.trim(), {
        output: output || 'markdown',
        timeout: timeout || 60,
        query: query || undefined,
      });

      // Log to activity log
      try {
        const user = (req as any).user;
        await pool.query(
          `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
           VALUES ($1, 'web_scrape', 'url', $2, $3, $4)`,
          [
            user?.clientId || null,
            result.success ? 'info' : 'warn',
            `Scraped ${url.slice(0, 60)} — ${result.success ? 'success' : 'failed'}`,
            JSON.stringify({ url: url.slice(0, 200), duration: result.duration_seconds, success: result.success }),
          ]
        );
      } catch (logErr) {
        logger.warn('Failed to log scrape activity', { error: (logErr as Error).message });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
