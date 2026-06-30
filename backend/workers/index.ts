// ──────────────────────────────────────────────
// BullMQ Worker Registration
// All queue workers with handlers
// ──────────────────────────────────────────────

import 'dotenv/config';
import { Job } from 'bullmq';
import { Pool } from 'pg';
import { logger, logActivity, initLogBuffer, closeLogBuffer } from '../utils/logger';
import clientScraper from '../services/clientScraper';
import {
  QueueNames,
  createWorker,
  addJob,
  closeAll,
  getConnection
} from '../utils/queue';
import openaiService from '../services/openai';
import serpapiService from '../services/serpapi';
import shopifyService from '../services/shopify';
import keywordService from '../services/keywords';
import seoService from '../services/seo';
import internalLinksService from '../services/internalLinks';
import webhookService from '../services/webhooks';
import vectorMemoryService from '../services/vectorMemory';
import costTracker from '../services/costTracker';
import { convert } from '../utils/markdownToHtml';

// ─── Pool ─────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

// ─── Enterprise Service Imports ──────────────
import factCheckService from '../services/factCheckService';
import seoIntelligence from '../services/seoIntelligence';
import brandVoiceService from '../services/brandVoice';
import multiCmsPublisher from '../services/multiCmsPublisher';
import pexelsService from '../services/pexelsService';
import costOptimization from '../services/costOptimization';
import editorialWorkflowService from '../services/editorialWorkflow';
import observabilityService from '../services/observability';
import enterpriseSecurity from '../services/enterpriseSecurity';
import contentIntelligence from '../services/contentIntelligence';
import aiEvaluationService from '../services/aiEvaluation';
import circuitBreakerService from '../services/circuitBreaker';
import odooConnector from '../services/odooConnector';

// ─── Initialize Services ────────────────────
function initializeServices(): void {
  // Initialize LogBuffer for async batch DB logging
  initLogBuffer(pool);

  try {
    openaiService.initialize();
    logger.info('OpenAI service initialized for workers');
  } catch (e) {
    logger.warn(`OpenAI not configured for workers: ${(e as Error).message}`);
  }

  shopifyService.init(pool);
  keywordService.initialize(pool);
  internalLinksService.initialize(pool);
  vectorMemoryService.initialize(pool);
  webhookService.initialize(pool);

  // Initialize Enterprise Services
  factCheckService.initialize(pool);
  seoIntelligence.initialize(pool);
  brandVoiceService.initialize(pool);
  multiCmsPublisher.initialize(pool);
  pexelsService.initialize(pool);
  clientScraper.initialize(pool);
  costOptimization.getInstance().initialize(pool);
  editorialWorkflowService.initialize(pool);
  observabilityService.initialize(pool);
  enterpriseSecurity.initialize(pool);
  contentIntelligence.initialize(pool);
  aiEvaluationService.initialize(pool);
  circuitBreakerService.initialize(pool);
  odooConnector.initialize(pool);

  logger.info('All enterprise services initialized for workers');

  // Note: getConnection() is lazy — Redis connection is established
  // when the first worker or job is created. If REDIS_URL is not set,
  // workers will still start and log a warning, but will fail on actual
  // job processing. This is intentional for development mode.
  if (!process.env.REDIS_URL) {
    logger.warn('No REDIS_URL set — BullMQ workers require Redis to process jobs. Starting in standby mode.');
  } else {
    logger.info('Redis URL configured — workers will connect on first job');
  }
}

// ══════════════════════════════════════════════
// Worker Handlers
// ══════════════════════════════════════════════

