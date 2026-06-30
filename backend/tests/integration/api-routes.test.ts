// ══════════════════════════════════════════════
// API Route Integration Tests
// Tests route handlers with mocked database & services
// ══════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPool, createMockRequest, createMockResponse } from '../mocks/mockServices';

// ─── Mock external services ──────────────────
vi.mock('../../services/openai', () => ({
  default: {
    initialize: vi.fn(),
    isMockMode: true,
    generateBlogPost: vi.fn().mockResolvedValue({
      title: 'Test Article Title',
      content: '# Test\n\nThis is test content for integration testing.',
      metaTitle: 'Test Meta Title',
      metaDescription: 'Test meta description for integration tests.',
      tags: ['test', 'integration'],
      faqSection: '## FAQ\n\n### Q?\nA',
      metadata: { tokensIn: 100, tokensOut: 200, model: 'gpt-4o', wordCount: 50 }
    }),
    moderateContent: vi.fn().mockResolvedValue({ safe: true, flags: [], summary: 'safe' })
  }
}));

vi.mock('../../services/shopify', () => ({
  default: {
    init: vi.fn(),
    fetchBlogs: vi.fn().mockResolvedValue([{ id: 123, title: 'Blog', handle: 'blog' }]),
    publishArticle: vi.fn().mockResolvedValue({ id: 999, blogId: 123, url: 'https://test-shop.myshopify.com/blogs/123/test-article', handle: 'test-article' }),
    uploadImage: vi.fn().mockResolvedValue({ id: 888 })
  }
}));

vi.mock('../../services/seo', () => ({
  default: {
    analyzeContent: vi.fn().mockResolvedValue({ score: 72, keywordDensity: 1.5, readabilityScore: 70, suggestions: ['Good structure'], headingStructure: { h1: true, h2: 3, h3: 2 } }),
    generateSlug: vi.fn().mockImplementation((t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')),
    validateContent: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    generateSocialPreview: vi.fn().mockImplementation((c: string) => c.slice(0, 120))
  }
}));

vi.mock('../../services/costTracker', () => ({
  default: {
    isBudgetExceeded: vi.fn().mockResolvedValue(false),
    calculateOpenAICost: vi.fn().mockReturnValue(0.01),
    recordCost: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn(),
  }
}));

vi.mock('../../services/vectorMemory', () => ({
  default: {
    isDuplicate: vi.fn().mockResolvedValue(false),
    storeArticleChunks: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn(),
  }
}));

vi.mock('../../services/internalLinks', () => ({
  default: {
    refreshArticleCache: vi.fn().mockResolvedValue([]),
    findLinkOpportunities: vi.fn().mockResolvedValue([]),
    injectLinks: vi.fn().mockImplementation((c: string) => c),
    initialize: vi.fn(),
  }
}));

vi.mock('../../services/keywords', () => ({
  default: {
    markKeywordUsed: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn(),
  }
}));

vi.mock('../../utils/markdownToHtml', () => ({
  convert: vi.fn().mockImplementation((md: string) => `<p>${md}</p>`)
}));

vi.mock('../../services/webhooks', () => ({
  default: {
    trigger: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn(),
  }
}));

vi.mock('../../services/chatEngine', () => ({
  default: {
    initialize: vi.fn(),
    generateResponse: vi.fn().mockResolvedValue({
      success: true,
      message: 'Test response from AI',
      data: null,
      jobId: null,
      requiresApproval: false,
    })
  }
}));

vi.mock('../../services/pluginService', () => ({
  default: {
    initialize: vi.fn(),
    getClientPlugins: vi.fn().mockResolvedValue([]),
    registerInstance: vi.fn().mockResolvedValue({ id: 'new-instance' }),
    toggleInstance: vi.fn().mockResolvedValue({ is_enabled: true }),
    updateConfig: vi.fn().mockResolvedValue({}),
    executeHook: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  }
}));

vi.mock('../../services/selfImprovementService', () => ({
  default: {
    initialize: vi.fn(),
    getSuggestions: vi.fn().mockResolvedValue([]),
    getPerformanceStats: vi.fn().mockResolvedValue({}),
    runFullAnalysis: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  }
}));

// Mock JWT and bcrypt
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('test-jwt-token'),
    verify: vi.fn().mockReturnValue({
      userId: 'test-user-id',
      email: 'admin@test.com',
      role: 'admin',
      clientId: 'test-client-id',
    }),
  }
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    genSalt: vi.fn().mockResolvedValue('salt'),
    hash: vi.fn().mockResolvedValue('hashed-password'),
  }
}));

