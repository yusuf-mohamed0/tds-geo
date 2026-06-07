// ──────────────────────────────────────────────
// AI SEO Automation System - Express Server
// ──────────────────────────────────────────────

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import path from 'path';

import { logger, initLogBuffer, closeLogBuffer } from './utils/logger';
import { authenticate, authorize, authorizeClientAccess, requireDeviceAuth } from './middleware/auth';
import { requireVpnAccess, ipWhitelist } from './middleware/network';
import { validate, seoAnalyzeSchema } from './validators/index';
import costTracker from './services/costTracker';

// ─── Route Factories ─────────────────────────
import { createAuthRoutes } from './routes/auth';
import { createClientRoutes } from './routes/clients';
import { createArticleRoutes } from './routes/articles';
import { createWebhookRoutes } from './routes/webhooks';
import { createAnalyticsRoutes } from './routes/analytics';
import { createAdminRoutes } from './routes/admin';

// ═══ Platform Expansion Routes ═══════════════
import { createApiKeyRoutes } from './routes/apiKeys';
import { createPluginRoutes } from './routes/plugins';
import { createPromptRoutes } from './routes/prompts';
import { createChatRoutes } from './routes/chat';
import { createSystemConfigRoutes } from './routes/systemConfig';

// ─── Services ─────────────────────────────────
import shopifyService from './services/shopify';
import openaiService from './services/openai';
import seoService from './services/seo';
import keywordService from './services/keywords';
import webhookService from './services/webhooks';
import vectorMemoryService from './services/vectorMemory';
import internalLinksService from './services/internalLinks';

// ═══ Platform Expansion Services ═════════════
import pluginService from './services/pluginService';
import chatEngine from './services/chatEngine';
import selfImprovementService from './services/selfImprovementService';
import deviceAuthService from './services/deviceAuth';

// ══════════════════════════════════════════════
// ENTERPRISE SERVICE IMPORTS
// ══════════════════════════════════════════════

import factCheckService from './services/factCheckService';
import seoIntelligence from './services/seoIntelligence';
import brandVoice from './services/brandVoice';
import multiCmsPublisher from './services/multiCmsPublisher';
import clientScraper from './services/clientScraper';
import pexelsService from './services/pexelsService';
import CostOptimizationService from './services/costOptimization';
import editorialWorkflow from './services/editorialWorkflow';
import observability from './services/observability';
import enterpriseSecurity from './services/enterpriseSecurity';
import contentIntelligence from './services/contentIntelligence';
import aiEvaluation from './services/aiEvaluation';
import resilience from './services/circuitBreaker';

// ═══ Shopify OAuth Route Factory ═════════════
import { createShopifyAuthRoutes } from './routes/shopifyAuth';

// ═══ Shopify Store Info Route Factory ════════
import { createShopifyStoreRoutes } from './routes/shopifyStore';

// ═══ Device Auth Route Factory ═══════════════
import { createDeviceRoutes } from './routes/devices';

// ═══ Enterprise Route Factories ═══════════════
import { createEditorialRoutes } from './routes/editorial';
import { createFactCheckRoutes } from './routes/factCheck';
import { createBrandVoiceRoutes } from './routes/brandVoice';
import { createCmsRoutes } from './routes/cms';
import { createCostRoutes } from './routes/cost';
import { createObservabilityRoutes } from './routes/observability';
import { createSecurityRoutes } from './routes/security';
import { createContentIntelRoutes } from './routes/contentIntelligence';
import { createEvaluationRoutes } from './routes/evaluation';
import { createPexelsRoutes } from './routes/pexels';
import { createEnterprisePipelineRoutes } from './routes/enterprisePipeline';

// ═══ Worker Performance Scoring Route Factory ═════
import { createWorkerScoringRoutes } from './routes/workerScoring';
import workerScoringEngine from './services/workerScoringEngine';

// ═══ CEO Orchestrator & Department Managers ══════
import ceoOrchestrator from './orchestrators/CeoOrchestrator';

// ═══ Client Scraper Route Factory ═════════════
import { createClientScraperRoutes } from './routes/clientScraper';

// ═══ Odoo ERP Connector ═══════════════════════
import odooConnector from './services/odooConnector';

// ═══ Prompt Hardening Routes ═════════════════
import { createMetaRoutes } from './routes/meta';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Security Middleware ──────────────────────
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24h preflight cache
}));

// ─── Global Rate Limiter ─────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});
app.use(globalLimiter);

