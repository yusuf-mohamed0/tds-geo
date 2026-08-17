// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Health Endpoint Tests
// Verifies the /health endpoint correctly reports
// OpenAI API key configuration status
// ══════════════════════════════════════════════

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// ─── Mock pg BEFORE importing the app ─────────
vi.mock('pg', () => {
  const MockPool = vi.fn().mockImplementation(function () {
    return {
    query: vi.fn().mockImplementation((text: string) => {
      if (text.trim() === 'SELECT 1') {
        return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
      }
      if (text.includes('FROM articles') || text.includes('FROM activity_logs') || text.includes('FROM clients') || text.includes('FROM cost_tracking') || text.includes('FROM jobs')) {
        return Promise.resolve({
          rows: [{
            pending_articles: 2,
            published_articles: 5,
            articles_24h: 1,
            errors_24h: 0,
            warnings_24h: 1,
            queued_jobs: 0,
            failed_jobs_24h: 0,
            total_actions_24h: 15,
            active_clients: 3,
            costs_mtd: '45.50',
            pipeline_runs_24h: 2,
          }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    };
  });
  return { Pool: MockPool };
});

// ─── Mock all services to prevent real init ───
// Use dynamic getters so isMockMode reflects process.env at request time
vi.mock('../../services/openai', () => ({
  default: {
    get isMockMode() { return !process.env.OPENAI_API_KEY; },
    get provider() { return 'openai'; },
    get defaultModel() { return process.env.OPENAI_MODEL || 'gpt-4o'; },
    initialize: vi.fn(),
    generateBlogPost: vi.fn(),
    moderateContent: vi.fn(),
    generateTitle: vi.fn(),
    generateOutline: vi.fn(),
    enhanceSEO: vi.fn(),
    generateFAQ: vi.fn(),
    generateMetadata: vi.fn(),
    generateArticleImage: vi.fn(),
    analyzeSEO: vi.fn(),
    generateKeywordVariations: vi.fn(),
    chat: vi.fn(),
  }
}));

vi.mock('../../services/shopify', () => ({ default: { init: vi.fn(), fetchBlogs: vi.fn().mockResolvedValue([]), publishArticle: vi.fn(), uploadImage: vi.fn() } }));
vi.mock('../../services/seo', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/keywords', () => ({ default: { initialize: vi.fn(), close: vi.fn() } }));
vi.mock('../../services/webhooks', () => ({ default: { initialize: vi.fn(), trigger: vi.fn() } }));
vi.mock('../../services/vectorMemory', () => ({ default: { initialize: vi.fn(), close: vi.fn() } }));
vi.mock('../../services/internalLinks', () => ({ default: { initialize: vi.fn(), close: vi.fn() } }));
vi.mock('../../services/costTracker', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/pluginService', () => ({ default: { initialize: vi.fn(), close: vi.fn() } }));
vi.mock('../../services/chatEngine', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/selfImprovementService', () => ({
  default: { initialize: vi.fn(), close: vi.fn(), getSuggestions: vi.fn().mockResolvedValue([]), getPerformanceStats: vi.fn().mockResolvedValue({}), runFullAnalysis: vi.fn().mockResolvedValue([]) }
}));
vi.mock('../../services/factCheckService', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/seoIntelligence', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/brandVoice', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/multiCmsPublisher', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/pexelsService', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/costOptimization', () => ({
  default: { getInstance: vi.fn().mockReturnValue({ initialize: vi.fn(), close: vi.fn() }) }
}));
vi.mock('../../services/editorialWorkflow', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/observability', () => ({ default: { initialize: vi.fn(), close: vi.fn() } }));
vi.mock('../../services/enterpriseSecurity', () => ({ default: { initialize: vi.fn(), close: vi.fn() } }));
vi.mock('../../services/contentIntelligence', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/aiEvaluation', () => ({ default: { initialize: vi.fn() } }));
vi.mock('../../services/circuitBreaker', () => ({ default: { initialize: vi.fn(), close: vi.fn() } }));
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
  initLogBuffer: vi.fn(),
  closeLogBuffer: vi.fn(),
}));

// ─── Tests ────────────────────────────────────

describe('Health Endpoint - OpenAI Configuration', () => {
  beforeAll(() => {
    // Set env before the app module loads for the first time
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-12345';
    process.env.OPENAI_MODEL = 'gpt-4o';
    process.env.PORT = '0'; // random port — avoid conflicts
    process.env.REDIS_URL = ''; // skip Redis check
    process.env.DATABASE_URL = 'postgres://localhost:5432/test';
  });

  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.PORT;
    delete process.env.REDIS_URL;
    delete process.env.DATABASE_URL;
  });

  it('should report OpenAI as configured when API key is set', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-12345';
    process.env.OPENAI_MODEL = 'gpt-4o';

    const mod = await import('../../index');
    const app = mod.default;
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.openai).toBeDefined();

    expect(res.body.checks.openai).toEqual({
      status: 'configured',
      mode: 'live',
      model: 'gpt-4o',
      provider: 'openai',
    });
  });

  it('should report OpenAI as not configured when API key is missing', async () => {
    // Change the env var — the mock's getter reads it dynamically at request time
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;

    // The module is cached, but the health endpoint reads process.env at request time
    // and the mocked openaiService uses getters that also read process.env dynamically
    const mod = await import('../../index');
    const app = mod.default;
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.openai).toBeDefined();

    expect(res.body.checks.openai.status).toBe('not_configured');
    expect(res.body.checks.openai.mode).toBe('mock');
    expect(res.body.checks.openai.provider).toBe('openai');
    // model falls back to default when OPENAI_MODEL is deleted
    expect(res.body.checks.openai.model).toBe('gpt-4o');
  });
});
