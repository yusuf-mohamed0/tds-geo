import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery, connect: vi.fn(), end: vi.fn() } as any;

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
    images: { generate: vi.fn() },
  })),
}));

vi.mock('../../services/openai', () => ({
  default: {
    get isMockMode() { return true; },
    generateBlogPost: vi.fn().mockResolvedValue({
      title: 'Test Article',
      content: 'Test content here...',
      metaTitle: 'Test Article',
      metaDescription: 'Test description',
      tags: ['test'],
      faqSection: '',
      metadata: { wordCount: 100, model: 'gpt-4o', temperature: 0.7, tokensIn: 50, tokensOut: 100 },
    }),
    generateTitle: vi.fn().mockResolvedValue('Test Title'),
    generateOutline: vi.fn().mockResolvedValue(['Section 1', 'Section 2']),
    generateFAQ: vi.fn().mockResolvedValue('## FAQ\n\n### Q?\nA...'),
    enhanceSEO: vi.fn().mockResolvedValue('Enhanced content'),
    analyzeSEO: vi.fn().mockResolvedValue({ score: 85 }),
    moderateContent: vi.fn().mockResolvedValue({ flagged: false }),
    generateArticleImage: vi.fn().mockResolvedValue({
      imageUrl: 'https://example.com/img.png',
      altText: 'alt text',
      prompt: 'prompt',
    }),
    generateKeywordVariations: vi.fn().mockResolvedValue(['kw1', 'kw2']),
    initialize: vi.fn(),
    defaultModel: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
  },
}));

vi.mock('../../services/circuitBreaker', () => ({
  default: {
    getCircuitBreaker: vi.fn().mockReturnValue({
      call: vi.fn().mockImplementation(async (_name: string, fn: () => any) => fn()),
    }),
  },
}));

vi.mock('../../utils/config', () => ({
  config: {
    database: { url: 'postgresql://test:test@localhost:5432/test' },
    redis: { url: 'redis://localhost:6379' },
    jwt: { secret: 'test-secret' },
    openai: { apiKey: 'sk-test', baseUrl: '', fallbackKey: '' },
    shopify: { defaultShop: 'test.myshopify.com', defaultAccessToken: 'test-token', apiKey: 'test-key', apiSecret: 'test-secret' },
    serpapi: { apiKey: '' },
    headroom: { baseUrl: '' },
    crawl4ai: { url: '' },
    freellmapi: { encryptionKey: '' },
    openseo: { url: '', dataforseoApiKey: '' },
    smtp: { host: '', port: 587, user: '', pass: '', from: '' },
    n8n: { webhookUrl: '' },
    turbovec: { url: '' },
    airllm: { url: '' },
    odoo: { url: '', db: '', username: '', password: '' },
    heartbeat: { checkIntervalMs: 300000, alertEmail: '' },
    storage: { uploadDir: 'uploads' },
    nodeEnv: 'test',
    port: 3000,
    isDev: () => false,
    isProd: () => false,
    isTest: () => true,
  },
}));

const mockAuthenticate = vi.fn((req: any, _res: any, next: any) => {
  req.user = { userId: 'test-user', role: 'admin', clientId: 'client-1' };
  next();
});

