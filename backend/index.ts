// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Kivo OS - Express Server
// ──────────────────────────────────────────────

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import path from 'path';

import { logger, initLogBuffer, closeLogBuffer } from './utils/logger';
import { checkRedisHealth, closeRedis } from './utils/redisHealth';
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
import openaiService from './services/openai';
import ollamaService from './services/ollama';
import seoService from './services/seo';
import keywordService from './services/keywords';
import keywordResearchEngine from './services/keywordResearchEngine';
import serpapiService from './services/serpapi';
import webhookService from './services/webhooks';
import vectorMemoryService from './services/vectorMemory';
import vectorStore from './services/vectorStoreClient';
import internalLinksService from './services/internalLinks';
import localLLMClient from './services/localLLMClient';

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
import metricsService from './services/metricsService';

// ═══ Device Auth Route Factory ═══════════════
import { createDeviceRoutes } from './routes/devices';

// ═══ Shopify Install Route Factory ═══════════
import { createShopifyInstallRoutes } from './routes/shopifyInstall';
import { normalizeWebhookBody, verifyShopifyWebhookHmac } from './utils/shopifyWebhook';

// ═══ Enterprise Route Factories ═══════════════
import { createEditorialRoutes } from './routes/editorial';
import { createFactCheckRoutes } from './routes/factCheck';
import { createBrandVoiceRoutes } from './routes/brandVoice';
import { createBacklinkRoutes } from './routes/backlinks';
import { backlinkAutomation } from './services/backlinkAutomation';
import { createCmsRoutes } from './routes/cms';
import { createCostRoutes } from './routes/cost';
import { createObservabilityRoutes } from './routes/observability';
import { createActivityRoutes } from './routes/activity';
import activityTracker from './services/activityTracker';
import autoFixService from './services/autoFixService';
import { activityMiddleware } from './middleware/activity';
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

// ═══ Credential Vault ═══════════════════════════
import { createCredentialVaultRoutes } from './routes/credentialVault';

// ═══ Quality Evaluation Routes (Prompt Phase 2) ═══
import { createQualityRoutes } from './routes/quality';

// ═══ Client Audit Routes (AI SEO Phase 1) ════════
import { createAuditRoutes } from './routes/clientAudit';

// ═══ CSRF Protection ═════════════════════════════
import { csrfTokenHandler, csrfProtection } from './middleware/csrf';

// ═══ Kali Security Tools Routes ══════════════════
import { createSecurityScanRoutes } from './routes/securityScan';

// ═══ Kivo Core Engine Imports ════════════════
import { initializeEngines, analyticsEngine } from './engines';
import { eventBus } from './event-bus';
import { connectorManager } from './connector-manager';
import { registerBuiltinConnectors } from './connectors';
import { sitesService } from './services/sitesService';
import { heartbeatService } from './services/heartbeatService';

// ═══ AEO Services ═══════════════════════════
import knowledgeBaseService from './services/knowledgeBase';
import { schedulerService } from './services/scheduler';
import { autoPublishService } from './services/autoPublishService';
import crawlerTrackerService, { identifyCrawler } from './services/crawlerTracker';
import { createKnowledgeBaseRoutes } from './routes/knowledgeBase';
import { createCrawlerAnalyticsRoutes } from './routes/crawlerAnalytics';

// ═══ AI SEO Services ═══════════════════════
import citationTracker from './services/citationTracker';

// ═══ Google Search Console ══════════════════
import gscService from './services/googleSearchConsole';
import { createGscRoutes } from './routes/googleSearchConsole';
import { createAdsReportRoutes } from './routes/adsReports';

// ═══ Demo / Free Trial ══════════════════════
import demoProvisioner from './services/demoProvisioner';
import { createDemoRoutes } from './routes/demo';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL || 'https://16.192.29.174.nip.io';

// Required behind Cloudflare/Nginx/Caddy so rate limiting and CSRF use the
// real client IP instead of failing on X-Forwarded-For headers.
app.set('trust proxy', 1);