// ─── Network Security ───────────────────────
// VPN-only access and IP whitelist for production
app.use(requireVpnAccess());
app.use(ipWhitelist());

// Auth-specific rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later' }
});

// ─── Body Parsing ─────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Request Logging ─────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : res.statusCode >= 500 ? 'error' : 'info';
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration
    });
  });
  next();
});

// ══════════════════════════════════════════════
// Database Connection
// ══════════════════════════════════════════════

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

// ══════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════

// ─── Root Route (dev mode only - prod serves frontend) ──
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Vireon — AI SEO Automation System',
      version: process.env.npm_package_version || '2.0.0',
      status: 'running',
      api: '/api',
      health: '/health',
      docs: 'https://github.com/yusuf-mohamed0/Vireon'
    });
  });
}

// ─── Health Check (unauthenticated) ───────────
app.get('/health', async (_req: Request, res: Response) => {
  const start = Date.now();
  try {
    // Always report database status first
    await pool.query('SELECT 1');
    const dbHealthy = true;
    const responseTime = Date.now() - start;

    // Gather stats with graceful degradation — any failure returns null
    const statsPromise = (async () => {
      try {
        const result = await pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM articles WHERE status = 'generated') as pending_articles,
            (SELECT COUNT(*)::int FROM articles WHERE status = 'published') as published_articles,
            (SELECT COUNT(*)::int FROM articles WHERE created_at >= NOW() - INTERVAL '24 hours') as articles_24h,
            (SELECT COUNT(*)::int FROM activity_logs WHERE level = 'error' AND created_at >= NOW() - INTERVAL '24 hours') as errors_24h,
            (SELECT COUNT(*)::int FROM activity_logs WHERE level = 'warn' AND created_at >= NOW() - INTERVAL '24 hours') as warnings_24h,
            (SELECT COUNT(*)::int FROM jobs WHERE status = 'queued' OR status = 'running') as queued_jobs,
            (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours') as failed_jobs_24h,
            (SELECT COUNT(*)::int FROM activity_logs WHERE created_at >= NOW() - INTERVAL '24 hours') as total_actions_24h,
            (SELECT COUNT(*)::int FROM clients WHERE is_active = true) as active_clients,
            (SELECT COALESCE(SUM(cost_usd)::decimal(10,2), 0) FROM cost_tracking WHERE created_at >= DATE_TRUNC('month', NOW())) as costs_mtd,
            (SELECT COUNT(*)::int FROM activity_logs WHERE action = 'pipeline_completed' AND created_at >= NOW() - INTERVAL '24 hours') as pipeline_runs_24h
        `);
        return result.rows[0];
      } catch (statsErr) {
        return null;
      }
    })();

    // Redis check
    const redisPromise = (async () => {
      try {
        if (process.env.REDIS_URL) {
          const Redis = require('ioredis');
          const redis = new Redis(process.env.REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
          const ping = await redis.ping();
          await redis.quit();
          return ping === 'PONG' ? 'healthy' : 'unhealthy';
        }
        return 'not_configured';
      } catch {
        return 'unhealthy';
      }
    })();

    const [stats, redisStatus] = await Promise.all([statsPromise, redisPromise]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '2.0.0',
      response_time_ms: Date.now() - start,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
      },
      checks: {
        database: { status: 'healthy', response_time_ms: responseTime },
        redis: { status: redisStatus },
        openai: {
          status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
          mode: openaiService.isMockMode ? 'mock' : 'live',
          model: openaiService.defaultModel,
          provider: openaiService.provider
        }
      },
      stats
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      error: (err as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// ─── Auth Routes ─────────────────────────────
app.use('/api/auth', authLimiter, createAuthRoutes(pool));

// ─── Client Routes ──────────────────────────
app.use('/api/clients', createClientRoutes(pool));

// ─── Article Routes ──────────────────────────
app.use('/api/articles', createArticleRoutes(pool));

// ─── Webhook Management Routes ──────────────
app.use('/api/clients', createWebhookRoutes(pool));

// ─── Analytics Routes ───────────────────────
app.use('/api/analytics', createAnalyticsRoutes(pool));

// ─── Admin Routes ──────────────────────────
app.use('/api/admin', createAdminRoutes(pool));

// ═══════ Platform Expansion Routes ═══════════

// ─── API Key Management ────────────────────
app.use('/api/clients', createApiKeyRoutes(pool));

// ─── Plugin System ─────────────────────────
app.use('/api/plugins', createPluginRoutes(pool));

// ─── Prompt Editor ─────────────────────────
app.use('/api/prompts', createPromptRoutes(pool));

// ─── Chat Control Panel ────────────────────
app.use('/api/chat', createChatRoutes(pool));

// ─── System Configuration ──────────────────
app.use('/api/config', createSystemConfigRoutes(pool));

// ─── Self-Improvement Status ───────────────
// ══════════════════════════════════════════════
// ENTERPRISE ROUTES
// ══════════════════════════════════════════════

// Editorial workflow routes
app.use('/api/editorial', createEditorialRoutes(pool));

// Fact-checking routes
app.use('/api/factcheck', createFactCheckRoutes(pool));

// Brand voice routes
app.use('/api/brand-voice', createBrandVoiceRoutes(pool));

// Multi-CMS routes
app.use('/api/cms', createCmsRoutes(pool));

// Cost optimization routes
app.use('/api/cost', createCostRoutes(pool));

// Observability & monitoring routes
app.use('/api/observability', createObservabilityRoutes(pool));

// Security routes (audit, permissions, rate limiting)
app.use('/api/security', createSecurityRoutes(pool));

// Content intelligence routes
app.use('/api/content-intel', createContentIntelRoutes(pool));

// AI evaluation routes
app.use('/api/evaluation', createEvaluationRoutes(pool));

// Pexels image routes
app.use('/api/pexels', createPexelsRoutes(pool));

// Enterprise pipeline orchestrator
app.use('/api/pipeline', createEnterprisePipelineRoutes(pool));

// ═══════ Device Auth Routes ═══════════════════
app.use('/api/devices', authenticate, createDeviceRoutes(pool));

// ═══════ Meta Routes (Prompt Hardening) ═══════
app.use('/api/meta', createMetaRoutes(pool));

// ═══════ Client Website Scanner Routes ═══════
app.use('/api/scraper', createClientScraperRoutes(pool));

// ═══════ Worker Performance Scoring Routes ═══════
app.use('/api/worker-scoring', createWorkerScoringRoutes(pool));

// ─── Self-Improvement Status ───────────────
app.get('/api/improvements', authenticate, authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const suggestions = await selfImprovementService.getSuggestions();
    const stats = await selfImprovementService.getPerformanceStats();
    res.json({ suggestions, stats });
  } catch (err) { next(err); }
});

app.post('/api/improvements/analyze', authenticate, authorize('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const suggestions = await selfImprovementService.runFullAnalysis();
    res.json({ suggestions, count: suggestions.length });
  } catch (err) { next(err); }
});

// ─── Webhook Event Receiver (Shopify/External) ──
// Use raw body parser ONLY on the receive endpoint for HMAC verification,
// then parse JSON. Scope is limited to prevent breaking global JSON parsing.
app.use('/api/webhooks/events/receive', express.raw({ type: 'application/json' }));

app.post('/api/webhooks/events/receive', async (req: Request, res: Response) => {
  try {
    // Get the raw body (set by express.raw()) or fall back to parsed JSON
    const rawBody = (req as any).rawBody !== undefined
      ? (req as any).rawBody.toString('utf8')
      : JSON.stringify(req.body);

    // Parse the raw body to get the event object
    const event = JSON.parse(rawBody);
    logger.info('Webhook event received via /api/webhooks', { event: event?.event || 'unknown' });

    // Verify Shopify webhook HMAC if present
    const hmac = req.headers['x-shopify-hmac-sha256'];
    if (hmac && process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN) {
      const crypto = require('crypto');
      const generatedHmac = crypto
        .createHmac('sha256', process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN)
        .update(rawBody)
        .digest('base64');

      if (hmac !== generatedHmac) {
        logger.warn('Invalid Shopify webhook HMAC');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    // Store the webhook event in activity logs
    await pool.query(
      `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
       VALUES (NULL, $1, 'webhook', 'info', $2, $3) RETURNING id`,
      [event?.event || 'unknown', `Webhook received: ${event?.event || 'unknown'}`, JSON.stringify(event || {})]
    );

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('Webhook event processing failed', { error: (err as Error).message });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ══════════════════════════════════════════════
// Shopify OAuth Routes (registered OUTSIDE /api/ for Shopify compliance)
// ══════════════════════════════════════════════

app.use('/auth', createShopifyAuthRoutes(pool));

// ═══ Shopify Store Info Route (inside /api/ for auth) ════
app.use('/api/shopify', createShopifyStoreRoutes(pool));  // ─── Keyword Discovery Endpoint ─────────────
  app.post('/api/clients/:clientId/keywords/discover', authenticate, authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { industry, seedKeywords, count } = req.body;
    const keywords = await keywordService.discoverKeywords(
      req.params.clientId,
      industry || 'maintenance',
      seedKeywords || ['home maintenance', 'property care'],
      count || 20
    );
    res.json(keywords);
  } catch (err) {
    next(err);
  }
});

// ─── SEO Analysis Endpoint ──────────────────
app.post('/api/seo/analyze', authenticate, validate(seoAnalyzeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, keyword } = req.body;
    const analysis = await seoService.analyzeContent(content, keyword);
    res.json(analysis);
  } catch (err) {
    next(err);
  }
});  // ─── Shopify Connection Test ────────────────
  app.post('/api/clients/:clientId/test-shopify', authenticate, authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.clientId]);
    if (clientResult.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const client = clientResult.rows[0];
    const blogs = await shopifyService.fetchBlogs({
      shop: client.shopify_shop,
      accessToken: client.shopify_token,
      apiVersion: client.shopify_api_version
    });

    res.json({
      success: true,
      shop: client.shopify_shop,
      blogCount: blogs.length,
      blogs: blogs.map((b: any) => ({ id: b.id, title: b.title, handle: b.handle }))
    });
  } catch (err) {
    res.status(502).json({ success: false, error: (err as Error).message });
  }
});

// ─── Serve Frontend (production) ────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.resolve(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ══════════════════════════════════════════════
// Error Handler
// ══════════════════════════════════════════════

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    path: req.originalUrl,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

// ══════════════════════════════════════════════
// Start Server
// ══════════════════════════════════════════════

async function start(): Promise<void> {
  try {
    // Initialize LogBuffer for async batch DB logging
    initLogBuffer(pool);

    // Initialize services — pass shared pool to avoid redundant connections
    try {
      openaiService.initialize();
    } catch (e) {
      logger.warn(`OpenAI not configured: ${(e as Error).message}`);
    }

    keywordService.initialize(pool);
    internalLinksService.initialize(pool);
    vectorMemoryService.initialize(pool);
    webhookService.initialize(pool);
    costTracker.initialize(pool);

    // ═══ Platform Expansion Services ═══════════
    pluginService.initialize(pool);
    chatEngine.initialize(pool);
    selfImprovementService.initialize(pool);
    deviceAuthService.initialize(pool);

    // ════════════════════════════════════════════
    // ENTERPRISE SERVICE INITIALIZATION
    // ════════════════════════════════════════════
    factCheckService.initialize(pool);
    seoIntelligence.initialize(pool);
    brandVoice.initialize(pool);
    multiCmsPublisher.initialize(pool);
    pexelsService.initialize(pool);
    CostOptimizationService.getInstance().initialize(pool);
    editorialWorkflow.initialize(pool);
    observability.initialize(pool);
    enterpriseSecurity.initialize(pool);
    contentIntelligence.initialize(pool);
    aiEvaluation.initialize(pool);
    resilience.initialize(pool);
    workerScoringEngine.initialize(pool);
    ceoOrchestrator.initialize(pool).catch(err => {
      logger.error('CEO Orchestrator initialization failed', { error: (err as Error).message });
    });

    // ═══ Odoo ERP Integration ═══════════════════
    odooConnector.initialize(pool);

    logger.info('All enterprise services initialized successfully');

    app.listen(PORT, () => {
      logger.info('AI SEO Automation server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        apiBase: `http://localhost:${PORT}/api`,
        healthEndpoint: `http://localhost:${PORT}/health`
      });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  }
}

// ─── Graceful Shutdown ─────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);

  await closeLogBuffer();
  await pool.end();
  await keywordService.close().catch(() => {});
  await internalLinksService.close().catch(() => {});
  await vectorMemoryService.close().catch(() => {});
  await pluginService.close().catch(() => {});
  await selfImprovementService.close().catch(() => {});

  // Enterprise service cleanup
  await observability.close().catch(() => {});
  await enterpriseSecurity.close().catch(() => {});
  await resilience.close().catch(() => {});
  await workerScoringEngine.close().catch(() => {});
  await odooConnector.close().catch(() => {});
  await ceoOrchestrator.close().catch(() => {});
  await CostOptimizationService.getInstance().close().catch(() => {});

  logger.info('Server shut down');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

export default app;