vi.mock('../../middleware/auth', () => ({
  authenticate: mockAuthenticate,
  requireAdmin: vi.fn((_req: any, _res: any, next: any) => next()),
  requireEditorOrAbove: vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Articles Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    const articlesRouter = (await import('../../routes/articles')).default;
    app.use('/api/articles', articlesRouter);
  });

  // ─── GET /api/articles ────────────────────

  describe('GET /api/articles', () => {
    it('should list articles with pagination', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: '1', title: 'Article 1', status: 'draft', keyword: 'kw1', word_count: 500, client_id: 'c1', created_at: new Date(), updated_at: new Date() },
        ],
      });

      const res = await request(app).get('/api/articles');
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should filter articles by client_id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/articles?client_id=client-1');
      expect(res.status).toBe(200);
    });

    it('should filter articles by status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/articles?status=published');
      expect(res.status).toBe(200);
    });

    it('should return empty array when no articles exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/articles');
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/articles/:id ────────────────

  describe('GET /api/articles/:id', () => {
    it('should return a single article', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '1', title: 'Test', content_md: 'Content', status: 'draft',
          keyword: 'kw1', word_count: 100, client_id: 'c1',
          meta_title: 'MT', meta_description: 'MD', tags: ['t1'],
          created_at: new Date(), updated_at: new Date(),
        }],
      });

      const res = await request(app).get('/api/articles/test-1');
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should return 404 for non-existent article', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/articles/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/articles/generate ──────────

  describe('POST /api/articles/generate', () => {
    it('should generate an article', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'new-id', title: 'Test', status: 'draft',
            keyword: 'plumbing repair', content_md: '',
            word_count: 0, meta_title: '', meta_description: '', tags: [],
            created_at: new Date(), updated_at: new Date(),
          }],
        });

      const res = await request(app)
        .post('/api/articles/generate')
        .send({ keyword: 'plumbing repair', client_id: 'client-1' });
      expect(res.status).toBe(201);
    });

    it('should return 400 without keyword', async () => {
      const res = await request(app)
        .post('/api/articles/generate')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should accept custom tone and word count', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'new-id', title: 'Test', status: 'draft',
            keyword: 'plumbing repair', content_md: '',
            word_count: 0, meta_title: '', meta_description: '', tags: [],
            created_at: new Date(), updated_at: new Date(),
          }],
        });

      const res = await request(app)
        .post('/api/articles/generate')
        .send({ keyword: 'plumbing repair', min_words: 2000, max_words: 3000, tone: 'professional', client_id: 'client-1' });
      expect(res.status).toBe(201);
    });

    it('should handle generation failure gracefully', async () => {
      const openai = await import('../../services/openai');
      (openai.default.generateBlogPost as any).mockRejectedValueOnce(new Error('Generation failed'));

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/articles/generate')
        .send({ keyword: 'plumbing repair', client_id: 'client-1' });
      expect(res.status).toBe(500);
    });
  });

  // ─── POST /api/articles/publish ───────────

  describe('POST /api/articles/publish', () => {
    it('should publish an article requiring publishWithTracking', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'a1', title: 'Test', content_md: 'Content', status: 'approved',
          keyword: 'kw1', meta_title: 'MT', meta_description: 'MD',
          tags: ['t1'], client_id: 'c1',
        }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Client', platform_type: 'shopify', platform_config: { shop: 'test.myshopify.com', access_token: 'token' } }] });

      const res = await request(app)
        .post('/api/articles/publish')
        .send({ article_id: 'a1' });
      expect(res.status).toBe(200);
    });

    it('should return 400 without article_id', async () => {
      const res = await request(app)
        .post('/api/articles/publish')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent article', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/articles/publish')
        .send({ article_id: 'nonexistent' });
      expect(res.status).toBe(404);
    });
  });

  // ─── PUT /api/articles/:id ────────────────

  describe('PUT /api/articles/:id', () => {
    it('should update an article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .put('/api/articles/test-1')
        .send({ title: 'Updated Title', content: 'Updated content' });
      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app)
        .put('/api/articles/nonexistent')
        .send({ title: 'Updated' });
      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/articles/:id ─────────────

  describe('DELETE /api/articles/:id', () => {
    it('should archive (soft delete) an article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/articles/test-1');
      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app).delete('/api/articles/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/articles/:id/approve ───────

  describe('POST /api/articles/:id/approve', () => {
    it('should approve an article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/articles/test-1/approve');
      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app).post('/api/articles/nonexistent/approve');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/articles/:id/reject ────────

  describe('POST /api/articles/:id/reject', () => {
    it('should reject an article with reason', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/articles/test-1/reject')
        .send({ reason: 'Needs more sources' });
      expect(res.status).toBe(200);
    });

    it('should reject an article without reason', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).post('/api/articles/test-1/reject');
      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent article', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app).post('/api/articles/nonexistent/reject');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/articles/:id/improve ───────

  describe('POST /api/articles/:id/improve', () => {
    it('should improve an article', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'a1', content_md: 'Original content', keyword: 'test', title: 'Original Title' }],
      });

      const res = await request(app)
        .post('/api/articles/test-1/improve')
        .send({ prompt: 'Make it more engaging' });
      expect(res.status).toBe(200);
    });

    it('should return 404 for non-existent article', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/articles/nonexistent/improve')
        .send({ prompt: 'Improve it' });
      expect(res.status).toBe(404);
    });
  });
});