// ─── Security Middleware ──────────────────────
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    useDefaults: true,
    directives: {
      frameAncestors: ["'self'", 'https://*.myshopify.com', 'https://admin.shopify.com'],
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.shopify.com', 'https://accounts.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.shopify.com', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com', 'https://accounts.google.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'https://cdn.shopify.com'],
      connectSrc: ["'self'", 'https://*.myshopify.com', 'wss://*.myshopify.com', 'https://cdn.shopify.com'],
      fontSrc: ["'self'", 'https://cdn.shopify.com', 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
    }
  } : false,
  crossOriginEmbedderPolicy: false,
  frameguard: false
}));
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'https://16.192.29.174.nip.io'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin === o || origin.endsWith('.myshopify.com') || origin === 'https://admin.shopify.com')) {
      cb(null, true);
    } else {
      cb(null, allowedOrigins[0]);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  credentials: true,
  maxAge: 86400
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
// Shopify OAuth, webhooks, compliance, and embedded routes excluded
// so reviewers and Shopify can access them without VPN
app.use(requireVpnAccess([
  '/api/shopify',
  '/api/webhooks',
  '/api/embedded',
  '/api/connector',
  '/api/heartbeat',
  '/api/admin',
  '/assets',
]));
app.use(ipWhitelist());

// Auth-specific rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later' }
});

// ══════════════════════════════════════════════
// Database Connection (before routes that need it)
// ══════════════════════════════════════════════

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

// ═══ Shopify Compliance Webhooks (MUST be before body parsers for raw body HMAC) ═══
import shopifyService from './services/shopify';
shopifyService.init(pool);

import { createComplianceWebhookRoutes } from './routes/complianceWebhooks';
app.use('/api/webhooks/compliance', (req, res, next) => {
  if (req.path === '/subscribe') {
    return express.json({ limit: '10mb' })(req, res, next);
  }
  next();
});
app.use('/api/webhooks/compliance', createComplianceWebhookRoutes(pool));

// Preserve raw bodies for the client webhook event receiver so HMAC checks
// can validate the exact payload Shopify or external senders posted.
app.use('/api/clients/:clientId/webhooks/events/receive', express.raw({ type: 'application/json' }));

// ─── Body Parsing ─────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── CSRF Protection ────────────────────────
app.use('/api', csrfProtection);

// ─── Request Logging & Metrics ──────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsService.recordRequest(req.method, req.originalUrl, res.statusCode, duration);
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

// ─── AI Crawler Detection Middleware ────────
app.use((req: Request, res: Response, next: NextFunction) => {
  if (identifyCrawler) {
    const ua = req.headers['user-agent'] || '';
    const crawlerName = identifyCrawler(ua);
    if (crawlerName) {
      logger.info('AI crawler detected', {
        crawler: crawlerName,
        path: req.originalUrl,
        ip: req.ip,
      });
      const clientId = (req as any).client?.id || undefined;
      crawlerTrackerService.logVisit(crawlerName, ua, req.originalUrl, req.ip || '', clientId);
    }
  }
  next();
});

// ─── Kivo Activity Tracking Middleware ────
// Records who did what, when, and whether it succeeded for every API request.
app.use(activityMiddleware);

// ══════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════

