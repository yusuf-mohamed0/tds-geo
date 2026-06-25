import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import geoIntelligence from '../services/geoIntelligence';
import openaiService from '../services/openai';
import seoService from '../services/seo';
import internalLinksService from '../services/internalLinks';
import keywordService from '../services/keywords';
import vectorMemoryService from '../services/vectorMemory';
import costTracker from '../services/costTracker';
import { convert } from '../utils/markdownToHtml';
import shopifyService from '../services/shopify';
import { sitesService } from '../services/sitesService';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

function verifySessionToken(token: string): { shopDomain: string; userId: string } | null {
  try {
    const decoded = jwt.verify(token, SHOPIFY_API_SECRET, { algorithms: ['HS256'] }) as any;
    const dest: string = decoded.dest || '';
    const shopDomain = dest.replace(/^https?:\/\//, '').replace(/\/admin$/, '').replace(/\/$/, '');
    return { shopDomain, userId: String(decoded.sub || '') };
  } catch {
    return null;
  }
}

async function authenticateEmbedded(req: Request, res: Response, pool: Pool): Promise<{ clientId: string; shopDomain: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid session token' });
    return null;
  }
  const result = await pool.query(
    'SELECT id FROM clients WHERE shopify_shop = $1 AND is_active = true',
    [payload.shopDomain]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Client not found' });
    return null;
  }
  return { clientId: result.rows[0].id, shopDomain: payload.shopDomain };
}

