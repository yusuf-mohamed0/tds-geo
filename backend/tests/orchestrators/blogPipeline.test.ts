// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Blog Pipeline Orchestrator Tests
// ══════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { EnterprisePipelineOrchestrator, PipelineStageResult } from '../../orchestrators/blogPipeline';
import openaiService from '../../services/openai';

vi.mock('../../utils/queue', () => ({
  QueueNames: {
    CONTENT_GENERATION: 'content-generation',
    DEFAULT: 'default'
  },
  addJob: vi.fn().mockResolvedValue({ id: 'test-job-id' })
}));

// Mock all services
vi.mock('../../services/openai', () => ({
  default: {
    generateBlogPost: vi.fn().mockResolvedValue({
      title: 'Test Blog Post',
      content: '# Test\n\nContent here.\n\n## Section\n\nMore content.',
      metaTitle: 'Test Blog Post',
      metaDescription: 'A test blog post for unit testing.',
      tags: ['test', 'maintenance'],
      faqSection: '## FAQ\n\n### Q?\nA',
      metadata: { tokensIn: 500, tokensOut: 1000, wordCount: 150 }
    }),
    generateTitle: vi.fn().mockResolvedValue('Test Blog Post'),
    generateOutline: vi.fn().mockResolvedValue(['Section 1', 'Section 2', 'Section 3']),
    generateFAQ: vi.fn().mockResolvedValue('## FAQ\n\n### Q?\nA'),
    generateMetadata: vi.fn().mockResolvedValue({ metaTitle: 'Test', metaDescription: 'Desc' }),
    enhanceSEO: vi.fn().mockImplementation((content: string) => Promise.resolve(content)),
    generateArticleImage: vi.fn().mockRejectedValue(new Error('Image gen failed')),
    moderateContent: vi.fn().mockResolvedValue({ safe: true, flags: [], summary: 'safe' })
  }
}));

vi.mock('../../services/serpapi', () => ({
  default: {
    getKeywordData: vi.fn().mockResolvedValue({
      search_volume: 500,
      competition: 0.35,
      cpc: 3.50,
      trend_score: 70,
      related_keywords: ['test keyword tips']
    })
  }
}));