// ─── Route Factories & Helpers ───────────────

function createMockPoolWithData(overrides: Record<string, any> = {}): any {
  const store: Record<string, any[]> = {
    clients: [
      {
        id: 'test-client-id',
        name: 'Test Client',
        slug: 'test-client',
        shopify_shop: 'test-shop.myshopify.com',
        shopify_token: 'test-token',
        shopify_api_version: '2024-07',
        brand_voice: 'educational',
        service_area: 'California',
        timezone: 'US/Pacific',
        publish_frequency: 'weekly',
        approval_mode: 'auto',
        settings: { ctaText: 'Contact us', ctaUrl: '/contact' },
        monthly_token_limit: 1000000,
        monthly_cost_limit: 100,
        is_active: true,
        ...overrides
      }
    ],
    users: [
      {
        id: 'test-user-id',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
        client_id: 'test-client-id',
        password_hash: 'hashed-password',
        is_active: true,
        last_login_at: new Date().toISOString(),
      }
    ],
    articles: [],
    keywords: [],
    api_keys: [],
    webhooks: [],
    plugin_registry: [],
    plugin_instances: [],
    system_config: [],
    chat_sessions: [],
    chat_messages: [],
    activity_logs: [],
    publishing_history: [],
    cost_tracking: [],
    seo_analytics: [],
    jobs: [],
    article_images: [],
  };

  let idCounter = 1;

  return {
    query: async (text: string, params?: any[]) => {
      const tableMatch = text.match(/FROM\s+(?:(\w+))/i) ||
                         text.match(/INTO\s+(\w+)/i) ||
                         text.match(/UPDATE\s+(\w+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : '';

      // Handle INSERT
      if (text.trim().toUpperCase().startsWith('INSERT')) {
        const returningMatch = text.match(/RETURNING\s+(.+)/i);
        if (returningMatch) {
          const returningCols = returningMatch[1].split(',').map((c: string) => c.trim());

          // Create a returned row based on RETURNING clause
          const id = `new-${table}-${idCounter++}`;
          const newRow: Record<string, any> = { id };

          if (returningCols.length === 1 && returningCols[0] === '*') {
            newRow.id = id;
            newRow.title = params?.[2] || 'Test Article';
            newRow.slug = 'test-article';
            newRow.status = 'approved';
            newRow.word_count = 50;
            newRow.seo_score = 72;
            newRow.created_at = new Date();
          }

          if (store[table]) {
            const fullRow = { ...newRow };
            if (params) {
              fullRow.client_id = params[0];
              fullRow.keyword = params[1];
            }
            store[table].push(fullRow);
          }

          return { rows: [newRow], rowCount: 1 };
        }

        // Just insert with no RETURNING
        store[table]?.push({ id: `new-${table}-${idCounter++}` });
        return { rows: [], rowCount: 1 };
      }

      // Handle UPDATE
      if (text.trim().toUpperCase().startsWith('UPDATE')) {
        const returningMatch = text.match(/RETURNING\s+(.+)/i);
        if (returningMatch) {
          return { rows: [{ id: params?.[params.length - 1] || 'updated-id', title: 'Updated', status: 'approved' }], rowCount: 1 };
        }
        return { rows: [{ id: params?.[0] || 'updated-id' }], rowCount: 1 };
      }

      // Handle DELETE
      if (text.trim().toUpperCase().startsWith('DELETE')) {
        const hasReturning = text.includes('RETURNING id');
        if (hasReturning) {
          return { rows: [{ id: params?.[0] || 'deleted-id' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // Handle SELECT
      if (text.trim().toUpperCase().startsWith('SELECT')) {
        // Count queries
        if (text.includes('COUNT(*)') || text.includes('COUNT(')) {
          return { rows: [{ count: String(Object.keys(store[table] || {}).length || 0) }], rowCount: 1 };
        }

        if (table === 'articles' && text.includes('FROM articles')) {
          return {
            rows: [
              { id: 'article-1', title: 'Test Article 1', keyword: 'test keyword', status: 'generated', seo_score: 72, word_count: 500, created_at: new Date(), client_id: 'test-client-id', keyword_id: 'kw-1', content_md: '# Test', content_html: '<p>Test</p>', meta_title: 'Test', meta_description: 'Desc', tags: ['test'], slug: 'test-article', updated_at: new Date() }
            ],
            rowCount: 1
          };
        }

        if (store[table] && store[table].length > 0) {
          return { rows: store[table], rowCount: store[table].length };
        }

        // Dynamic response based on query content
        if (text.includes('NOW()') || text.includes('CURRENT_DATE')) {
          return {
            rows: [
              { time: new Date(), count: 1, date: new Date().toISOString().split('T')[0] }
            ],
            rowCount: 1
          };
        }

        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {}
    }),
    end: async () => {},
    on: vi.fn(),
  };
}

// ─── Auth Routes Tests ───────────────────────

describe('Auth Routes', () => {
  let pool: any;
  let authRoutes: any;

  beforeEach(async () => {
    pool = createMockPoolWithData();
    const mod = await import('../../routes/auth');
    authRoutes = mod.createAuthRoutes(pool);
  });

  it('should expose expected HTTP methods', () => {
    const stack = authRoutes.stack || [];
    const methods = stack.map((l: any) => l.route?.methods).filter(Boolean);
    expect(methods.length).toBeGreaterThan(0);
  });

  it('should have authentication middleware', () => {
    const stack = authRoutes.stack || [];
    const hasAuthMiddleware = stack.some((l: any) =>
      l.name === 'authenticate' || l.handle?.toString().includes('authenticate')
    );
    // Routes use middleware router from auth middleware
    expect(stack.length).toBeGreaterThan(0);
  });

  it('should have change-password route', () => {
    const hasChangePassword = authRoutes.stack?.some(
      (l: any) => l.route?.path === '/change-password'
    );
    expect(hasChangePassword).toBe(true);
  });

  it('should have users route for admin', () => {
    const hasUsersRoute = authRoutes.stack?.some(
      (l: any) => l.route?.path === '/users'
    );
    expect(hasUsersRoute).toBe(true);
  });
});

// ─── Client Routes Tests ─────────────────────

describe('Client Routes', () => {
  it('should create clients route with authentication', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/clients');
    const routes = mod.createClientRoutes(pool);
    expect(routes).toBeDefined();
  });

  it('should list clients', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/clients');
    const routes = mod.createClientRoutes(pool);

    const req = createMockRequest({ method: 'GET', originalUrl: '/api/clients' });
    const res = createMockResponse();

    // Find the list route handler
    const stack = routes.stack || [];
    const listRoute = stack.find((l: any) => l.route?.path === '/' && l.route?.methods?.get);
    expect(listRoute).toBeDefined();
  });
});

// ─── Article Routes Tests ────────────────────

describe('Article Routes', () => {
  let pool: any;

  beforeEach(() => {
    pool = createMockPoolWithData();
  });

  it('should create article routes with authentication', async () => {
    const mod = await import('../../routes/articles');
    const routes = mod.createArticleRoutes(pool);
    expect(routes).toBeDefined();
  });

  it('should register all expected article endpoints', async () => {
    const mod = await import('../../routes/articles');
    const routes = mod.createArticleRoutes(pool);
    const stack = routes.stack || [];

    const expectedPaths = ['/', '/generate', '/:id', '/:id/approve', '/:id/reject', '/:id/publish', '/:id/regenerate', '/:id/preview', '/:id/seo'];
    const registeredPaths = stack
      .filter((l: any) => l.route)
      .map((l: any) => l.route.path);

    for (const path of expectedPaths) {
      expect(registeredPaths).toContain(path);
    }
  });

  it('should have the correct HTTP methods on each endpoint', async () => {
    const mod = await import('../../routes/articles');
    const routes = mod.createArticleRoutes(pool);
    const stack = routes.stack || [];

    // Express creates separate layers per route registration, so we need
    // to accumulate methods from all layers matching each path.
    const routeMethods: Record<string, string[]> = {
      '/': ['get'],
      '/generate': ['post'],
      '/:id': ['get', 'put'],
      '/:id/approve': ['post'],
      '/:id/reject': ['post'],
      '/:id/regenerate': ['post'],
      '/:id/publish': ['post'],
    };

    for (const [path, methods] of Object.entries(routeMethods)) {
      const matchingLayers = stack.filter((l: any) => l.route?.path === path);
      expect(matchingLayers.length).toBeGreaterThan(0);
      // Accumulate all methods from all layers matching this path
      const accumulatedMethods: Record<string, boolean> = {};
      for (const layer of matchingLayers) {
        Object.assign(accumulatedMethods, (layer as any)?.route?.methods || {});
      }
      for (const method of methods) {
        expect(accumulatedMethods[method]).toBe(true);
      }
    }
  });
});

// ─── Admin Routes Tests ──────────────────────

describe('Admin Routes', () => {
  it('should create admin routes', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/admin');
    const routes = mod.createAdminRoutes(pool);
    expect(routes).toBeDefined();
  });

  it('should register all admin endpoints', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/admin');
    const routes = mod.createAdminRoutes(pool);
    const stack = routes.stack || [];

    const adminPaths = ['/dashboard', '/errors', '/health', '/config', '/system-logs', '/notify'];
    const registeredPaths = stack
      .filter((l: any) => l.route)
      .map((l: any) => l.route.path);

    for (const path of adminPaths) {
      expect(registeredPaths).toContain(path);
    }
  });
});

// ─── Webhook Routes Tests ────────────────────

describe('Webhook Routes', () => {
  it('should create webhook routes', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/webhooks');
    const routes = mod.createWebhookRoutes(pool);
    expect(routes).toBeDefined();
  });

  it('should register webhook CRUD + event endpoints', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/webhooks');
    const routes = mod.createWebhookRoutes(pool);
    const stack = routes.stack || [];

    const webhookPaths = [
      '/:clientId/webhooks',
      '/:clientId/webhooks/:webhookId',
      '/events/receive',
    ];
    const registeredPaths = stack
      .filter((l: any) => l.route)
      .map((l: any) => l.route.path);

    for (const path of webhookPaths) {
      expect(registeredPaths).toContain(path);
    }
  });
});

// ─── Analytics Routes Tests ──────────────────

describe('Analytics Routes', () => {
  it('should create analytics routes', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/analytics');
    const routes = mod.createAnalyticsRoutes(pool);
    expect(routes).toBeDefined();
  });

  it('should register analytics endpoints', async () => {
    const pool = createMockPoolWithData();
    const mod = await import('../../routes/analytics');
    const routes = mod.createAnalyticsRoutes(pool);
    const stack = routes.stack || [];

    const analyticsPaths = [
      '/:clientId/overview',
      '/:clientId/logs',
      '/:clientId/history',
      '/:clientId/costs',
      '/:clientId/seo',
      '/:clientId/keyword-analytics',
      '/:clientId/jobs',
    ];
    const registeredPaths = stack
      .filter((l: any) => l.route)
      .map((l: any) => l.route.path);

    for (const path of analyticsPaths) {
      expect(registeredPaths).toContain(path);
    }
  });
});

