// ──────────────────────────────────────────────
// Article Routes
// Generation, CRUD, Approval, Publishing
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, authorizeClientAccess, scopeQueryByClient, requireResourceOwnership } from '../middleware/auth';
import { validate } from '../validators/index';
import {
  generateArticleSchema, updateArticleSchema,
  publishArticleSchema, generateImageSchema
} from '../validators/index';
import { logger, logActivity } from '../utils/logger';
import openaiService from '../services/openai';
import shopifyService from '../services/shopify';
import seoService from '../services/seo';
import internalLinksService from '../services/internalLinks';
import keywordService from '../services/keywords';
import vectorMemoryService from '../services/vectorMemory';
import costTracker from '../services/costTracker';
import { convert } from '../utils/markdownToHtml';

export function createArticleRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // ─── Generate Article ────────────────────────
  router.post('/generate', validate(generateArticleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { keyword, publish, blogId, tone, minWords, maxWords } = (req as any).validated;
      const clientId = user.clientId || req.body.clientId;

      if (!clientId) {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      // Check budget
      const budgetExceeded = await costTracker.isBudgetExceeded(clientId);
      if (budgetExceeded) {
        res.status(402).json({ error: 'Monthly budget exceeded. Please upgrade your plan or wait until next month.' });
        return;
      }

      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1 AND is_active = true', [clientId]);
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Active client not found' });
        return;
      }

      const client = clientResult.rows[0];

      // Check for semantic duplicates
      const isDuplicate = await vectorMemoryService.isDuplicate(clientId, keyword);
      if (isDuplicate) {
        res.status(409).json({
          error: 'A very similar topic has already been covered',
          suggestion: 'Try a different keyword or angle'
        });
        return;
      }

      // Store keyword
      const keywordResult = await pool.query(
        `INSERT INTO keywords (client_id, keyword, source) VALUES ($1, $2, 'manual')
         ON CONFLICT (client_id, keyword) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [clientId, keyword]
      );
      const keywordId = keywordResult.rows[0].id;

      // Refresh internal links cache
      await internalLinksService.refreshArticleCache(
        { shop: client.shopify_shop, accessToken: client.shopify_token },
        clientId,
        blogId
      );

      // Generate content
      const startTime = Date.now();
      const article = await openaiService.generateBlogPost({
        keyword,
        tone: tone || client.brand_voice || 'educational',
        minWords: minWords || parseInt(process.env.CONTENT_MIN_WORDS || '1200'),
        maxWords: maxWords || parseInt(process.env.CONTENT_MAX_WORDS || '2500'),
        clientSettings: client.settings || {}
      });

      // Track OpenAI cost
      if (article.metadata) {
        const { tokensIn = 0, tokensOut = 0, model = 'gpt-4o' } = article.metadata as any;
        const cost = costTracker.calculateOpenAICost(model, tokensIn, tokensOut);
        await costTracker.recordCost({
          client_id: clientId,
          provider: 'openai',
          model,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          cost_usd: cost,
          duration_ms: Date.now() - startTime
        });
      }

      // SEO Analysis
      const seoAnalysis = await seoService.analyzeContent(article.content, keyword);
      const validation = seoService.validateContent(article);

      // Internal linking
      const linkOpportunities = await internalLinksService.findLinkOpportunities(
        article.content, article.title, clientId
      );
      let finalContent = article.content;
      if (linkOpportunities.length > 0) {
        finalContent = internalLinksService.injectLinks(finalContent, linkOpportunities);
      }

      // Convert to HTML
      const contentHtml = convert(finalContent);

      // Check approval mode
      const status = client.approval_mode === 'manual' ? 'generated' : 'approved';

      // Store article
      const articleResult = await pool.query(
        `INSERT INTO articles (client_id, keyword_id, title, slug, content_md, content_html,
                               meta_title, meta_description, tags, word_count, status, seo_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, title, slug, status, word_count, seo_score, created_at`,
        [
          clientId, keywordId, article.title, seoService.generateSlug(article.title),
          finalContent, contentHtml, article.metaTitle, article.metaDescription,
          article.tags, article.content.split(/\s+/).length,
          status, seoAnalysis.score
        ]
      );
      const savedArticle = articleResult.rows[0];

      // Store embeddings for semantic dedup
      await vectorMemoryService.storeArticleChunks(clientId, savedArticle.id, finalContent);

      // Mark keyword used
      await keywordService.markKeywordUsed(keywordId);

      // Auto-publish if approved and publish flag is true
      let publishResult = null;
      if (publish && status === 'approved') {
        try {
          publishResult = await shopifyService.publishArticleWithTracking(pool, client, blogId, savedArticle.id, {
            title: article.title,
            contentHtml,
            metaTitle: article.metaTitle,
            metaDescription: article.metaDescription,
            tags: article.tags
          });
        } catch (publishErr) {
          logger.warn('Auto-publish failed, article saved as draft', {
            articleId: savedArticle.id,
            error: (publishErr as Error).message
          });
        }
      }

      await logActivity(pool, {
        clientId,
        action: 'article_generated',
        entityType: 'article',
        entityId: savedArticle.id,
        level: 'info',
        message: `Article generated: ${article.title}`,
        metadata: { keyword, seoScore: seoAnalysis.score, wordCount: savedArticle.word_count }
      });

      res.status(201).json({
        ...savedArticle,
        seoAnalysis,
        validation,
        linkOpportunities,
        published: !!publishResult,
        publishResult,
        approvalRequired: client.approval_mode === 'manual'
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── List Articles ───────────────────────────
  router.get('/', scopeQueryByClient, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const clientId = user.clientId || req.query.clientId as string;
      const { status, search, limit: limitStr, offset: offsetStr } = req.query;

      const limit = parseInt(limitStr as string, 10) || 20;
      const offset = parseInt(offsetStr as string, 10) || 0;

      if (!clientId && user.role !== 'super_admin' && user.role !== 'admin') {
        res.status(400).json({ error: 'clientId is required' });
        return;
      }

      let query = 'SELECT a.*, k.keyword, k.search_volume, k.competition FROM articles a LEFT JOIN keywords k ON k.id = a.keyword_id';
      const params: any[] = [];
      const conditions: string[] = [];

      if (clientId) {
        params.push(clientId);
        conditions.push(`a.client_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`a.status = $${params.length}`);
      }

      // Full-text search across title, content, and meta fields
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(
          a.title ILIKE $${params.length} OR
          a.content_md ILIKE $${params.length} OR
          a.meta_title ILIKE $${params.length} OR
          a.meta_description ILIKE $${params.length}
        )`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Count total
      const countResult = await pool.query('SELECT COUNT(*) FROM articles a' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''), params);
      const total = parseInt(countResult.rows[0].count, 10);

      query += ' ORDER BY a.created_at DESC';
      params.push(limit);
      query += ` LIMIT $${params.length}`;
      params.push(offset);
      query += ` OFFSET $${params.length}`;

      const result = await pool.query(query, params);

      res.json({
        data: result.rows,
        total,
        limit,
        offset
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Get Latest Article ─────────────────────
  router.get('/latest', scopeQueryByClient, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.query.clientId as string;
      let query = `
        SELECT a.*, k.keyword, k.search_volume, k.competition
        FROM articles a
        LEFT JOIN keywords k ON k.id = a.keyword_id
      `;
      const params: any[] = [];
      if (clientId) {
        query += ' WHERE a.client_id = $1';
        params.push(clientId);
      }
      query += ' ORDER BY a.created_at DESC LIMIT 1';

      const latestResult = await pool.query(query, params);
      if (latestResult.rows.length === 0) {
        res.status(404).json({ error: 'No articles found' });
        return;
      }
      res.json(latestResult.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Get Single Article ─────────────────────
  router.get('/:id', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT a.*, k.keyword, k.search_volume, k.competition
         FROM articles a
         LEFT JOIN keywords k ON k.id = a.keyword_id
         WHERE a.id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Update Article ──────────────────────────
  router.put('/:id', requireResourceOwnership(pool, 'articles'), validate(updateArticleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = (req as any).validated;
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.title) { fields.push(`title = $${paramIndex++}`); values.push(data.title); }
      if (data.contentMd) { fields.push(`content_md = $${paramIndex++}`); values.push(data.contentMd); }
      if (data.metaTitle) { fields.push(`meta_title = $${paramIndex++}`); values.push(data.metaTitle); }
      if (data.metaDescription) { fields.push(`meta_description = $${paramIndex++}`); values.push(data.metaDescription); }
      if (data.tags) { fields.push(`tags = $${paramIndex++}`); values.push(data.tags); }
      if (data.status) { fields.push(`status = $${paramIndex++}`); values.push(data.status); }

      if (fields.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      // If content changed, regenerate HTML
      if (data.contentMd) {
        const html = convert(data.contentMd);
        fields.push(`content_html = $${paramIndex++}`);
        values.push(html);
        fields.push(`word_count = $${paramIndex++}`);
        values.push(data.contentMd.split(/\s+/).length);
      }

      fields.push('updated_at = NOW()');
      values.push(req.params.id);

      const result = await pool.query(
        `UPDATE articles SET ${fields.join(', ')} WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      logger.info('Article updated', { articleId: req.params.id });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Approve Article ─────────────────────────
  router.post('/:id/approve', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `UPDATE articles SET status = 'approved', updated_at = NOW()
         WHERE id = $1 AND status IN ('generated', 'reviewed')
         RETURNING id, title, status`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found or not in reviewable state' });
        return;
      }

      logger.info('Article approved', { articleId: req.params.id });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Reject Article ──────────────────────────
  router.post('/:id/reject', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;

      // Fetch the article first to get client_id
      const articleInfo = await pool.query(
        'SELECT client_id FROM articles WHERE id = $1',
        [req.params.id]
      );

      const result = await pool.query(
        `UPDATE articles SET status = 'rejected', updated_at = NOW()
         WHERE id = $1 AND status IN ('generated', 'reviewed')
         RETURNING id, title, status`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found or not in reviewable state' });
        return;
      }

      const articleClientId = articleInfo.rows[0]?.client_id || result.rows[0].id;

      await logActivity(pool, {
        clientId: articleClientId,
        action: 'article_rejected',
        entityType: 'article',
        entityId: req.params.id,
        level: 'info',
        message: `Article rejected: ${reason || 'No reason provided'}`
      });

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Regenerate Article ──────────────────────
  router.post('/:id/regenerate', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const articleResult = await pool.query(
        'SELECT a.*, k.keyword FROM articles a LEFT JOIN keywords k ON k.id = a.keyword_id WHERE a.id = $1',
        [req.params.id]
      );

      if (articleResult.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      const article = articleResult.rows[0];
      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [article.client_id]);
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const client = clientResult.rows[0];
      const newArticle = await openaiService.generateBlogPost({
        keyword: article.keyword || article.title,
        tone: client.brand_voice || 'educational',
        clientSettings: client.settings || {}
      });

      const contentHtml = convert(newArticle.content);

      await pool.query(
        `UPDATE articles SET title = $1, content_md = $2, content_html = $3,
         meta_title = $4, meta_description = $5, tags = $6,
         word_count = $7, status = 'generated', updated_at = NOW()
         WHERE id = $8`,
        [
          newArticle.title, newArticle.content, contentHtml,
          newArticle.metaTitle, newArticle.metaDescription,
          newArticle.tags, newArticle.content.split(/\s+/).length,
          req.params.id
        ]
      );

      logger.info('Article regenerated', { articleId: req.params.id });
      res.json({ message: 'Article regenerated', title: newArticle.title });
    } catch (err) {
      next(err);
    }
  });

  // ─── Publish Article to Shopify ──────────────
  router.post('/:id/publish', requireResourceOwnership(pool, 'articles'), validate(publishArticleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { blogId } = (req as any).validated;
      const articleResult = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
      if (articleResult.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      const article = articleResult.rows[0];

      if (article.status === 'published') {
        res.status(409).json({ error: 'Article already published' });
        return;
      }

      const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [article.client_id]);
      if (clientResult.rows.length === 0) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const client = clientResult.rows[0];
      const publishResult = await shopifyService.publishArticleWithTracking(pool, client, blogId, article.id, {
        title: article.title,
        contentHtml: article.content_html,
        metaTitle: article.meta_title,
        metaDescription: article.meta_description,
        tags: article.tags
      });

      // Generate and upload image
      try {
        const imageData = await openaiService.generateArticleImage(article.title, article.tags?.[0] || '');
        const shopifyImage = await shopifyService.uploadImage(
          { shop: client.shopify_shop, accessToken: client.shopify_token },
          publishResult.shopifyArticle.id,
          imageData.imageUrl,
          imageData.altText
        );

        await pool.query(
          `INSERT INTO article_images (article_id, client_id, prompt, image_url, shopify_image_id, alt_text)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [article.id, article.client_id, imageData.prompt, imageData.imageUrl, shopifyImage.id, imageData.altText]
        );
      } catch (imgErr) {
        logger.warn('Image generation/upload failed, article published without image', {
          articleId: article.id,
          error: (imgErr as Error).message
        });
      }

      res.json({ success: true, ...publishResult });
    } catch (err) {
      next(err);
    }
  });

  // ─── Article Preview ─────────────────────────
  router.get('/:id/preview', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT a.*, k.keyword, json_agg(json_build_object(
           'url', ai.image_url, 'alt', ai.alt_text, 'position', ai.position
         )) FILTER (WHERE ai.id IS NOT NULL) as images
         FROM articles a
         LEFT JOIN keywords k ON k.id = a.keyword_id
         LEFT JOIN article_images ai ON ai.article_id = a.id
         WHERE a.id = $1
         GROUP BY a.id, k.keyword`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      // Return full preview data
      const article = result.rows[0];
      const seoPreview = article.content_md
        ? seoService.generateSocialPreview(article.content_md, 120)
        : '';

      res.json({
        ...article,
        seoPreview,
        socialPreview: {
          title: article.meta_title || article.title,
          description: article.meta_description || seoPreview,
          image: article.images?.[0]?.url || null
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── SEO Analysis for Article ────────────────
  router.get('/:id/seo', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT a.content_md, a.title, k.keyword
         FROM articles a LEFT JOIN keywords k ON k.id = a.keyword_id
         WHERE a.id = $1`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      const { content_md, keyword } = result.rows[0];
      const analysis = await seoService.analyzeContent(content_md, keyword || result.rows[0].title);
      res.json(analysis);
    } catch (err) {
      next(err);
    }
  });

  return router;
}