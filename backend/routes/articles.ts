// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Article Routes
// Generation, CRUD, Approval, Publishing
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, authorizeClientAccess, scopeQueryByClient, requireResourceOwnership } from '../middleware/auth';
import { clientRateLimit } from '../middleware/rateLimiter';
import { validate } from '../validators/index';
import {
  generateArticleSchema, updateArticleSchema,
  publishArticleSchema, generateImageSchema
} from '../validators/index';
import { logger, logActivity } from '../utils/logger';
import { generateContent, getJobResult } from '../services/pipelineService';
import openaiService from '../services/openai';
import shopifyService from '../services/shopify';
import { publisherEngine } from '../engines/publisher';
import seoService from '../services/seo';
import internalLinksService from '../services/internalLinks';
import keywordService from '../services/keywords';
import vectorMemoryService from '../services/vectorMemory';
import costTracker from '../services/costTracker';
import { convert } from '../utils/markdownToHtml';
import schemaGenerator from '../services/schemaGenerator';
import indexNowService from '../services/indexNowService';
import contentQualityGate from '../services/contentQualityGate';
import serpContentScorer from '../services/serpContentScorer';

export function createArticleRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // ─── Generate Article ────────────────────────
  router.post('/generate', clientRateLimit({ windowMs: 60_000, max: 10, name: 'generate', message: 'Generate limit reached. Max 10 requests per minute per client.' }), validate(generateArticleSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { keyword, publish, blogId, tone, minWords, maxWords } = (req as any).validated;
      let clientId = user.clientId || req.body.clientId;

      if (!clientId) {
        if (user.role === 'admin' || user.role === 'super_admin') {
          const defaultClient = await pool.query("SELECT id FROM clients WHERE is_active = true ORDER BY created_at DESC LIMIT 1");
          if (defaultClient.rows.length > 0) {
            clientId = defaultClient.rows[0].id;
          }
        }
        if (!clientId) {
          res.status(400).json({ error: 'clientId is required' });
          return;
        }
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

      // Generate content via pipeline (BullMQ if available, direct otherwise)
      const generateResult = await generateContent(clientId, keyword, {
        tone: tone || client.brand_voice || 'educational',
        minWords: minWords || parseInt(process.env.CONTENT_MIN_WORDS || '1200'),
        maxWords: maxWords || parseInt(process.env.CONTENT_MAX_WORDS || '2500'),
        clientSettings: client.settings || {}
      });

      // If queued async, return job ID and status endpoint
      if (generateResult.queued) {
        res.status(202).json({
          queued: true,
          jobId: generateResult.jobId,
          message: 'Content generation queued. Poll /articles/job/:jobId for status.',
        });
        return;
      }

      const article = generateResult.article!;

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

      // Quality Gate — anti-spam, anti-fluff, anti-duplicate
      const existingArticlesResult = await pool.query(
        'SELECT title, content_md as content FROM articles WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20',
        [clientId]
      );
      const qualityGateResult = await contentQualityGate.evaluate(finalContent, keyword, {
        minWords: 800,
        maxWords: 3000,
        existingArticles: existingArticlesResult.rows,
      });
      const qualityReport = contentQualityGate.generateClientReport(qualityGateResult);

      // Hard reject if quality is critically low
      if (qualityGateResult.score < 40 && client.approval_mode !== 'manual') {
        res.status(422).json({
          error: 'Content quality check failed — score too low for auto-approve',
          qualityReport,
          qualityGate: qualityGateResult,
          suggestion: 'Try a different keyword angle or adjust tone settings',
        });
        return;
      }
      // Log quality warning even if approved
      if (qualityGateResult.score < 60) {
        logger.warn('Quality gate warning', {
          clientId, keyword, score: qualityGateResult.score,
          warnings: qualityGateResult.warnings,
        });
      }

      // SERP Content Scoring — evaluate against top-ranking competitors
      let serpScoreResult = null;
      try {
        serpScoreResult = await serpContentScorer.score(finalContent, article.title, keyword);
        if (serpScoreResult.score < 40) {
          logger.warn('SERP score low', {
            clientId, keyword, serpScore: serpScoreResult.score,
            improvements: serpScoreResult.improvements,
          });
        }
      } catch (serpErr) {
        logger.warn('SERP scoring failed, continuing without it', {
          error: (serpErr as Error).message,
        });
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
         RETURNING id, title, slug, content_md, content_html,
                  meta_title, meta_description, tags, status, word_count, seo_score, created_at`,
        [
          clientId, keywordId, article.title, seoService.generateSlug(article.title) + '-' + Date.now().toString(36).slice(-4),
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
          // Inject JSON-LD schema before publishing
          let publishHtml = contentHtml;
          try {
            const faqPairs = schemaGenerator.extractFaqPairsFromContent(finalContent);
            const schemas = schemaGenerator.generateAllSchemas({
              siteName: client.name || process.env.SITE_NAME || '',
              siteUrl: client.shopify_shop ? `https://${client.shopify_shop}` : '',
              articleTitle: article.title,
              articleDescription: article.metaDescription || '',
              articleBody: finalContent,
              datePublished: new Date().toISOString(),
              dateModified: new Date().toISOString(),
              authorName: process.env.AUTHOR_NAME || 'AI SEO Agent',
              faqPairs: faqPairs.length > 0 ? faqPairs : undefined,
            });
            publishHtml = schemaGenerator.injectSchemaIntoHtml(contentHtml, schemas);
          } catch (schemaErr) {
            logger.warn('Schema injection failed for auto-publish', {
              articleId: savedArticle.id,
              error: (schemaErr as Error).message,
            });
          }

          publishResult = await publisherEngine.publishWithTracking(pool, { ...savedArticle, content_html: publishHtml }, client, blogId);

          // Ping IndexNow
          if (publishResult?.url) {
            indexNowService.pingArticlePublished(publishResult.url).catch(err => {
              logger.warn('IndexNow ping failed after auto-publish', {
                articleId: savedArticle.id,
                error: (err as Error).message,
              });
            });
          }
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
        approvalRequired: client.approval_mode === 'manual',
        qualityGate: qualityGateResult,
        qualityReport,
        serpScore: serpScoreResult,
        success: true,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Job Status (async generation) ──────────
  router.get('/job/:jobId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getJobResult(req.params.jobId);
      res.json(result);
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

      let query = `SELECT a.id, a.client_id, a.keyword_id, a.title, a.slug, a.meta_title, a.meta_description, a.tags, a.word_count, a.status, a.seo_score, a.quality_score, a.readability_score, a.source, a.scheduled_at, a.published_at, a.created_at, a.updated_at, a.editorial_status, k.keyword, k.search_volume, k.competition FROM articles a JOIN clients c ON c.id = a.client_id AND c.is_active = true LEFT JOIN keywords k ON k.id = a.keyword_id`;
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

  // ─── Connector Version Check ─────────────────
  router.get('/connector-version', async (_req: Request, res: Response) => {
    const latestVersion = process.env.CONNECTOR_EXPECTED_VERSION || '3.0.0';
    res.json({
      success: true,
      data: {
        latest_version: latestVersion,
        download_url: process.env.CONNECTOR_DOWNLOAD_URL || '',
        min_php_version: '7.4',
        min_wp_version: '5.8',
        changelog: 'https://github.com/yusuf-mohamed0/KOZMO-Core/releases',
      },
    });
  });

  // ─── Suggest Topics ──────────────────────────
  router.post('/suggest-topics', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { count = 5 } = req.body;
      const system = `You are a content strategist. Suggest ${count} specific, SEO-optimized blog post topics.`;
      const user = `Suggest ${count} specific, engaging blog topic ideas. Make each topic specific and SEO-friendly. Return JSON: {"topics": ["topic1", "topic2", ...]}.`;

      const result = await openaiService.chat([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], { maxTokens: 500 });

      let topics: string[] = [];
      try {
        const parsed = JSON.parse(result || '{}');
        topics = parsed.topics || [];
      } catch {
        topics = [];
      }

      res.json({ topics: topics.slice(0, count) });
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
  router.post('/:id/regenerate', clientRateLimit({ windowMs: 60_000, max: 10, name: 'regenerate', message: 'Regenerate limit reached. Max 10 requests per minute per client.' }), requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
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
  router.post('/:id/publish', clientRateLimit({ windowMs: 60_000, max: 20, name: 'publish', message: 'Publish limit reached. Max 20 requests per minute per client.' }), requireResourceOwnership(pool, 'articles'), validate(publishArticleSchema), async (req: Request, res: Response, next: NextFunction) => {
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

      // Inject JSON-LD schema into content before publishing
      let contentHtml = article.content_html || convert(article.content_md || '');
      try {
        const faqPairs = schemaGenerator.extractFaqPairsFromContent(article.content_md || '');
        const schemas = schemaGenerator.generateAllSchemas({
          siteName: client.name || process.env.SITE_NAME || '',
          siteUrl: client.shopify_shop ? `https://${client.shopify_shop}` : '',
          articleTitle: article.title,
          articleDescription: article.meta_description || '',
          articleBody: article.content_md || '',
          datePublished: article.created_at?.toISOString?.() || new Date().toISOString(),
          dateModified: new Date().toISOString(),
          authorName: process.env.AUTHOR_NAME || 'AI SEO Agent',
          faqPairs: faqPairs.length > 0 ? faqPairs : undefined,
        });
        contentHtml = schemaGenerator.injectSchemaIntoHtml(contentHtml, schemas);
        article.content_html = contentHtml;
      } catch (schemaErr) {
        logger.warn('Schema injection failed, publishing without schema', {
          articleId: article.id,
          error: (schemaErr as Error).message,
        });
      }

      const publishResult = await publisherEngine.publishWithTracking(pool, article, client, blogId);

      // Ping IndexNow with the published article URL
      if (publishResult?.url) {
        indexNowService.pingArticlePublished(publishResult.url).catch(err => {
          logger.warn('IndexNow ping failed after publish', {
            articleId: article.id,
            error: (err as Error).message,
          });
        });
      }

      // Generate and upload image
      try {
        const imageData = await openaiService.generateArticleImage(article.title, article.tags?.[0] || '');
        const shopifyImage = await shopifyService.uploadImage(
          { shop: client.shopify_shop, accessToken: client.shopify_token },
          publishResult.externalId || article.id,
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

      res.json({ ...publishResult, success: true });
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

  // ─── Schedule Article Publishing ────────────
  router.post('/:id/schedule', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scheduledAt } = req.body;
      if (!scheduledAt) {
        res.status(400).json({ error: 'scheduledAt is required (ISO 8601 timestamp)' });
        return;
      }

      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: 'Invalid date format. Use ISO 8601 (e.g., 2026-01-15T10:00:00Z)' });
        return;
      }

      if (scheduledDate <= new Date()) {
        res.status(400).json({ error: 'Scheduled time must be in the future' });
        return;
      }

      const result = await pool.query(
        `UPDATE articles SET scheduled_at = $1, updated_at = NOW()
         WHERE id = $2 AND status IN ('approved', 'generated', 'draft')
         RETURNING id, title, status, scheduled_at`,
        [scheduledDate, req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found or not in a schedulable state' });
        return;
      }

      logger.info('Article scheduled for publishing', {
        articleId: req.params.id,
        scheduledAt: scheduledDate.toISOString(),
      });

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ─── Cancel Schedule ────────────────────────
  router.delete('/:id/schedule', requireResourceOwnership(pool, 'articles'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `UPDATE articles SET scheduled_at = NULL, updated_at = NOW()
         WHERE id = $1 AND scheduled_at IS NOT NULL
         RETURNING id, title, status, scheduled_at`,
        [req.params.id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found or no schedule to cancel' });
        return;
      }

      logger.info('Article schedule cancelled', { articleId: req.params.id });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  return router;
}