vi.mock('../../services/vectorMemory', () => ({
  default: {
    isDuplicate: vi.fn().mockResolvedValue(false),
    storeArticleChunks: vi.fn().mockResolvedValue(undefined),
    findSimilar: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../../services/costTracker', () => ({
  default: {
    calculateOpenAICost: vi.fn().mockReturnValue(0.01),
    recordCost: vi.fn().mockResolvedValue(undefined),
    isBudgetExceeded: vi.fn().mockResolvedValue(false)
  }
}));

vi.mock('../../services/webhooks', () => ({
  default: {
    trigger: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../services/shopify', () => ({
  default: {
    init: vi.fn(),
    fetchBlogs: vi.fn().mockResolvedValue([{ id: 123, title: 'Blog', handle: 'blog' }]),
    publishArticle: vi.fn().mockResolvedValue({ id: 999, blogId: 123, url: 'https://test.com/post', handle: 'test-post' }),
    uploadImage: vi.fn().mockResolvedValue({ id: 888 })
  }
}));

vi.mock('../../services/seo', () => ({
  default: {
    analyzeContent: vi.fn().mockResolvedValue({
      score: 75,
      keywordDensity: 1.5,
      readabilityScore: 70,
      suggestions: ['Good article'],
      headingStructure: { h1: true, h2: 3, h3: 2 }
    }),
    generateSlug: vi.fn().mockImplementation((title: string) =>
      title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    )
  }
}));

vi.mock('../../services/internalLinks', () => ({
  default: {
    findLinkOpportunities: vi.fn().mockResolvedValue([]),
    injectLinks: vi.fn().mockImplementation((content: string) => content),
    refreshArticleCache: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../../utils/markdownToHtml', () => ({
  convert: vi.fn().mockImplementation((md: string) => `<p>${md}</p>`)
}));

// ─── Enterprise Service Mocks ──────────────────

vi.mock('../../services/seoIntelligence', () => ({
  default: {
    initialize: vi.fn(),
    classifySearchIntent: vi.fn().mockResolvedValue({
      intent: 'informational',
      confidence: 0.85,
      suggestedContentFormat: 'guide'
    }),
    analyzeSERP: vi.fn().mockResolvedValue({
      searchIntent: 'informational',
      serpFeatures: ['featured_snippet', 'people_also_ask'],
      entityLandscape: ['test entity']
    }),
    analyzeContentSEO: vi.fn().mockResolvedValue({
      score: 72,
      suggestions: ['Add more headings']
    })
  }
}));

vi.mock('../../services/factCheckService', () => ({
  default: {
    initialize: vi.fn(),
    verifyArticle: vi.fn().mockResolvedValue({
      overallConfidence: 0.95,
      requiresHumanReview: false,
      factChecks: [],
      citations: []
    })
  }
}));

vi.mock('../../services/brandVoice', () => ({
  default: {
    initialize: vi.fn(),
    getContentGuidance: vi.fn().mockResolvedValue({
      forbiddenPhrases: [],
      preferredTerminology: {}
    }),
    checkConsistency: vi.fn().mockResolvedValue({
      score: 100,
      violations: []
    })
  }
}));

vi.mock('../../services/editorialWorkflow', () => ({
  default: {
    initialize: vi.fn(),
    createReviewAssignment: vi.fn().mockResolvedValue(undefined),
    advanceStatus: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../services/contentIntelligence', () => ({
  default: {
    initialize: vi.fn(),
    detectCannibalization: vi.fn().mockResolvedValue([]),
    findLinkingOpportunities: vi.fn().mockResolvedValue([]),
    analyzeTopicSaturation: vi.fn().mockResolvedValue({
      saturation_score: 10,
      article_count: 2,
      recommendation: 'continue'
    })
  }
}));

vi.mock('../../services/aiEvaluation', () => ({
  default: {
    initialize: vi.fn(),
    evaluateContent: vi.fn().mockResolvedValue({
      overall: 85,
      feedback: 'Content is well-structured',
      dimensions: { readability: 80, seo: 75, accuracy: 90 }
    }),
    generateQualityReport: vi.fn().mockResolvedValue({
      qualityScore: { overall: 85 },
      estimatedRankingPotential: 'high',
      actionableSteps: ['Add more internal links']
    })
  }
}));

vi.mock('../../services/pexelsService', () => ({
  default: {
    initialize: vi.fn(),
    findImagesForArticle: vi.fn().mockResolvedValue({
      featuredImage: { url: 'https://images.pexels.com/test.jpg', altText: 'Test image', photographer: 'Test', photographerUrl: 'https://pexels.com/test', pexelsId: 123 },
      sectionImages: []
    })
  }
}));

vi.mock('../../services/multiCmsPublisher', () => ({
  default: {
    initialize: vi.fn(),
    publish: vi.fn().mockResolvedValue({
      url: 'https://test-shop.myshopify.com/blogs/123/test-article',
      id: '999'
    })
  }
}));

vi.mock('../../services/costOptimization', () => ({
  default: {
    getInstance: vi.fn().mockReturnValue({
      initialize: vi.fn(),
      routeTask: vi.fn().mockResolvedValue({
        model: 'gpt-4o',
        provider: 'openai',
        estimatedCost: 0.01,
        maxTokens: 4000,
        reason: 'default'
      }),
      recordTokenUsage: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

vi.mock('../../services/observability', () => ({
  default: {
    initialize: vi.fn(),
    startSpan: vi.fn().mockReturnValue({ id: 'span-1', trace_id: 'trace-1', parent_span_id: null }),
    endSpan: vi.fn(),
    recordAILatency: vi.fn()
  }
}));

vi.mock('../../services/enterpriseSecurity', () => ({
  default: {
    initialize: vi.fn()
  }
}));

vi.mock('../../services/circuitBreaker', () => ({
  default: {
    initialize: vi.fn()
  }
}));

// ─── Mock Pool ───────────────────────────────

function createMockPool(clientOverrides: Record<string, any> = {}) {
  const rows: Record<string, any[]> = {
    clients: [{
      id: 'test-client',
      name: 'Test Client',
      slug: 'test-client',
      shopify_shop: 'test-shop.myshopify.com',
      shopify_token: 'test-token',
      shopify_api_version: '2025-07',
      brand_voice: 'professional',
      service_area: 'New York',
      timezone: 'America/New_York',
      publish_frequency: 'daily',
      preferred_publish_hour: 10,
      approval_mode: 'auto',
      monthly_token_limit: 1000000,
      monthly_cost_limit: 100,
      settings: {},
      is_active: true,
      ...clientOverrides
    }]
  };

  return {
    query: async (text: string, params?: any[]) => {
      // Find which table is being queried
      const tableMatch = text.match(/FROM\s+(\w+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : '';

      if (text.startsWith('SELECT') && text.includes('FROM') && rows[table]) {
        return { rows: rows[table], rowCount: rows[table].length };
      }

      if (text.startsWith('INSERT') || text.startsWith('UPDATE')) {
        const returningMatch = text.match(/RETURNING\s+\*\s*$/i);
        if (returningMatch && table === 'articles') {
          return {
            rows: [{
              id: 'new-article-id',
              title: 'Test Blog Post',
              slug: 'test-blog-post',
              status: 'approved',
              word_count: 150,
              seo_score: 75,
              created_at: new Date()
            }],
            rowCount: 1
          };
        }
        return { rows: [{ id: params?.[0] || 'new-id' }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => {}
  } as any;
}

describe('EnterprisePipelineOrchestrator', () => {
  const pool = createMockPool();
  const orchestrator = new EnterprisePipelineOrchestrator(pool);

  describe('runFullPipeline', () => {
    it('should successfully complete a full pipeline run', async () => {
      const result = await orchestrator.runFullPipeline('test-client', 'unit test keyword', {
        publish: false,
        minWords: 500,
        maxWords: 1000,
        bypassDedup: true
      });

      expect(result.success).toBe(true);
      expect(result.articleId).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.keyword).toBe('unit test keyword');
      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.duration).toBeDefined();

      // Check that key pipeline stages ran
      const stageNames: string[] = result.stages.map((s: PipelineStageResult) => s.stageName);
      expect(stageNames).toContain('keyword_discovery');
      expect(stageNames).toContain('title_generation');
      expect(stageNames).toContain('article_generation');
      expect(stageNames).toContain('seo_enhancement');
      expect(stageNames).toContain('html_conversion');
      expect(stageNames).toContain('article_storage');
    });

    it('should include all expected pipeline stages', async () => {
      const result = await orchestrator.runFullPipeline('test-client', 'pipeline stages test', {
        publish: false,
        bypassDedup: true
      });

      const expectedStages = [
        'keyword_discovery',
        'title_generation',
        'outline_generation',
        'article_generation',
        'seo_enhancement',
        'cta_insertion',
        'faq_schema',
        'content_safety',
        'html_conversion',
        'internal_linking',
        'article_storage',
        'vector_embedding',
        'webhook_notification'
      ];

      const stageNames: string[] = result.stages.map((s: PipelineStageResult) => s.stageName);
      for (const stage of expectedStages) {
        expect(stageNames).toContain(stage);
      }
    });

    it('should successfully publish when publish flag is true and auto-approve', async () => {
      const result = await orchestrator.runFullPipeline('test-client', 'publish test', {
        publish: true,
        bypassDedup: true
      });

      expect(result.success).toBe(true);
      expect(result.published).toBe(true);
      expect(result.publishUrl).toBeDefined();
    });

    it('should handle pipeline failure gracefully', async () => {
      // Mock a failure in the openai service
      vi.mocked(openaiService.generateBlogPost).mockRejectedValueOnce(new Error('OpenAI API error'));

      const result = await orchestrator.runFullPipeline('test-client', 'failure test', {
        publish: false,
        bypassDedup: true
      });

      // Pipeline gracefully handles stage-level errors — overall success remains true,
      // but the failed stage is recorded with success: false
      const failedStage = result.stages.find(s => s.stageName === 'article_generation');
      expect(failedStage).toBeDefined();
      expect(failedStage!.success).toBe(false);
      expect(failedStage!.error).toBeDefined();
      expect(result.stages.length).toBeGreaterThan(0);
    });

    it('should respect manual approval mode', async () => {
      const manualPool = createMockPool({ approval_mode: 'manual' });
      const manualOrchestrator = new EnterprisePipelineOrchestrator(manualPool);

      const result = await manualOrchestrator.runFullPipeline('test-client', 'manual approval test', {
        publish: true,
        bypassDedup: true
      });

      expect(result.success).toBe(true);
      // Article should be generated but not published due to manual approval
      expect(result.published).toBe(false);
    });
  });
});