// ─── Root Route (dev mode only - prod serves frontend) ──
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Kivo OS — Technical Visibility Infrastructure',
      version: process.env.npm_package_version || '2.0.0',
      status: 'running',
      api: '/api',
      health: '/health',
      docs: 'https://github.com/yusuf-mohamed0/kivo'
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
            (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed' AND queued_at >= NOW() - INTERVAL '24 hours') as failed_jobs_24h,
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

    // Redis check (shared client)
    const redisPromise = checkRedisHealth();

    const healthProbeTimeoutMs = Number.parseInt(process.env.HEALTH_PROBE_TIMEOUT_MS || '1000', 10) || 1000;
    const sidecarsEnabled = process.env.ENABLE_SIDECARS === 'true';

    // Live pings to optional services (skip if not configured)
    const turbovecPromise = process.env.TVEC_URL
      ? vectorStore.healthCheck().then(ok => ok ? 'healthy' : 'unreachable').catch(() => 'unreachable')
      : Promise.resolve('not_configured');
    const airllmPromise = process.env.AIRLLM_URL
      ? localLLMClient.healthCheck().then(s => s.healthy ? 'healthy' : 'unreachable').catch(() => 'unreachable')
      : Promise.resolve('not_configured');

    // Live pings to Docker sidecars (skip if not configured)
    const headroomPromise = sidecarsEnabled && process.env.HEADROOM_BASE_URL
      ? fetch(`${process.env.HEADROOM_BASE_URL}/health`, { signal: AbortSignal.timeout(healthProbeTimeoutMs) })
          .then(r => r.ok ? 'healthy' : 'unreachable').catch(() => 'unreachable')
      : Promise.resolve('not_configured');
    const openseoPromise = sidecarsEnabled && process.env.OPENSEO_URL
      ? fetch(`${process.env.OPENSEO_URL}/`, { signal: AbortSignal.timeout(healthProbeTimeoutMs) })
          .then(r => r.ok ? 'healthy' : 'unreachable').catch(() => 'unreachable')
      : Promise.resolve('not_configured');

    const [stats, redisStatus, turbovecStatus, airllmStatus, headroomStatus, openseoStatus] = await Promise.all([
      statsPromise, redisPromise, turbovecPromise, airllmPromise, headroomPromise, openseoPromise
    ]);

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
        },
        ollama: {
          status: ollamaService.isMockMode ? 'not_configured' : 'configured',
          mode: ollamaService.isLocal ? 'local' : (ollamaService.isMockMode ? 'mock' : 'cloud'),
          model: ollamaService.defaultModel,
          provider: ollamaService.provider
        },
        turbovec: {
          status: turbovecStatus,
          mode: 'python_service',
          url: process.env.TVEC_URL || 'http://127.0.0.1:8530'
        },
        airllm: {
          status: airllmStatus,
          mode: 'python_service',
          url: process.env.AIRLLM_URL || 'http://127.0.0.1:8531'
        },
        headroom: {
          status: headroomStatus,
          mode: 'docker_sidecar',
          url: process.env.HEADROOM_BASE_URL || ''
        },
        openseo: {
          status: openseoStatus,
          mode: 'docker_sidecar',
          url: process.env.OPENSEO_URL || ''
        },
        gsc: {
          status: gscService.isConfigured() ? 'configured' : 'not_configured',
          mode: 'oauth',
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

// ─── Prometheus Metrics ─────────────────────
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const metrics = await metricsService.generateMetrics();
    res.send(metrics);
  } catch (err) {
    logger.error('Metrics generation failed', { error: (err as Error).message });
    res.status(500).send('# Error generating metrics\n');
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

// Backlink automation routes
app.use('/api/clients/:clientId/backlinks', createBacklinkRoutes(pool));
app.use('/api/backlinks', createBacklinkRoutes(pool));

// Multi-CMS routes
app.use('/api/cms', createCmsRoutes(pool));

// Cost optimization routes
app.use('/api/cost', createCostRoutes(pool));

// Observability & monitoring routes
app.use('/api/observability', createObservabilityRoutes(pool));

// ─── Kivo Activity Tracking & Auto-Fix Routes ───
// Telemetry beacon (unauthenticated ingest) + admin activity/auto-fix API
app.use('/api', createActivityRoutes(pool));

// Security routes (audit, permissions, rate limiting)
app.use('/api/security', createSecurityRoutes(pool));

// ─── CSRF Token Endpoint ───────────────────
app.get('/api/csrf/token', authenticate, csrfTokenHandler);

// ─── Security Scan Routes (Kali tools) ────
app.use('/api/security-scan', createSecurityScanRoutes(pool));

// Content intelligence routes
app.use('/api/content-intel', createContentIntelRoutes(pool));

// GEO (Generative Engine Optimization) routes
import { createGeoRoutes } from './routes/geo';
import { createAeoRoutes } from './routes/aeo';
import { createAiSeoRoutes } from './routes/aiSeo';
app.use('/api/geo', createGeoRoutes());
app.use('/api/aeo', createAeoRoutes());
app.use('/api/ai-seo', createAiSeoRoutes());

// Knowledge Base / RAG routes
app.use('/api/knowledge-bases', createKnowledgeBaseRoutes());

// Crawler analytics routes
app.use('/api/crawler-analytics', createCrawlerAnalyticsRoutes());

// AI evaluation routes
app.use('/api/evaluation', createEvaluationRoutes(pool));

// Quality evaluation + GEPA reflection (Prompt Phase 2)
app.use('/api/quality', createQualityRoutes(pool));

// Client AI SEO audit (AI SEO Phase 1)
app.use('/api/audit', createAuditRoutes(pool));

// Pexels image routes
app.use('/api/pexels', createPexelsRoutes(pool));

// Enterprise pipeline orchestrator
app.use('/api/pipeline', createEnterprisePipelineRoutes(pool));

// ═══════ Device Auth Routes ═══════════════════
app.use('/api/devices', authenticate, createDeviceRoutes(pool));

// ═══════ Meta Routes (Prompt Hardening) ═══════
app.use('/api/meta', createMetaRoutes(pool));

// ═══ API Documentation (Swagger/OpenAPI) ══════
import { createSwaggerRoutes } from './routes/swagger';
app.use('/docs', createSwaggerRoutes());

// ═══════ Product Content Routes ═══════════════
import { createProductRoutes } from './routes/products';
app.use('/api/products', createProductRoutes(pool));

// ═══════ Client Website Scanner Routes ═══════
app.use('/api/scraper', createClientScraperRoutes(pool));

// ═══════ Global Memory Routes ═════════════════
import { createMemoryRoutes } from './routes/memory';
app.use('/api/memory', createMemoryRoutes(pool));

// ═══════ Connector Management Routes (WordPress, etc.) ═══════
import { createConnectorRoutes } from './routes/connectors';
app.use('/api/connector', createConnectorRoutes(pool));

// ═══════ Heartbeat Monitor Routes ════════════════════════
import { createHeartbeatRoutes } from './routes/heartbeat';
app.use('/api/heartbeat', createHeartbeatRoutes());

// ═══════ Billing Routes (Shopify AppStore requirement) ═══
import { createBillingRoutes } from './routes/billing';
app.use('/api/billing', createBillingRoutes(pool));

// ═══════ Credential Vault Route ════════════════
app.use('/api/vault', createCredentialVaultRoutes(pool));

// ═══════ Google Search Console Routes ════════════
app.use('/api/gsc', createGscRoutes(pool));

// ═══════ Paid Ads Reporting Routes ════════════════
app.use('/api/ads-reports', createAdsReportRoutes(pool));

// ═══════ Demo / Free Trial Routes ════════════════
app.use('/api/demo', createDemoRoutes(pool));

// ═══════ Worker Performance Scoring Routes ═══════
app.use('/api/worker-scoring', createWorkerScoringRoutes(pool));

// ─── n8n Pipeline Log Endpoint ────────────
app.post('/api/n8n/log', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event, message, level = 'info', metadata } = req.body;
    const user = (req as any).user;

    if (!event || !message) {
      res.status(400).json({ error: 'event and message are required' });
      return;
    }

    await pool.query(
      `INSERT INTO activity_logs (client_id, action, entity_type, level, message, metadata)
       VALUES ($1, $2, 'pipeline', $3, $4, $5)`,
      [user?.clientId || null, event, level, message, metadata ? JSON.stringify(metadata) : null]
    );

    res.json({ logged: true });
  } catch (err) {
    next(err);
  }
});

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
    const rawBody = normalizeWebhookBody(req.body, (req as any).rawBody);

    // Verify Shopify webhook HMAC before trusting the payload.
    const hmac = req.headers['x-shopify-hmac-sha256'] as string | string[] | undefined;
    if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
      logger.warn('Invalid Shopify webhook HMAC');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Parse the raw body to get the event object
    const event = JSON.parse(rawBody);
    logger.info('Webhook event received via /api/webhooks', { event: event?.event || 'unknown' });

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