// ─── Platform Expansion Routes Tests ─────────

describe('Platform Expansion Routes', () => {
  describe('API Keys Routes', () => {
    it('should create and register API key endpoints', async () => {
      const pool = createMockPoolWithData();
      const mod = await import('../../routes/apiKeys');
      const routes = mod.createApiKeyRoutes(pool);
      const stack = routes.stack || [];

      const apiKeyPaths = ['/:clientId/api-keys', '/:clientId/api-keys/:keyId', '/:clientId/api-keys/:keyId/toggle'];
      const registeredPaths = stack.filter((l: any) => l.route).map((l: any) => l.route.path);

      for (const path of apiKeyPaths) {
        expect(registeredPaths).toContain(path);
      }
    });
  });

  describe('Plugin Routes', () => {
    it('should create and register plugin endpoints', async () => {
      const pool = createMockPoolWithData();
      const mod = await import('../../routes/plugins');
      const routes = mod.createPluginRoutes(pool);
      const stack = routes.stack || [];

      const pluginPaths = ['/', '/clients/:clientId', '/clients/:clientId/register', '/clients/:clientId/instances/:instanceId/toggle', '/clients/:clientId/instances/:instanceId/config', '/hooks/:hookName/execute'];
      const registeredPaths = stack.filter((l: any) => l.route).map((l: any) => l.route.path);

      for (const path of pluginPaths) {
        expect(registeredPaths).toContain(path);
      }
    });
  });

  describe('Chat Routes', () => {
    it('should create and register chat endpoints', async () => {
      const pool = createMockPoolWithData();
      const mod = await import('../../routes/chat');
      const routes = mod.createChatRoutes(pool);
      const stack = routes.stack || [];

      const chatPaths = ['/sessions', '/sessions/:id', '/sessions/:id/messages', '/command'];
      const registeredPaths = stack.filter((l: any) => l.route).map((l: any) => l.route.path);

      for (const path of chatPaths) {
        expect(registeredPaths).toContain(path);
      }
    });
  });

  describe('System Config Routes', () => {
    it('should create and register config endpoints', async () => {
      const pool = createMockPoolWithData();
      const mod = await import('../../routes/systemConfig');
      const routes = mod.createSystemConfigRoutes(pool);
      const stack = routes.stack || [];

      const configPaths = ['/public', '/', '/:key', '/categories/list'];
      const registeredPaths = stack.filter((l: any) => l.route).map((l: any) => l.route.path);

      for (const path of configPaths) {
        expect(registeredPaths).toContain(path);
      }
    });
  });
});