export function createEmbeddedRoutes(pool: Pool): Router {
  const router = Router();

  router.get('/stats', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      const articleStats = await pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'published')::int AS published,
          COUNT(*) FILTER (WHERE status = 'generated' OR status = 'approved')::int AS pending,
          AVG(seo_score)::numeric AS avg_seo_score
        FROM articles WHERE client_id = $1`,
        [auth.clientId]
      );

      const recentArticles = await pool.query(
        `SELECT id, title, status, created_at FROM articles
         WHERE client_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [auth.clientId]
      );

      res.json({
        articles: articleStats.rows[0] || { total: 0, published: 0, pending: 0, avg_seo_score: null },
        recentArticles: recentArticles.rows,
      });
    } catch (err) {
      logger.error('Embedded stats error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  router.get('/blogs', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      const conn = await pool.query(
        `SELECT config FROM cms_connections
         WHERE client_id = $1 AND provider = 'shopify' AND is_active = true LIMIT 1`,
        [auth.clientId]
      );
      if (conn.rows.length === 0) {
        res.json({ blogs: [] });
        return;
      }
      const { shop, accessToken, apiVersion } = conn.rows[0].config;
      const shopifyRes = await fetch(`https://${shop}/admin/api/${apiVersion || '2024-07'}/blogs.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });
      const data: any = await shopifyRes.json();
      res.json({ blogs: data.blogs || [] });
    } catch (err) {
      logger.error('Embedded blogs error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to fetch blogs' });
    }
  });

  async function syncFromShopify(clientId: string): Promise<void> {
    try {
      const conn = await pool.query(
        `SELECT config FROM cms_connections WHERE client_id = $1 AND provider = 'shopify' AND is_active = true LIMIT 1`,
        [clientId]
      );
      if (conn.rows.length === 0) return;
      const config = conn.rows[0].config;

      const shopifyRes = await fetch(
        `https://${config.shop}/admin/api/${config.apiVersion || '2024-07'}/articles.json?limit=250&fields=id,title,body_html,summary_html,handle,published_at,updated_at,tags,author`,
        { headers: { 'X-Shopify-Access-Token': config.accessToken } }
      );
      if (!shopifyRes.ok) return;
      const data: any = await shopifyRes.json();
      const shopifyArticles = data.articles || [];

      for (const sa of shopifyArticles) {
        const existing = await pool.query(
          `SELECT id, status FROM articles WHERE client_id = $1 AND title = $2`,
          [clientId, sa.title]
        );
        if (existing.rows.length === 0) {
          const slug = (sa.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
          await pool.query(
            `INSERT INTO articles (client_id, title, slug, content_html, content_md, status, word_count, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $4, 'published', $5, $6, $7)`,
            [clientId, sa.title, slug, sa.body_html || '', sa.word_count || 0, sa.published_at, sa.updated_at]
          );
        } else if (existing.rows[0].status !== 'published') {
          await pool.query(
            `UPDATE articles SET status = 'published' WHERE id = $1`,
            [existing.rows[0].id]
          );
        }
      }

      const shopifyTitles = shopifyArticles.map((a: any) => a.title);
      if (shopifyTitles.length > 0) {
        await pool.query(
          `UPDATE articles SET status = 'approved' WHERE client_id = $1 AND status = 'published' AND title != ALL($2)`,
          [clientId, shopifyTitles]
        );
      }

      if (config.shop) {
        await sitesService.recordSync(config.shop, 'shopify').catch(() => {});
      }
    } catch (err) {
      logger.warn('Auto-sync from Shopify failed', { error: (err as Error).message });
    }
  }

  router.get('/articles', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      await syncFromShopify(auth.clientId);

      const result = await pool.query(
        `SELECT id, title, status, seo_score, word_count, created_at
         FROM articles WHERE client_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [auth.clientId]
      );
      res.json({ articles: result.rows });
    } catch (err) {
      logger.error('Embedded articles error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to fetch articles' });
    }
  });

  router.post('/articles/generate', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      const { keyword } = req.body;
      if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
        res.status(400).json({ error: 'Keyword must be at least 2 characters' });
        return;
      }

      const budgetExceeded = await costTracker.isBudgetExceeded(auth.clientId);
      if (budgetExceeded) {
        res.status(402).json({ error: 'Monthly budget exceeded' });
        return;
      }

      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1 AND is_active = true', [auth.clientId]);
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      const client = clientResult.rows[0];

      const isDuplicate = await vectorMemoryService.isDuplicate(auth.clientId, keyword);
      if (isDuplicate) {
        res.status(409).json({ error: 'A very similar topic has already been covered. Try a different keyword.' });
        return;
      }

      const keywordResult = await pool.query(
        `INSERT INTO keywords (client_id, keyword, source) VALUES ($1, $2, 'manual')
         ON CONFLICT (client_id, keyword) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [auth.clientId, keyword]
      );
      const keywordId = keywordResult.rows[0].id;

      const startTime = Date.now();
      const article = await openaiService.generateBlogPost({
        keyword,
        tone: client.brand_voice || 'educational',
        minWords: 1200,
        maxWords: 2500,
        clientSettings: client.settings || {}
      });

      if (article.metadata) {
        const { tokensIn = 0, tokensOut = 0, model = 'deepseek/deepseek-v4-flash' } = article.metadata as any;
        const cost = costTracker.calculateOpenAICost(model, tokensIn, tokensOut);
        await costTracker.recordCost({
          client_id: auth.clientId,
          provider: 'openai', model,
          tokens_in: tokensIn, tokens_out: tokensOut,
          cost_usd: cost, duration_ms: Date.now() - startTime
        });
      }

      const seoAnalysis = await seoService.analyzeContent(article.content, keyword);
      const linkOpportunities = await internalLinksService.findLinkOpportunities(
        article.content, article.title, auth.clientId
      );
      let finalContent = article.content;
      if (linkOpportunities.length > 0) {
        finalContent = internalLinksService.injectLinks(finalContent, linkOpportunities);
      }
      const contentHtml = convert(finalContent);
      const status = client.approval_mode === 'manual' ? 'generated' : 'approved';

      const articleResult = await pool.query(
        `INSERT INTO articles (client_id, keyword_id, title, slug, content_md, content_html,
                               meta_title, meta_description, tags, word_count, status, seo_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, title, status, seo_score, word_count, created_at`,
        [
          auth.clientId, keywordId, article.title,
          seoService.generateSlug(article.title) + '-' + Date.now().toString(36).slice(-4),
          finalContent, contentHtml, article.metaTitle, article.metaDescription,
          article.tags, article.content.split(/\s+/).length,
          status, seoAnalysis.score
        ]
      );
      const savedArticle = articleResult.rows[0];

      await vectorMemoryService.storeArticleChunks(auth.clientId, savedArticle.id, finalContent);
      await keywordService.markKeywordUsed(keywordId);

      logger.info('Embedded article generated', { clientId: auth.clientId, articleId: savedArticle.id });
      res.json({ article: savedArticle });
    } catch (err) {
      logger.error('Embedded article generate error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to generate article' });
    }
  });

  router.post('/articles/publish-all', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      const articles = await pool.query(
        `SELECT * FROM articles WHERE client_id = $1 AND status = 'approved'
         ORDER BY created_at ASC`,
        [auth.clientId]
      );

      if (articles.rows.length === 0) {
        res.json({ published: 0, message: 'No articles to publish' });
        return;
      }

      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [auth.clientId]);
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }
      const client = clientResult.rows[0];

      const blogResult = await pool.query(
        `SELECT config FROM cms_connections WHERE client_id = $1 AND provider = 'shopify' AND is_active = true LIMIT 1`,
        [auth.clientId]
      );
      let blogId: number | null = null;
      if (blogResult.rows.length > 0) {
        try {
          const blogs = await shopifyService.fetchBlogs(blogResult.rows[0].config);
          blogId = blogs[0]?.id || null;
        } catch { /* */ }
      }

      const results: { id: string; title: string; success: boolean; error?: string }[] = [];
      for (const article of articles.rows) {
        try {
          await shopifyService.publishArticleWithTracking(pool, client, blogId, article.id, {
            title: article.title,
            contentHtml: article.content_html,
            metaTitle: article.meta_title,
            metaDescription: article.meta_description,
            tags: article.tags || [],
          });
          const shopDomain = client.shopify_shop || '';
          if (shopDomain) {
            await sitesService.recordPublish(shopDomain, 'shopify').catch(() => {});
          }
          results.push({ id: article.id, title: article.title, success: true });
        } catch (err) {
          results.push({ id: article.id, title: article.title, success: false, error: (err as Error).message });
        }
      }

      const succeeded = results.filter(r => r.success).length;
      logger.info('Embedded publish-all completed', { clientId: auth.clientId, succeeded, failed: results.length - succeeded });
      res.json({ published: succeeded, failed: results.length - succeeded, results });
    } catch (err) {
      logger.error('Embedded publish-all error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to publish articles' });
    }
  });

  router.post('/articles/sync', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      const conn = await pool.query(
        `SELECT config FROM cms_connections WHERE client_id = $1 AND provider = 'shopify' AND is_active = true LIMIT 1`,
        [auth.clientId]
      );
      if (conn.rows.length === 0) {
        res.status(404).json({ error: 'No Shopify connection found' });
        return;
      }
      const config = conn.rows[0].config;

      const shopifyArticles = await shopifyService.fetchArticles(config);
      let synced = 0;

      for (const sa of shopifyArticles) {
        const existing = await pool.query(
          `SELECT id FROM articles WHERE client_id = $1 AND title = $2`,
          [auth.clientId, sa.title]
        );

        if (existing.rows.length === 0) {
          const slug = (sa.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
          await pool.query(
            `INSERT INTO articles (client_id, title, slug, content_html, status, word_count, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'published', $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            [auth.clientId, sa.title, slug, sa.body_html || '', sa.word_count || 0, sa.published_at, sa.updated_at]
          );
          synced++;
        }
      }

      const shopDomain = config?.shop || '';
      if (shopDomain) {
        await sitesService.recordSync(shopDomain, 'shopify').catch(() => {});
      }

      logger.info('Embedded sync completed', { clientId: auth.clientId, synced });
      res.json({ synced, total: shopifyArticles.length });
    } catch (err) {
      logger.error('Embedded sync error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to sync articles' });
    }
  });

  router.post('/geo/analyze', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      const { content } = req.body;
      if (!content || content.length < 50) {
        res.status(400).json({ error: 'Content must be at least 50 characters' });
        return;
      }
      const analysis = await geoIntelligence.analyze(content);
      res.json(analysis);
    } catch (err) {
      logger.error('Embedded GEO analyze error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to analyze content' });
    }
  });

  router.post('/geo/improve', async (req: Request, res: Response) => {
    const auth = await authenticateEmbedded(req, res, pool);
    if (!auth) return;

    try {
      const { content } = req.body;
      if (!content || content.length < 50) {
        res.status(400).json({ error: 'Content must be at least 50 characters' });
        return;
      }
      const result = await geoIntelligence.improveContent(content);
      res.json(result);
    } catch (err) {
      logger.error('Embedded GEO improve error', { error: (err as Error).message });
      res.status(500).json({ error: 'Failed to improve content' });
    }
  });

  return router;
}