app.post('/api/clients/:clientId/keywords/discover', authenticate, authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!serpapiService.isConfigured()) {
      res.status(503).json({ error: 'Keyword research requires SERPAPI_API_KEY for real search metrics.' });
      return;
    }
    const { industry, seedKeywords, count } = req.body;
    const result = await keywordResearchEngine.discoverWithClustering(
      pool,
      req.params.clientId,
      industry || 'maintenance',
      seedKeywords || ['home maintenance', 'property care'],
      count || 30
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post('/api/clients/:clientId/keywords/strategy', authenticate, authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { industry, seedKeywords } = req.body;
    const strategy = await keywordResearchEngine.suggestContentStrategy(
      pool,
      req.params.clientId,
      industry || 'maintenance',
      seedKeywords || ['home maintenance', 'property care']
    );
    res.json(strategy);
  } catch (err) {
    next(err);
  }
});

// ═══ Embedded App API (session token auth) ═══
import { createEmbeddedRoutes } from './routes/embedded';
app.use('/api/embedded', createEmbeddedRoutes(pool));

// ═══ Shopify Install Route (one-click OAuth) ═══
app.use('/api/shopify', createShopifyInstallRoutes(pool));

// ─── SEO Analysis Endpoint ──────────────────
app.post('/api/seo/analyze', authenticate, validate(seoAnalyzeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, keyword } = req.body;
    const analysis = await seoService.analyzeContent(content, keyword);
    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// ─── Serve robots.txt ─────────────────────
app.get('/robots.txt', (_req: Request, res: Response) => {
  const robotsPath = path.join(__dirname, 'public', 'robots.txt');
  res.sendFile(robotsPath, (err) => {
    if (err) {
      res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
`);
    }
  });
});

// ─── IndexNow Key File ────────────────────
// Required by IndexNow protocol: host/.well-known/{key}.txt
app.get('/.well-known/:keyFile', (req: Request, res: Response) => {
  const keyFile = req.params.keyFile;
  if (keyFile.endsWith('.txt')) {
    const key = process.env.INDEXNOW_KEY || '';
    if (key && keyFile === `${key}.txt`) {
      res.type('text/plain').send(key);
      return;
    }
  }
  res.status(404).send('Not found');
});

// ─── Privacy Policy ────────────────────────
app.get('/privacy', (_req: Request, res: Response) => {
  res.sendFile(path.join(pagesDir, 'privacy.html'));
});

// ─── FAQ ────────────────────────────────────
app.get('/faq', (_req: Request, res: Response) => {
  res.sendFile(path.join(pagesDir, 'faq.html'));
});
app.get('/changelog', (_req: Request, res: Response) => {
  res.sendFile(path.join(pagesDir, 'changelog.html'));
});
app.get('/tutorial', (_req: Request, res: Response) => {
  res.sendFile(path.join(pagesDir, 'tutorial.html'));
});
app.get('/documentation', (_req: Request, res: Response) => {
  res.sendFile(path.join(pagesDir, 'docs.html'));
});

// ─── Serve Static Assets ──────────────────
const publicDir = path.join(__dirname, 'public');
app.use('/css', express.static(path.join(publicDir, 'css')));
const assetsDir = path.join(publicDir, 'assets');
app.use('/assets', express.static(assetsDir));
app.use('/api/assets', express.static(assetsDir));
const pagesDir = path.join(publicDir, 'pages');

// ─── Shopify OAuth Redirect Pages ─────────
app.get('/shopify/success', (_req: Request, res: Response) => {
  const shop = String(_req.query.shop || '');
  const name = String(_req.query.name || shop.replace('.myshopify.com', ''));
  const host = String(_req.query.host || '');
  const appUrl = new URL(SHOPIFY_APP_URL);
  if (shop) appUrl.searchParams.set('shop', shop);
  if (host) appUrl.searchParams.set('host', host);
  appUrl.searchParams.set('connected', '1');
  appUrl.searchParams.set('name', name);

  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connected - Kivo Geo</title><meta http-equiv="refresh" content="1;url=${appUrl.toString()}"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#071013;color:#F4FBF8;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center}div{text-align:center;max-width:500px;padding:0 20px}h1{color:#22E6A8;font-size:24px;margin:0 0 8px}p{color:#6D7E86;font-size:14px;margin-bottom:24px}.btn{display:inline-block;padding:10px 24px;background:#22E6A8;color:#071013;border-radius:8px;text-decoration:none;font-weight:600;margin:0 6px}</style></head><body><div><div style="font-size:64px;margin-bottom:16px">✓</div><h1>Connected!</h1><p><strong>${name}</strong><br>${shop} — opening the app.</p><a class="btn" href="${appUrl.toString()}">Open App</a><a class="btn" href="https://${shop}/admin">Return to Admin</a><script>setTimeout(function(){window.location.replace(${JSON.stringify(appUrl.toString())});},500);</script></div></body></html>`);
});

app.get('/shopify/error', (_req: Request, res: Response) => {
  const errors: Record<string, string> = {
    invalid_shop: 'Invalid Shopify store URL. Use store.myshopify.com format.',
    missing_params: 'Missing OAuth parameters. Please try installing again.',
    invalid_hmac: 'Invalid Shopify signature. The OAuth callback did not verify.',
    invalid_state: 'Session expired. Please try installing again.',
    state_error: 'Verification failed. Please try again.',
    token_exchange_failed: 'Could not get access token. The app may not be properly configured.',
  };
  const msg = String(_req.query.msg || 'unknown');
  const errorText = errors[msg] || 'Something went wrong. Please try again.';
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Error - Kivo Geo</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#071013;color:#F4FBF8;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center}div{text-align:center;max-width:500px;padding:0 20px}h1{color:#ff6b6b;font-size:24px;margin:0 0 8px}p{color:#F4FBF8;font-size:14px;margin-bottom:24px}.btn{display:inline-block;padding:10px 24px;background:#22E6A8;color:#071013;border-radius:8px;text-decoration:none;font-weight:600}</style></head><body><div><div style="font-size:64px;margin-bottom:16px">✕</div><h1>Connection Failed</h1><p>${errorText}</p></div></body></html>`);
});

// ─── Handle App Store Install Redirect ──────
// When Shopify App Store redirects to root with ?shop=..., redirect to OAuth if no token
app.get('/', async (req: Request, res: Response, next: NextFunction) => {
  const shop = String(req.query.shop || '').trim().toLowerCase();
  if (shop && /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    try {
      const result = await pool.query(
        'SELECT shopify_token, is_active FROM clients WHERE shopify_shop = $1',
        [shop]
      );
      const hasValidToken = result.rows.length > 0 && result.rows[0]?.shopify_token && result.rows[0]?.is_active;
      if (!hasValidToken) {
        res.redirect(`/api/shopify/install?shop=${encodeURIComponent(shop)}`);
        return;
      }
    } catch { /* Fall through to static serving on DB error */ }
  }
  next();
});

// ─── Serve Frontend (production) ────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
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

    // Initialize Ollama (separate from OpenAI — can run alongside)
    try {
      ollamaService.initialize();
    } catch (e) {
      logger.warn(`Ollama not configured: ${(e as Error).message}`);
    }

    keywordService.initialize(pool);
    internalLinksService.initialize(pool);
    vectorMemoryService.initialize(pool);

    // Check connectivity to turbovec and AirLLM Python microservices
    vectorStore.healthCheck().then(h => {
      logger.info('turbovec vector store connectivity', { healthy: h });
    }).catch(() => {});
    localLLMClient.healthCheck().then(status => {
      logger.info('AirLLM local inference connectivity', {
        healthy: status.healthy,
        modelLoaded: status.modelLoaded,
        model: status.model,
      });
    }).catch(() => {});

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
    metricsService.initialize(pool);
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

    // ═══════ Connected Sites Registry ═══════════════
    sitesService.initialize(pool);

    // ═══════ Backlink Automation ════════════════════
    try {
      await backlinkAutomation.initialize(pool);
    } catch (e) {
      logger.warn('Backlink automation init failed', { error: (e as Error).message });
    }

    // ═══════ Activity Tracking & Auto-Fix ══════════════
    try {
      await activityTracker.initialize(pool);
      await autoFixService.initialize(pool);
      autoFixService.start();
      logger.info('Kivo activity tracking + auto-fix engine initialized');
    } catch (e) {
      logger.warn('Activity tracking init failed', { error: (e as Error).message });
    }

    // ═══════ Connectors ═════════════════════════════
    connectorManager.initialize(pool);
    registerBuiltinConnectors(pool);

    // Auto-connect connectors from active CMS connections
    try {
      const cmsResult = await pool.query(
        `SELECT provider, endpoint_url, config FROM cms_connections WHERE is_active = true`
      );
      for (const row of cmsResult.rows) {
        try {
          const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
          const endpointUrl = row.endpoint_url
            || (cfg.shop ? `https://${cfg.shop}` : undefined)
            || cfg.endpointUrl
            || cfg.endpoint_url
            || cfg.siteUrl;
          const apiKey = cfg.accessToken
            || cfg.apiKey
            || cfg.tdsGeoApiKey
            || cfg.kivo_api_key
            || cfg.wpAppPassword;
          const connector = connectorManager.get(row.provider);
          if (connector && endpointUrl && apiKey) {
            await connector.connect({ provider: row.provider, endpointUrl, apiKey });
            logger.info('Connector auto-connected from CMS config', { provider: row.provider, endpoint: endpointUrl });
          } else {
            logger.debug('Connector auto-connect skipped', { provider: row.provider, hasEndpoint: !!endpointUrl, hasApiKey: !!apiKey });
          }
        } catch (connErr) {
          logger.warn('Connector auto-connect failed', { provider: row.provider, error: (connErr as Error).message });
        }
      }
    } catch (dbErr) {
      logger.warn('Could not read CMS connections for auto-connect', { error: (dbErr as Error).message });
    }

    connectorManager.startPeriodicHealthChecks();

    // ═══════ Heartbeat Monitor ═══════════════════════
    heartbeatService.initialize(pool);
    heartbeatService.start();

    // ═══ AEO Services Initialization ═══════════
    try {
      knowledgeBaseService.initialize(pool);
    } catch (e) {
      logger.warn('KnowledgeBase service init failed', { error: (e as Error).message });
    }
    try {
      crawlerTrackerService.initialize(pool);
    } catch (e) {
      logger.warn('CrawlerTracker service init failed', { error: (e as Error).message });
    }
    try {
      schedulerService.initialize(pool);
      const scheduleInterval = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10);
      schedulerService.start(scheduleInterval);
    } catch (e) {
      logger.warn('Scheduler service init failed', { error: (e as Error).message });
    }

    // ═══ Auto-Publish Scheduler ═══════════════
    try {
      if (process.env.AUTO_PUBLISH_ENABLED === 'true') {
        autoPublishService.initialize(pool);
        const autoPublishInterval = parseInt(process.env.AUTO_PUBLISH_INTERVAL_MS || '30000', 10);
        autoPublishService.start(autoPublishInterval);
      } else {
        logger.info('Auto-publish scheduler disabled', { enabled: false });
      }
    } catch (e) {
      logger.warn('Auto-publish service init failed', { error: (e as Error).message });
    }

    // ═══ Demo Trial Expiry Checker ═══════════════
    try {
      const DEMO_EXPIRY_INTERVAL = parseInt(process.env.DEMO_EXPIRY_INTERVAL_MS || '3600000', 10);
      const demoExpiryTimer = setInterval(async () => {
        try {
          const expired = await demoProvisioner.checkExpiredTrials();
          if (expired > 0) {
            logger.info('Demo trial expiry check completed', { expired });
          }
        } catch (err) {
          logger.error('Demo trial expiry check failed', { error: (err as Error).message });
        }
      }, DEMO_EXPIRY_INTERVAL);

      // Store timer reference for cleanup
      (global as any).__demoExpiryTimer = demoExpiryTimer;
    } catch (e) {
      logger.warn('Demo expiry checker init failed', { error: (e as Error).message });
    }

    // ═══ Citation Tracker Initialization ═══════
    try {
      citationTracker.initialize(pool);
    } catch (e) {
      logger.warn('CitationTracker init failed', { error: (e as Error).message });
    }

    // ═══════ Google Search Console ════════════════
    try {
      gscService.initialize(pool);
    } catch (e) {
      logger.warn('GSC service init failed', { error: (e as Error).message });
    }

    // ═══════ Demo Provisioner Init ════════════════
    try {
      demoProvisioner.initialize(pool);
    } catch (e) {
      logger.warn('DemoProvisioner init failed', { error: (e as Error).message });
    }

    // ════════════════════════════════════════════
    // KIVO CORE ENGINE INITIALIZATION
    // ════════════════════════════════════════════
    await initializeEngines(pool);

    logger.info('All enterprise services initialized successfully');

    app.listen(PORT, () => {
      logger.info('Kivo OS server started', {
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
  await autoFixService.close().catch(() => {});
  await enterpriseSecurity.close().catch(() => {});
  await resilience.close().catch(() => {});
  await closeRedis().catch(() => {});
  await workerScoringEngine.close().catch(() => {});
  await odooConnector.close().catch(() => {});
  await ceoOrchestrator.close().catch(() => {});
  await CostOptimizationService.getInstance().close().catch(() => {});

  // Scheduler cleanup
  schedulerService.stop();
  autoPublishService.stop();

  // Demo expiry cleanup
  if ((global as any).__demoExpiryTimer) {
    clearInterval((global as any).__demoExpiryTimer);
  }

  // Kivo Core engine cleanup
  connectorManager.stopPeriodicHealthChecks();
  eventBus.clear(false);

  logger.info('Server shut down');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (process.env.VITEST_WORKER_ID === undefined) {
  start();
}

export default app;