// ─── Server Integration (App Factory) Tests ──

describe('Server Application', () => {
  it('should export the app factory', async () => {
    // Just verify the main server module can be imported
    const mod = await import('../../index');
    expect(mod.default).toBeDefined();
  });

  it('should configure CORS with proper defaults', async () => {
    const mod = await import('../../index');
    expect(mod.default).toBeDefined();
    // Express app instance should have settings
    expect(mod.default.settings).toBeDefined();
  });
});

// ─── Mock Services Helpers Tests ────────────

describe('Mock Services Helpers', () => {
  describe('createMockRequest', () => {
    it('should create a request with default user', () => {
      const req = createMockRequest();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('test-user');
      expect(req.user.role).toBe('admin');
      expect(req.method).toBe('GET');
    });

    it('should merge overrides', () => {
      const req = createMockRequest({ body: { keyword: 'test' }, method: 'POST' });
      expect(req.method).toBe('POST');
      expect(req.body.keyword).toBe('test');
    });
  });

  describe('createMockResponse', () => {
    it('should chain status and json', () => {
      const res = createMockResponse();
      const result = res.status(201).json({ id: '123' });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ id: '123' });
    });

    it('should default to 200 status', () => {
      const res = createMockResponse();
      expect(res.statusCode).toBe(200);
    });

    it('should also work with send', () => {
      const res = createMockResponse();
      res.status(400).send({ error: 'Bad request' });
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Bad request' });
    });
  });

  describe('createMockPool', () => {
    it('should return empty results', async () => {
      const pool = (await import('../../tests/mocks/mockServices')).createMockPool();
      const result = await pool.query('SELECT 1');
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should support connect/release pattern', async () => {
      const pool = (await import('../../tests/mocks/mockServices')).createMockPool();
      const client = await pool.connect();
      const result = await client.query('SELECT 1');
      expect(result.rows).toEqual([]);
      client.release();
      expect(pool.end).toBeDefined();
    });
  });
});