// ─── Content Generation Worker ─────────────
async function handleContentGeneration(job: Job): Promise<Record<string, unknown>> {
  const { clientId, keyword, tone, minWords, maxWords, clientSettings } = job.data;

  logger.info('Worker: Generating content', { keyword, clientId });

  const article = await openaiService.generateBlogPost({
    keyword,
    tone: tone || 'educational',
    minWords: minWords || 1200,
    maxWords: maxWords || 2500,
    clientSettings: clientSettings || {}
  });

  // Track cost
  if (article.metadata) {
    const { tokensIn = 0, tokensOut = 0, model = 'gpt-4o' } = article.metadata as any;
    const cost = costTracker.calculateOpenAICost(model, tokensIn, tokensOut);
    await costTracker.recordCost({
      client_id: clientId,
      provider: 'openai',
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: cost
    });
  }

  return {
    title: article.title,
    content: article.content,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    tags: article.tags,
    faqSection: article.faqSection || '',
    metadata: article.metadata || undefined,
  };
}

// ─── Keyword Research Worker ───────────────
async function handleKeywordResearch(job: Job): Promise<Record<string, unknown>> {
  const { clientId, seedKeywords, industry } = job.data;

  logger.info('Worker: Researching keywords', { clientId, seedKeywords });

  // Use SerpAPI for real data
  const results = [];
  for (const seed of seedKeywords || []) {
    try {
      const data = await serpapiService.getKeywordData(seed);
      results.push(data);
      // Rate limit: 1 req/s
      await new Promise(resolve => setTimeout(resolve, 1100));
    } catch (err) {
      logger.warn(`Keyword research failed for "${seed}"`, { error: (err as Error).message });
    }
  }

  // Store in database
  const stored: string[] = [];
  for (const data of results) {
    try {
      const result = await pool.query(
        `INSERT INTO keywords (client_id, keyword, search_volume, competition, relevance_score, source, metadata)
         VALUES ($1, $2, $3, $4, $5, 'serpapi', $6)
         ON CONFLICT (client_id, keyword) DO UPDATE SET search_volume = EXCLUDED.search_volume
         RETURNING id`,
        [clientId, data.keyword, data.search_volume, data.competition,
         Math.round((data.search_volume / 1000) * 50 + (1 - data.competition) * 50),
         JSON.stringify({ cpc: data.cpc, trend_score: data.trend_score, source: 'serpapi_worker' })]
      );
      stored.push(result.rows[0].id);
    } catch (err) {
      logger.warn(`Failed to store keyword: ${data.keyword}`, { error: (err as Error).message });
    }
  }

  return { keywordsStored: stored.length, totalResults: results.length };
}

// ─── Shopify Publish Worker ──────────────────
async function handleShopifyPublish(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, blogId } = job.data;

  logger.info('Worker: Publishing to Shopify', { articleId, blogId });

  const articleResult = await pool.query(
    'SELECT a.*, c.shopify_shop, c.shopify_token, c.shopify_api_version FROM articles a JOIN clients c ON c.id = a.client_id WHERE a.id = $1',
    [articleId]
  );

  if (articleResult.rows.length === 0) {
    throw new Error(`Article ${articleId} not found`);
  }

  const row = articleResult.rows[0];
  const shopConfig = {
    shop: row.shopify_shop,
    accessToken: row.shopify_token,
    apiVersion: row.shopify_api_version
  };

  let targetBlogId = blogId;
  if (!targetBlogId) {
    const blogs = await shopifyService.fetchBlogs(shopConfig);
    targetBlogId = blogs[0]?.id;
    if (!targetBlogId) throw new Error('No Shopify blogs found');
  }

  const publishResult = await shopifyService.publishArticle(shopConfig, targetBlogId, {
    title: row.title,
    contentHtml: row.content_html,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    tags: row.tags
  });

  // Record publishing history
  await pool.query(
    `INSERT INTO publishing_history (article_id, client_id, shopify_article_id, shopify_blog_id, published_url, status)
     VALUES ($1, $2, $3, $4, $5, 'published')`,
    [articleId, clientId, publishResult.id, targetBlogId, publishResult.url]
  );

  await pool.query(`UPDATE articles SET status = 'published', updated_at = NOW() WHERE id = $1`, [articleId]);

  await logActivity(pool, {
    clientId,
    action: 'article_published',
    entityType: 'article',
    entityId: articleId,
    level: 'info',
    message: `Article published via worker: ${row.title}`
  });

  return {
    shopifyId: publishResult.id,
    url: publishResult.url,
    handle: publishResult.handle
  };
}

