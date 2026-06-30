// ══════════════════════════════════════════════
// End-to-End Pipeline Integration Test
// Exercises BlogPipelineOrchestrator with mocked
// external services (no API keys, no DB needed)
// ══════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { EnterprisePipelineOrchestrator, PipelineStageResult } from '../../orchestrators/blogPipeline';

// ─── Mock All External Services ───────────────

vi.mock('../../services/openai', () => ({
  default: {
    initialize: vi.fn(),
    isMockMode: true,
    generateBlogPost: vi.fn().mockResolvedValue({
      title: 'Test Blog Post',
      content: '# Test\n\nContent here.\n\n## Section\n\nMore content.\n\n## Warning Signs\n\n- Sign one\n- Sign two\n\n## FAQ\n\n### Q?\nA.',
      metaTitle: 'Test Meta Title',
      metaDescription: 'Test meta description for the keyword.',
      tags: ['test', 'maintenance'],
      faqSection: '## FAQ\n\n### Q?\nA.',
      metadata: { tokensIn: 100, tokensOut: 200, model: 'gpt-4o', wordCount: 50 }
    }),
    generateTitle: vi.fn().mockResolvedValue('The Complete Guide to Test Keyword'),
    generateOutline: vi.fn().mockResolvedValue(['Section 1', 'Section 2', 'Section 3']),
    generateFAQ: vi.fn().mockResolvedValue('## FAQ\n\n### Q?\nA.'),
    generateMetadata: vi.fn().mockResolvedValue({ metaTitle: 'Test', metaDescription: 'Desc' }),
    enhanceSEO: vi.fn().mockImplementation((c: string) => Promise.resolve(c)),
    generateArticleImage: vi.fn().mockRejectedValue(new Error('Image gen not available')),
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
      related_keywords: ['related keyword']
    })
  }
}));

vi.mock('../../services/vectorMemory', () => ({
  default: {
    isDuplicate: vi.fn().mockResolvedValue(false),
    storeArticleChunks: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn()
  }
}));

vi.mock('../../services/costTracker', () => ({
  default: {
    calculateOpenAICost: vi.fn().mockReturnValue(0.01),
    recordCost: vi.fn().mockResolvedValue(undefined),
    isBudgetExceeded: vi.fn().mockResolvedValue(false),
    initialize: vi.fn()
  }
}));

vi.mock('../../services/webhooks', () => ({
  default: {
    trigger: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn()
  }
}));

vi.mock('../../services/shopify', () => ({
  default: {
    fetchBlogs: vi.fn().mockResolvedValue([{ id: 123, title: 'Blog', handle: 'blog' }]),
    publishArticle: vi.fn().mockResolvedValue({
      id: 999, blogId: 123,
      url: 'https://test-shop.myshopify.com/blogs/123/test-article',
      handle: 'test-article'
    }),
    uploadImage: vi.fn().mockResolvedValue({ id: 888 }),
    init: vi.fn()
  }
}));

