// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import schemaGenerator from '../services/schemaGenerator';
import indexNowService from '../services/indexNowService';
import citationTracker from '../services/citationTracker';

console.log('[aiSeo] Module loaded at', new Date().toISOString());

export function createAiSeoRoutes(): Router {
  console.log('[aiSeo] createAiSeoRoutes() called');
  const router = Router();

  // Debug endpoint — remove after verification
  router.get('/ping', (_req: Request, res: Response) => {
    res.json({ ok: true, routes: router.stack.length });
  });

  router.use(authenticate);

  // ─── Schema Generator ──────────────────────

  // POST /api/ai-seo/schema/generate — generate JSON-LD schemas
  router.post('/schema/generate', (req: Request, res: Response) => {
    try {
      const { metadata } = req.body as { metadata: Record<string, any> };
      if (!metadata || !metadata.siteName || !metadata.articleTitle) {
        res.status(400).json({ error: 'metadata with siteName and articleTitle required' });
        return;
      }

      const meta = {
        siteName: metadata.siteName,
        siteUrl: metadata.siteUrl || '',
        articleTitle: metadata.articleTitle,
        articleDescription: metadata.articleDescription || '',
        articleBody: metadata.articleBody || '',
        datePublished: metadata.datePublished || new Date().toISOString(),
        dateModified: metadata.dateModified || new Date().toISOString(),
        authorName: metadata.authorName || '',
        authorUrl: metadata.authorUrl,
        imageUrl: metadata.imageUrl,
        publisherLogo: metadata.publisherLogo,
        faqPairs: metadata.faqPairs,
        productName: metadata.productName,
        productDescription: metadata.productDescription,
        productSku: metadata.productSku,
        productPrice: metadata.productPrice,
        productCurrency: metadata.productCurrency,
        productAvailability: metadata.productAvailability,
        breadcrumbs: metadata.breadcrumbs,
        howToSteps: metadata.howToSteps,
      };

      const schemas = schemaGenerator.generateAllSchemas(meta);
      res.json({ success: true, data: schemas });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/ai-seo/schema/inject — inject schema into HTML
  router.post('/schema/inject', (req: Request, res: Response) => {
    try {
      const { html, metadata } = req.body as { html: string; metadata: Record<string, any> };
      if (!html || !metadata) {
        res.status(400).json({ error: 'html and metadata required' });
        return;
      }

      const meta = {
        siteName: metadata.siteName || '',
        siteUrl: metadata.siteUrl || '',
        articleTitle: metadata.articleTitle || '',
        articleDescription: metadata.articleDescription || '',
        articleBody: metadata.articleBody || '',
        datePublished: metadata.datePublished || new Date().toISOString(),
        dateModified: metadata.dateModified || new Date().toISOString(),
        authorName: metadata.authorName || '',
        authorUrl: metadata.authorUrl,
        imageUrl: metadata.imageUrl,
        publisherLogo: metadata.publisherLogo,
        faqPairs: metadata.faqPairs,
        productName: metadata.productName,
        productDescription: metadata.productDescription,
        productSku: metadata.productSku,
        productPrice: metadata.productPrice,
        productCurrency: metadata.productCurrency,
        productAvailability: metadata.productAvailability,
        breadcrumbs: metadata.breadcrumbs,
        howToSteps: metadata.howToSteps,
      };

      const schemas = schemaGenerator.generateAllSchemas(meta);
      const injected = schemaGenerator.injectSchemaIntoHtml(html, schemas);
      res.json({ success: true, data: { html: injected, schemasInjected: schemas.length } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/ai-seo/schema/extract-faq — extract FAQ pairs from markdown
  router.post('/schema/extract-faq', (req: Request, res: Response) => {
    try {
      const { content } = req.body as { content: string };
      if (!content) {
        res.status(400).json({ error: 'content required' });
        return;
      }
      const faqPairs = schemaGenerator.extractFaqPairsFromContent(content);
      res.json({ success: true, data: faqPairs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ─── IndexNow ──────────────────────────────

  // POST /api/ai-seo/indexnow/ping — ping a single URL
  router.post('/indexnow/ping', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url } = req.body as { url: string };
      if (!url) {
        res.status(400).json({ error: 'url required' });
        return;
      }
      const config = indexNowService.getIndexNowConfig();
      if (!config.host || !config.key) {
        res.status(400).json({ error: 'IndexNow not configured (INDEXNOW_HOST and INDEXNOW_KEY required)' });
        return;
      }
      const result = await indexNowService.pingIndexNow([url], config);
      res.json({ success: result.success, data: result.results });
    } catch (err: any) {
      next(err);
    }
  });

  // POST /api/ai-seo/indexnow/ping-batch — ping multiple URLs
  router.post('/indexnow/ping-batch', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { urls } = req.body as { urls: string[] };
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ error: 'urls array required' });
        return;
      }
      await indexNowService.pingBatchUrls(urls);
      res.json({ success: true, data: { submitted: urls.length } });
    } catch (err: any) {
      next(err);
    }
  });

  // ─── Citation Tracker ──────────────────────

  // GET /api/ai-seo/citations/:domain — check citations for a domain
  router.get('/citations/:domain', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain } = req.params;
      if (!domain) {
        res.status(400).json({ error: 'domain required' });
        return;
      }
      const report = await citationTracker.checkCitations(domain);
      res.json({ success: true, data: report });
    } catch (err: any) {
      next(err);
    }
  });

  // GET /api/ai-seo/citations/:domain/history — get citation history
  router.get('/citations/:domain/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain } = req.params;
      const days = parseInt(req.query.days as string) || 90;
      const history = await citationTracker.getCitationHistory(domain, days);
      const trend = await citationTracker.getCitationTrend(domain, days);
      res.json({ success: true, data: { history, trend } });
    } catch (err: any) {
      next(err);
    }
  });

  // POST /api/ai-seo/citations/audit/:clientId — run monthly audit
  router.post('/citations/audit/:clientId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { clientId } = req.params;
      const { domain } = req.body as { domain: string };
      if (!domain) {
        res.status(400).json({ error: 'domain required in body' });
        return;
      }
      const report = await citationTracker.runMonthlyAudit(clientId, domain);
      res.json({ success: true, data: report });
    } catch (err: any) {
      next(err);
    }
  });

  return router;
}