// ─── Image Generation Worker ────────────────
async function handleImageGeneration(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, articleTitle, keyword } = job.data;

  logger.info('Worker: Generating image', { articleId, keyword });

  const imageData = await openaiService.generateArticleImage(articleTitle, keyword);
  const articleResult = await pool.query('SELECT * FROM articles WHERE id = $1', [articleId]);

  if (articleResult.rows.length === 0) {
    throw new Error(`Article ${articleId} not found`);
  }

  const article = articleResult.rows[0];
  const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
  if (clientResult.rows.length === 0) throw new Error(`Client ${clientId} not found`);

  const client = clientResult.rows[0];
  const shopConfig = {
    shop: client.shopify_shop,
    accessToken: client.shopify_token,
    apiVersion: client.shopify_api_version
  };

  // If published, upload image to Shopify
  let shopifyImageId = null;
  if (article.status === 'published' && article.publishing_history?.[0]?.shopify_article_id) {
    const pubResult = await pool.query(
      'SELECT shopify_article_id FROM publishing_history WHERE article_id = $1 AND status = $2 LIMIT 1',
      [articleId, 'published']
    );

    if (pubResult.rows.length > 0) {
      try {
        const shopifyImage = await shopifyService.uploadImage(
          shopConfig,
          pubResult.rows[0].shopify_article_id,
          imageData.imageUrl,
          imageData.altText
        );
        shopifyImageId = shopifyImage.id;
      } catch (err) {
        logger.warn('Shopify image upload failed, storing URL only', { error: (err as Error).message });
      }
    }
  }

  await pool.query(
    `INSERT INTO article_images (article_id, client_id, prompt, image_url, shopify_image_id, alt_text)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [articleId, clientId, imageData.prompt, imageData.imageUrl, shopifyImageId, imageData.altText]
  );

  return { imageUrl: imageData.imageUrl, altText: imageData.altText, shopifyImageId };
}

// ─── SEO Analysis Worker ────────────────────
async function handleSeoAnalysis(job: Job): Promise<Record<string, unknown>> {
  const { articleId, content, keyword } = job.data;

  logger.info('Worker: Analyzing SEO', { articleId, keyword });

  const analysis = await seoService.analyzeContent(content, keyword);

  await pool.query(
    `UPDATE articles SET seo_score = $1, updated_at = NOW() WHERE id = $2`,
    [analysis.score, articleId]
  );

  return {
    score: analysis.score,
    keywordDensity: analysis.keywordDensity,
    readabilityScore: analysis.readabilityScore,
    suggestions: analysis.suggestions
  };
}

// ─── Internal Linking Worker ────────────────
async function handleInternalLinking(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, content, title } = job.data;

  logger.info('Worker: Finding internal links', { articleId });

  const opportunities = await internalLinksService.findLinkOpportunities(content, title, clientId);

  if (opportunities.length > 0) {
    const linkedContent = internalLinksService.injectLinks(content, opportunities);

    // Regenerate HTML with links
    const contentHtml = convert(linkedContent);

    await pool.query(
      `UPDATE articles SET content_md = $1, content_html = $2, updated_at = NOW() WHERE id = $3`,
      [linkedContent, contentHtml, articleId]
    );

    return { linksInjected: opportunities.length, opportunities };
  }

  return { linksInjected: 0, opportunities: [] };
}

// ─── Webhook Delivery Worker ────────────────
async function handleWebhookDelivery(job: Job): Promise<Record<string, unknown>> {
  const { event, clientId, payload } = job.data;

  logger.info('Worker: Delivering webhooks', { event, clientId });

  await webhookService.trigger(event, clientId, payload);

  return { event, clientId, triggered: true };
}

// ─── Content Embedding Worker ───────────────
async function handleContentEmbedding(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, content } = job.data;

  logger.info('Worker: Generating embeddings', { articleId });

  await vectorMemoryService.storeArticleChunks(clientId, articleId, content);

  return { articleId, stored: true };
}

// ══════════════════════════════════════════════
// Enterprise Worker Handlers
// ══════════════════════════════════════════════

// ─── Fact Check Worker ───────────────────────
async function handleFactCheck(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, content } = job.data;
  logger.info('Worker: Fact checking content', { articleId });

  if (articleId && clientId && content) {
    const result = await factCheckService.verifyArticle(articleId, clientId, content);

    if (result.requiresHumanReview) {
      await editorialWorkflowService.createReviewAssignment({
        article_id: articleId,
        client_id: clientId,
        review_type: 'fact_check',
        priority: 1,
        due_at: new Date(Date.now() + 86400000)
      });
    }

    return {
      claimCount: result.factChecks.length,
      citationCount: result.citations.length,
      overallConfidence: result.overallConfidence,
      requiresReview: result.requiresHumanReview
    };
  }

  return { claimCount: 0, citationCount: 0, overallConfidence: 1, requiresReview: false };
}

// ─── Brand Voice Worker ──────────────────────
async function handleBrandVoice(job: Job): Promise<Record<string, unknown>> {
  const { clientId, generateProfile } = job.data;
  logger.info('Worker: Processing brand voice', { clientId });

  if (generateProfile && clientId) {
    // Get brand voice guidance which also fetches/creates profile
    const guidance = await brandVoiceService.getContentGuidance(clientId);
    
    // Store sample embeddings from recent articles
    try {
      const articles = await pool.query(
        'SELECT content_md FROM articles WHERE client_id = $1 AND content_md IS NOT NULL LIMIT 5',
        [clientId]
      );
      for (const article of articles.rows) {
        const snippet = (article.content_md || '').slice(0, 500);
        if (snippet.length > 100) {
          await brandVoiceService.storeSampleEmbedding(clientId, snippet, 'article');
        }
      }
    } catch { /* non-critical */ }

    return {
      profileExtracted: true,
      forbiddenPhrases: guidance.forbiddenPhrases,
      sampleSnippetsStored: true
    };
  }

  return { profileExtracted: false };
}

// ─── SEO Intelligence Worker ─────────────────
async function handleSeoIntelligence(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, content, keyword, analysisType } = job.data;
  logger.info('Worker: Running SEO intelligence', { articleId, keyword, analysisType });

  switch (analysisType) {
    case 'serp_analysis': {
      const serpData = await seoIntelligence.analyzeSERP(keyword);
      return { type: 'serp_analysis', ...serpData, keyword };
    }
    case 'entity_extraction': {
      if (content) {
        const entities = await seoIntelligence.extractEntities(content);
        return { type: 'entity_extraction', entityCount: entities.entities.length, entities: entities.entities };
      }
      return { type: 'entity_extraction', entityCount: 0 };
    }
    case 'content_gap': {
      if (clientId) {
        const gaps = await seoIntelligence.findContentGaps(clientId, keyword);
        return { type: 'content_gap', gapTopics: gaps.gapTopics, opportunityScore: gaps.opportunityScore };
      }
      return { type: 'content_gap', gapTopics: [] };
    }
    default: {
      const analysis = await seoIntelligence.analyzeSERP(keyword);
      return { type: 'full_analysis', ...analysis, keyword };
    }
  }
}

// ─── Multi-CMS Publish Worker ────────────────
async function handleMultiCmsPublish(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, provider, scheduleAt } = job.data;
  logger.info('Worker: Publishing to CMS', { articleId, provider });

  // Find primary connection for this client if no specific provider given
  let targetProvider = provider;
  if (!targetProvider) {
    const connections = await multiCmsPublisher.getConnections(clientId);
    const primary = connections.find(c => c.is_primary) || connections[0];
    if (primary) {
      targetProvider = primary.provider;
    }
  }

  const article = await pool.query(
    'SELECT * FROM articles WHERE id = $1',
    [articleId]
  );
  if (article.rows.length === 0) throw new Error(`Article ${articleId} not found`);

  const articleData = article.rows[0];

  const result = await multiCmsPublisher.publish(
    articleData,
    targetProvider || undefined
  );

  // Record in publishing_history table directly
  await pool.query(
    `INSERT INTO publishing_history (article_id, client_id, shopify_article_id, published_url, status)
     VALUES ($1, $2, $3, $4, 'published')
     ON CONFLICT DO NOTHING`,
    [articleId, clientId, result.id, result.url]
  );

  await pool.query(`UPDATE articles SET status = 'published', updated_at = NOW() WHERE id = $1`, [articleId]);

  return { provider: targetProvider || 'shopify', url: result.url, externalId: result.id };
}

// ─── Pexels Image Worker ─────────────────────
async function handlePexelsImage(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, keyword, articleTitle } = job.data;
  logger.info('Worker: Fetching Pexels images', { articleId, keyword });

  if (!clientId || !articleTitle) {
    return { imagesFetched: 0, error: 'Missing required params: clientId, articleTitle' };
  }

  const result = await pexelsService.findImagesForArticle(clientId, articleTitle, keyword);

  // Store featured image
  if (result.featuredImage.pexelsId !== 0) {
    await pool.query(
      `INSERT INTO article_images (article_id, client_id, image_url, alt_text, metadata, source, position)
       VALUES ($1, $2, $3, $4, $5, 'pexels', 0)
       ON CONFLICT DO NOTHING`,
      [articleId, clientId, result.featuredImage.url, result.featuredImage.altText,
       JSON.stringify({
         photographer: result.featuredImage.photographer,
         photographerUrl: result.featuredImage.photographerUrl,
         pexelsId: result.featuredImage.pexelsId
       })]
    );

    // Store inline section images
    for (let i = 0; i < result.sectionImages.length; i++) {
      if (result.sectionImages[i].pexelsId !== 0) {
        await pool.query(
          `INSERT INTO article_images (article_id, client_id, image_url, alt_text, metadata, source, position)
           VALUES ($1, $2, $3, $4, $5, 'pexels', $6)
           ON CONFLICT DO NOTHING`,
          [articleId, clientId, result.sectionImages[i].url, result.sectionImages[i].altText,
           JSON.stringify({
             photographer: result.sectionImages[i].photographer,
             photographerUrl: result.sectionImages[i].photographerUrl,
             pexelsId: result.sectionImages[i].pexelsId
           }),
           i + 1]
        );
      }
    }

    return {
      imagesFetched: 1 + result.sectionImages.length,
      featuredImage: result.featuredImage.url
    };
  }

  return { imagesFetched: 0 };
}

// ─── Editorial Workflow Worker ───────────────
async function handleEditorialWorkflow(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, action, reviewerId, reviewType, comment } = job.data;
  logger.info('Worker: Processing editorial action', { articleId, action });

  if (!articleId) throw new Error('articleId is required');

  switch (action) {
    case 'submit_for_review': {
      // Create a review assignment (triggers the editorial workflow)
      const assignment = await editorialWorkflowService.createReviewAssignment({
        article_id: articleId,
        client_id: clientId,
        review_type: reviewType || 'editor_review',
        priority: 1,
        due_at: new Date(Date.now() + 172800000) // 48 hours
      });
      await editorialWorkflowService.advanceStatus(articleId, 'in_editor_review', reviewerId);
      return { action: 'submitted', assignmentId: assignment.id };
    }
    case 'approve': {
      // Submit the review with approved decision
      await editorialWorkflowService.submitReview({
        article_id: articleId,
        reviewer_id: reviewerId,
        review_type: reviewType || 'final_approval',
        decision: 'approved',
        comments: comment || 'Approved via worker',
        suggestions: []
      });

      // Queue CMS publish
      await addJob(QueueNames.MULTI_CMS_PUBLISH, 'scheduled-publish', {
        articleId,
        clientId
      });

      return { action: 'approved', scheduledPublish: true };
    }
    case 'reject': {
      await editorialWorkflowService.submitReview({
        article_id: articleId,
        reviewer_id: reviewerId,
        review_type: reviewType || 'editor_review',
        decision: 'revision_requested',
        comments: comment || 'Revision requested',
        suggestions: comment ? [comment] : []
      });
      return { action: 'revision_requested' };
    }
    default:
      throw new Error(`Unknown editorial action: ${action}`);
  }
}

// ─── Content Intelligence Worker ─────────────
async function handleContentIntelligence(job: Job): Promise<Record<string, unknown>> {
  const { articleId, clientId, content, title, analysisType } = job.data;
  logger.info('Worker: Running content intelligence', { articleId, analysisType });

  switch (analysisType) {
    case 'cannibalization': {
      if (articleId && clientId && title && content) {
        const overlaps = await contentIntelligence.detectCannibalization(clientId, articleId, title, content);
        return { type: 'cannibalization', overlapsFound: overlaps.length, overlaps };
      }
      return { type: 'cannibalization', overlapsFound: 0 };
    }
    case 'knowledge_graph': {
      if (articleId) {
        const graph = await contentIntelligence.buildContentGraph(articleId);
        return { type: 'knowledge_graph', entities: graph.entities.length, relationships: graph.relationships.length };
      }
      return { type: 'knowledge_graph', entities: 0, relationships: 0 };
    }
    case 'topic_saturation': {
      if (clientId && title) {
        const saturation = await contentIntelligence.analyzeTopicSaturation(clientId, title);
        return { type: 'topic_saturation', ...saturation };
      }
      return { type: 'topic_saturation', saturation_score: 0 };
    }
    default:
      return { type: 'unknown', error: `Unknown analysis type: ${analysisType}` };
  }
}

// ─── AI Evaluation Worker ────────────────────
async function handleAiEvaluation(job: Job): Promise<Record<string, unknown>> {
  const { articleId, content, keyword, benchmark } = job.data;
  logger.info('Worker: Running AI evaluation', { articleId, benchmark });

  if (benchmark) {
    const results = await aiEvaluationService.runBenchmark(benchmark);
    return { benchmarkCompleted: true, results };
  }

  if (content) {
    const evaluation = await aiEvaluationService.evaluateContent(content, keyword || 'general');
    if (articleId) {
      await pool.query(
        `UPDATE articles SET ai_evaluation_score = $1, updated_at = NOW() WHERE id = $2`,
        [evaluation.overall, articleId]
      );
    }
    return { evaluated: true, overall: evaluation.overall, dimensions: evaluation.dimensions, feedback: evaluation.feedback };
  }

  return { evaluated: false };
}

// ══════════════════════════════════════════════
// Register Workers
// ══════════════════════════════════════════════

function registerWorkers(): void {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);

  // Core workers
  createWorker(QueueNames.CONTENT_GENERATION, handleContentGeneration, { concurrency });
  createWorker(QueueNames.KEYWORD_RESEARCH, handleKeywordResearch, { concurrency });
  createWorker(QueueNames.SHOPIFY_PUBLISH, handleShopifyPublish, { concurrency: 1 });
  createWorker(QueueNames.IMAGE_GENERATION, handleImageGeneration, { concurrency: 1 });
  createWorker(QueueNames.SEO_ANALYSIS, handleSeoAnalysis, { concurrency });
  createWorker(QueueNames.INTERNAL_LINKING, handleInternalLinking, { concurrency });
  createWorker(QueueNames.WEBHOOK_DELIVERY, handleWebhookDelivery, { concurrency });
  createWorker(QueueNames.DEFAULT, handleDeadLetter, { concurrency: 1 });

  // ── Enterprise Workers ──
  createWorker(QueueNames.CLIENT_SCAN, handleClientScan, { concurrency: 2 });
  createWorker(QueueNames.BATCH_CLIENT_SCAN, handleBatchClientScan, { concurrency: 1 });
  createWorker(QueueNames.FACT_CHECK, handleFactCheck, { concurrency: 2 });
  createWorker(QueueNames.BRAND_VOICE, handleBrandVoice, { concurrency: 1 });
  createWorker(QueueNames.SEO_INTELLIGENCE, handleSeoIntelligence, { concurrency });
  createWorker(QueueNames.MULTI_CMS_PUBLISH, handleMultiCmsPublish, { concurrency: 1 });
  createWorker(QueueNames.PEXELS_IMAGE, handlePexelsImage, { concurrency: 2 });
  createWorker(QueueNames.EDITORIAL_WORKFLOW, handleEditorialWorkflow, { concurrency: 2 });
  createWorker(QueueNames.CONTENT_INTELLIGENCE, handleContentIntelligence, { concurrency: 2 });
  createWorker(QueueNames.AI_EVALUATION, handleAiEvaluation, { concurrency: 1 });

  logger.info('All workers registered (core + enterprise)');
}

// ─── Client Scan Worker ─────────────────────
async function handleClientScan(job: Job): Promise<Record<string, unknown>> {
  const { clientId, url, force } = job.data;
  logger.info('Worker: Scanning client website', { clientId, url });

  if (!force && clientId) {
    const existing = await clientScraper.getIntelligence(clientId);
    if (existing) {
      const daysOld = (Date.now() - new Date(existing.scraped_at).getTime()) / 86400000;
      if (daysOld < 7) {
        logger.info('Worker: Skipping client scan — recently scanned', { clientId, daysAgo: Math.round(daysOld) });
        return { skipped: true, reason: 'recently_scanned', daysAgo: Math.round(daysOld) };
      }
    }
  }

  const intelligence = await clientScraper.scanWebsite(url, clientId);
  return {
    clientId,
    url,
    pagesScanned: intelligence.pages_scanned,
    servicesFound: intelligence.services.length,
    industriesFound: intelligence.industries.length,
    primaryTone: intelligence.tone_analysis.primary_tone,
  };
}

// ─── Batch Client Scan Worker ───────────────
async function handleBatchClientScan(job: Job): Promise<Record<string, unknown>> {
  const { force } = job.data;
  logger.info('Worker: Starting batch scan of all clients');

  const clients = force
    ? await clientScraper.getAllActiveClients()
    : await clientScraper.getClientsNeedingScan();

  logger.info('Worker: Clients to scan in batch', { count: clients.length, force: !!force });

  const results = [];
  for (const client of clients) {
    try {
      const intelligence = await clientScraper.scanWebsite(client.domain, client.id);
      results.push({
        clientId: client.id,
        name: client.name,
        status: 'success',
        pagesScanned: intelligence.pages_scanned,
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      results.push({
        clientId: client.id,
        name: client.name,
        status: 'failed',
        error: (err as Error).message,
      });
    }
  }

  return {
    total: clients.length,
    scanned: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  };
}

// ─── Dead Letter Handler ────────────────────
async function handleDeadLetter(job: Job): Promise<void> {
  const { originalJobId, originalQueue, payload, error } = job.data;

  logger.error('Dead letter job received', {
    originalJobId,
    originalQueue,
    error
  });

  // Log to database for review
  try {
    await pool.query(
      `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
       VALUES (NULL, 'dead_letter', 'job', 'error', $1, $2)`,
      [
        `Job ${originalJobId} from ${originalQueue} failed permanently`,
        JSON.stringify({ originalJobId, originalQueue, payload, error })
      ]
    );
  } catch (err) {
    logger.error('Failed to log dead letter', { error: (err as Error).message });
  }
}

// ══════════════════════════════════════════════
// Start
// ══════════════════════════════════════════════

async function start(): Promise<void> {
  logger.info('Starting BullMQ workers...');

  initializeServices();
  registerWorkers();

  logger.info('BullMQ workers ready. Awaiting jobs...');
}

// ─── Graceful Shutdown ─────────────────────
async function shutdown(): Promise<void> {
  logger.info('Shutting down workers...');

  await closeAll();
  await closeLogBuffer();
  await pool.end();

  logger.info('Workers shut down');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(err => {
  logger.error('Worker startup failed', { error: err.message });
  process.exit(1);
});

export { registerWorkers, initializeServices };
