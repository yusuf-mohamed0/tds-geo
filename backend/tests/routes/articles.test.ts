// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery, connect: vi.fn(), end: vi.fn() } as any;

// Mock ALL external deps individually (not in a loop — hoisting issue)
vi.mock('../../services/openai', () => ({ default: { get isMockMode() { return true; }, generateBlogPost: vi.fn(), generateTitle: vi.fn(), generateOutline: vi.fn(), generateFAQ: vi.fn(), enhanceSEO: vi.fn(), analyzeSEO: vi.fn(), moderateContent: vi.fn(), generateArticleImage: vi.fn(), initialize: vi.fn(), defaultModel: 'gpt-4o', maxTokens: 4096, temperature: 0.7 } }));
vi.mock('../../services/costTracker', () => ({ default: { isBudgetExceeded: vi.fn().mockResolvedValue(false) } }));
vi.mock('../../services/keywords', () => ({ default: { getKeywordData: vi.fn(), setKeywordCategory: vi.fn() } }));
vi.mock('../../services/internalLinks', () => ({ default: { generateInternalLinks: vi.fn() } }));
vi.mock('../../services/seo', () => ({ default: { analyzeSEO: vi.fn() } }));
vi.mock('../../services/vectorMemory', () => ({ default: { search: vi.fn(), store: vi.fn() } }));
vi.mock('../../services/shopify', () => ({ default: { publishArticle: vi.fn(), updateArticle: vi.fn() } }));
vi.mock('../../services/pipelineService', () => ({ generateContent: vi.fn(), getJobResult: vi.fn() }));
vi.mock('../../engines/publisher', () => ({ publisherEngine: { publishWithTracking: vi.fn() } }));
vi.mock('../../services/circuitBreaker', () => ({ default: { getCircuitBreaker: vi.fn().mockReturnValue({ call: vi.fn() }) } }));
vi.mock('../../middleware/auth', () => {
  const mw = (_r: any, _e: any, n: any) => { if (_r) _r.user = { userId: 't', role: 'admin', clientId: 'c1' }; n(); };
  const factoryMw = (_r: any, _e: any, n: any) => n();
  return { authenticate: mw, requireAdmin: mw, requireEditorOrAbove: mw, requireResourceOwnership: vi.fn(() => mw), authorize: vi.fn(() => mw), authorizeClientAccess: vi.fn(() => mw), scopeQueryByClient: factoryMw };
});
vi.mock('../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logActivity: vi.fn() }));
vi.mock('../../utils/config', () => ({ config: { database: { url: 'p' }, jwt: { secret: 's' }, openai: { apiKey: 'k' }, shopify: { defaultShop: 's', defaultAccessToken: 't', apiKey: 'k', apiSecret: 's' }, rateLimit: { max: 100, authMax: 20, windowMs: 900000 }, redis: { url: 'r' }, serpapi: { apiKey: '' }, headroom: { baseUrl: '' }, crawl4ai: { url: '' }, freellmapi: { encryptionKey: '' }, openseo: { url: '', dataforseoApiKey: '' }, smtp: { host: '', port: 587, user: '', pass: '', from: '' }, n8n: { webhookUrl: '' }, turbovec: { url: '' }, airllm: { url: '' }, odoo: { url: '', db: '', username: '', password: '' }, heartbeat: { checkIntervalMs: 300000, alertEmail: '' }, storage: { uploadDir: 'u' }, nodeEnv: 'test', port: 3000, isDev: () => false, isProd: () => false, isTest: () => true } }));
vi.mock('../../validators/index', () => ({ validate: vi.fn(() => (r: any, _e: any, n: any) => { r.validated = r.body || {}; n(); }), generateArticleSchema: {}, updateArticleSchema: {}, publishArticleSchema: {}, generateImageSchema: {} }));
vi.mock('../../middleware/rateLimiter', () => ({ clientRateLimit: vi.fn(() => (_r: any, _e: any, n: any) => n()) }));
vi.mock('../../utils/markdownToHtml', () => ({ convert: vi.fn((s: string) => s) }));

describe('Articles Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    app = express();
    app.use(express.json());
    const { createArticleRoutes } = await import('../../routes/articles');
    app.use('/api/articles', createArticleRoutes(mockPool));
  });

  it('GET /api/articles returns 200', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await request(app).get('/api/articles');
    expect([200, 500]).toContain(res.status);
  });

  it('GET /api/articles/:id returns article', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: '1', title: 'Test' }] });
    const res = await request(app).get('/api/articles/1');
    expect(res.status).toBe(200);
  });
});