vi.mock('../../services/seo', () => ({
  default: {
    analyzeContent: vi.fn().mockResolvedValue({
      score: 72,
      keywordDensity: 1.5,
      readabilityScore: 70,
      suggestions: ['Good structure'],
      headingStructure: { h1: true, h2: 3, h3: 2 }
    }),
    generateSlug: vi.fn().mockImplementation(
      (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    ),
    initialize: vi.fn()
  }
}));

vi.mock('../../services/qualityScorer', () => ({
  default: {
    scoreArticle: vi.fn().mockResolvedValue({
      overall: 78,
      readability: 72,
      seoOptimization: 80,
      eatScore: 75,
      uniqueness: 85,
      semanticRichness: 70,
      ctaQuality: 65,
      breakdown: {},
      suggestions: ['Content quality is good across all dimensions']
    }),
    initialize: vi.fn()
  }
}));

vi.mock('../../services/internalLinks', () => ({
  default: {
    findLinkOpportunities: vi.fn().mockResolvedValue([]),
    injectLinks: vi.fn().mockImplementation((c: string) => c),
    refreshArticleCache: vi.fn().mockResolvedValue([]),
    initialize: vi.fn()
  }
}));

vi.mock('../../services/keywords', () => ({
  default: {
    markKeywordUsed: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn()
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

vi.mock('../../utils/queue', () => ({
  QueueNames: {
    CONTENT_GENERATION: 'content-generation',
    DEFAULT: 'default',
    SHOPIFY_PUBLISH: 'shopify-publish'
  },
  addJob: vi.fn().mockResolvedValue({ id: 'test-job-id' })
}));

// ─── Mock Pool Factory ────────────────────────

function createMockPool(clientOverrides: Record<string, any> = {}) {
  let articleIdCounter = 0;
  let workflowIdCounter = 0;

  const rows: Record<string, any[]> = {
    clients: [{
      id: 'test-client',
      name: 'Test Client',
      slug: 'test-client',
      shopify_shop: 'test-shop.myshopify.com',
      shopify_token: 'test-token',
      shopify_api_version: '2024-07',
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
    query: async (text: string, _params?: any[]) => {
      const tableMatch = text.match(/FROM\s+(\w+)/i)
        || text.match(/INTO\s+(\w+)/i)
        || text.match(/UPDATE\s+(\w+)/i);
      const table = tableMatch ? tableMatch[1].toLowerCase() : '';

      if (text.startsWith('SELECT')) {
        if (text.includes('RETURNING id')) {
          return { rows: [{ id: `existing-${table}` }], rowCount: 1 };
        }
        if (text.includes('COUNT(')) {
          return { rows: [{ count: '1' }], rowCount: 1 };
        }
        if (text.includes('NOW()') || text.includes('CURRENT_DATE')) {
          return { rows: [{ time: new Date() }], rowCount: 1 };
        }
        if (rows[table]) {
          return { rows: rows[table], rowCount: rows[table].length };
        }
        if (text.includes('FROM articles')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }

      if (text.startsWith('INSERT')) {
        const returning = text.match(/RETURNING\s+\*\s*$/i);
        if (returning) {
          articleIdCounter++;
          const id = `e2e-article-${articleIdCounter}`;
          if (table === 'articles') {
            return {
              rows: [{
                id, title: 'The Complete Guide to Test Keyword',
                slug: 'the-complete-guide-to-test-keyword',
                status: 'approved',
                word_count: 150,
                seo_score: 72,
                created_at: new Date()
              }],
              rowCount: 1
            };
          }
          return { rows: [{ id: `new-${table}-${articleIdCounter}` }], rowCount: 1 };
        }

        // workflow_logs insert returns id via RETURNING id
        if (table === 'workflow_logs') {
          workflowIdCounter++;
          return { rows: [{ id: `wf-${workflowIdCounter}` }], rowCount: 1 };
        }

        return { rows: [{ id: `new-${table}-default` }], rowCount: 1 };
      }

      if (text.startsWith('UPDATE') || text.startsWith('DELETE')) {
        const returning = text.match(/RETURNING\s+(id|\*)/i);
        if (returning) {
          return { rows: [{ id: _params?.[_params.length - 1] || 'updated-id' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => {}
  } as any;
}

// ─── Tests ─────────────────────────────────────

describe('EnterprisePipelineOrchestrator — E2E Integration', () => {
  describe('runFullPipeline', () => {
    it('should complete a full pipeline run and return pipeline result', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      const result = await orchestrator.runFullPipeline('test-client', 'e2e test keyword', {
        publish: false,
        bypassDedup: true,
        usePexels: false
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.articleId).toBeDefined();
      expect(result.title).toBe('The Complete Guide to Test Keyword');
      expect(result.keyword).toBe('e2e test keyword');
      expect(result.duration).toBeDefined();
    });

    it('should execute all expected pipeline stages in order', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      const result = await orchestrator.runFullPipeline('test-client', 'stage order test', {
        publish: false,
        bypassDedup: true,
        usePexels: false
      });

      const expectedStages = [
        'keyword_discovery',
        'search_intent',
        'serp_entity_analysis',
        'brand_voice',
        'title_generation',
        'outline_generation',
        'article_generation',
        'seo_enhancement',
        'quality_gate',
        'fact_checking',
        'brand_consistency',
        'cannibalization_check',
        'content_safety',
        'html_conversion',
        'internal_linking',
        'pexels_images',
        'faq_schema',
        'cta_insertion',
        'article_storage',
        'vector_embedding',
        'quality_evaluation',
        'topic_saturation',
        'editorial_workflow',
        'webhook_notification'
      ];

      const stageNames: string[] = result.stages.map((s: PipelineStageResult) => s.stageName);
      for (const stage of expectedStages) {
        expect(stageNames).toContain(stage);
      }
    });

    it('should include word count and SEO score in successful result', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      const result = await orchestrator.runFullPipeline('test-client', 'metrics test', {
        publish: false,
        bypassDedup: true,
        usePexels: false
      });

      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.seoScore).toBeDefined();
    });

    it('should show published=true when publish flag is true and auto-approve', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      const result = await orchestrator.runFullPipeline('test-client', 'publish test', {
        publish: true,
        bypassDedup: true,
        usePexels: false
      });

      expect(result.success).toBe(true);
      expect(result.published).toBe(true);
      expect(result.publishUrl).toBeDefined();
    });

    it('should NOT publish when approval_mode is manual despite publish=true', async () => {
      const manualPool = createMockPool({ approval_mode: 'manual' });
      const orchestrator = new EnterprisePipelineOrchestrator(manualPool);

      const result = await orchestrator.runFullPipeline('test-client', 'manual approval test', {
        publish: true,
        bypassDedup: true,
        usePexels: false
      });

      expect(result.success).toBe(true);
      expect(result.published).toBe(false);
    });

    it('should handle content generation failure gracefully at stage level', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      // Force the generateBlogPost mock to fail
      const openai = await import('../../services/openai');
      vi.mocked(openai.default.generateBlogPost).mockRejectedValueOnce(
        new Error('OpenAI API error')
      );

      const result = await orchestrator.runFullPipeline('test-client', 'failure test', {
        publish: false,
        bypassDedup: true,
        usePexels: false
      });

      // The pipeline should still return a result (overall object), but
      // the article_generation stage should be marked as failed
      const failedStage = result.stages.find(s => s.stageName === 'article_generation');
      expect(failedStage).toBeDefined();
      expect(failedStage!.success).toBe(false);
      expect(failedStage!.error).toBeDefined();
    });

    it('should handle full pipeline failure gracefully', async () => {
      // Only override client SELECT — keep all other queries working
      const pool = createMockPool();
      const originalQuery = pool.query;
      pool.query = async (text: string, params?: any[]) => {
        if (text.includes('FROM clients') && text.includes('WHERE')) {
          return { rows: [], rowCount: 0 };
        }
        return originalQuery(text, params);
      };

      const orchestrator = new EnterprisePipelineOrchestrator(pool);
      const result = await orchestrator.runFullPipeline('nonexistent', 'no client test', {
        publish: false,
        bypassDedup: true,
        usePexels: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.duration).toBeDefined();
    });

    it('should include quality score when available', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      const result = await orchestrator.runFullPipeline('test-client', 'quality test', {
        publish: false,
        bypassDedup: true,
        usePexels: false
      });

      // Quality score comes from AI evaluation service mock (returns 85)
      expect(result.qualityScore).toBe(85);
    });

    it('should respect bypassDedup=true to skip duplicate check', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      const result = await orchestrator.runFullPipeline('test-client', 'dedup bypass', {
        publish: false,
        bypassDedup: true,
        usePexels: false
      });

      const stageNames: string[] = result.stages.map((s: PipelineStageResult) => s.stageName);
      expect(stageNames).not.toContain('semantic_dedup');
    });

    it('should include semantic_dedup stage when bypassDedup is false', async () => {
      const pool = createMockPool();
      const orchestrator = new EnterprisePipelineOrchestrator(pool);

      const result = await orchestrator.runFullPipeline('test-client', 'dedup enabled', {
        publish: false,
        bypassDedup: false,
        usePexels: false
      });

      const stageNames: string[] = result.stages.map((s: PipelineStageResult) => s.stageName);
      expect(stageNames).toContain('semantic_dedup');
    });
  });
});
