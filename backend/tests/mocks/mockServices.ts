// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Mock Services for Testing
// Provides fake implementations of OpenAI, SerpAPI,
// Shopify, and other services for isolated testing
// ══════════════════════════════════════════════

import { GeneratedArticle, SerpApiResult } from '../../types';
import { SafetyResult } from '../../services/contentSafety';

// ─── Mock OpenAI Service ─────────────────────

export const mockOpenAI = {
  defaultModel: 'gpt-4o-test',
  maxTokens: 4096,
  temperature: 0.7,

  initialize: () => {},

  generateBlogPost: async (params: { keyword: string; tone?: string; minWords?: number; maxWords?: number }): Promise<GeneratedArticle> => ({
    title: `Test: ${params.keyword}`,
    content: `# ${params.keyword}\n\nThis is a test article about ${params.keyword}. It contains educational content about maintenance and warning signs.\n\n## Common Warning Signs\n\n- Sign 1\n- Sign 2\n- Sign 3\n\n## Preventative Maintenance\n\nRegular maintenance is important for ${params.keyword}.\n\n## When to Call a Professional\n\nIf you notice these signs, contact a professional.\n\n## Frequently Asked Questions\n\n### Question 1?\nAnswer 1\n\n### Question 2?\nAnswer 2`,
    metaTitle: params.keyword.slice(0, 60),
    metaDescription: `Learn about ${params.keyword} - expert maintenance tips and warning signs from our professional team.`,
    tags: [params.keyword, 'maintenance', 'professional'],
    faqSection: '## Frequently Asked Questions\n\n### Test FAQ?\nTest answer',
    metadata: {
      model: 'gpt-4o-test',
      temperature: 0.7,
      wordCount: 150
    }
  }),

  generateTitle: async (keyword: string): Promise<string> =>
    `The Complete Guide to ${keyword}`,

  generateOutline: async (_keyword: string, _title: string, _blacklist: string[] = []): Promise<string[]> =>
    ['Introduction', 'Common Warning Signs', 'Preventative Maintenance Tips', 'When to Call a Professional', 'FAQ'],

  enhanceSEO: async (content: string, _keyword: string): Promise<string> => content,

  generateFAQ: async (_keyword: string, _count: number = 4): Promise<string> =>
    '## Frequently Asked Questions\n\n### Test Question?\nTest answer.',

  generateMetadata: async (title: string, _content: string, _keyword: string) => ({
    metaTitle: title.slice(0, 60),
    metaDescription: `Learn about ${title} - expert tips and professional service.`
  }),

  moderateContent: async (_content: string): Promise<{ safe: boolean; flags: any[]; summary: string }> => ({
    safe: true,
    flags: [],
    summary: 'Content is safe'
  }),

  generateArticleImage: async (title: string, _keyword: string) => ({
    imageUrl: 'https://example.com/test-image.png',
    altText: `${title} professional maintenance`,
    prompt: `Professional image of ${title}`
  }),

  analyzeSEO: async (_content: string, _keyword: string): Promise<Record<string, unknown>> => ({
    score: 75,
    keywordDensity: 1.2,
    suggestions: ['Good keyword usage', 'Consider adding more H2 sections'],
    headingStructure: { h1: true, h2: 4, h3: 3 },
    readabilityScore: 72
  }),

  generateKeywordVariations: async (_seed: string, count: number = 10): Promise<string[]> =>
    Array.from({ length: count }, (_, i) => `test keyword variation ${i + 1}`)
};

// ─── Mock SerpAPI Service ────────────────────

export const mockSerpAPI = {
  getKeywordData: async (keyword: string): Promise<SerpApiResult> => ({
    keyword,
    search_volume: Math.round(100 + Math.random() * 900),
    competition: 0.35,
    cpc: 3.25,
    trend_score: 65,
    related_keywords: [`related ${keyword}`, `${keyword} tips`, `${keyword} guide`]
  }),

  getBulkKeywordData: async (keywords: string[]): Promise<SerpApiResult[]> =>
    keywords.map(kw => ({
      keyword: kw,
      search_volume: 250,
      competition: 0.4,
      cpc: 2.8,
      trend_score: 55,
      related_keywords: []
    })),

  getTrendData: async (_keyword: string): Promise<{ interest: number; related: string[] }> => ({
    interest: 60,
    related: ['trending term 1', 'trending term 2']
  })
};

// ─── Mock Shopify Service ────────────────────

export const mockShopify = {
  fetchBlogs: async () => [
    { id: 12345, title: 'News', handle: 'news' },
    { id: 12346, title: 'Blog', handle: 'blog' }
  ],

  fetchArticles: async () => [
    {
      id: 54321,
      title: 'Existing blog post',
      handle: 'existing-post',
      body_html: '<p>Existing content</p>',
      published_at: '2024-01-01T00:00:00Z',
      tags: ['maintenance', 'tips']
    }
  ],

  publishArticle: async (_shopConfig: any, _blogId: number | string, _article: any) => ({
    id: 99999,
    blogId: typeof _blogId === 'number' ? _blogId : parseInt(_blogId),
    blogHandle: 'news',
    url: 'https://test-shop.myshopify.com/blogs/news/test-article',
    handle: 'test-article',
    shopifyArticle: { id: 99999, handle: 'test-article' }
  }),

  uploadImage: async (_shopConfig: any, _blogId: number | string, _articleId: number, _imageUrl: string, _altText: string) => ({
    id: 88888,
    src: _imageUrl,
    alt: _altText
  }),

  getRateLimitStatus: async () => ({ calls: '5/40', remaining: 35 })
};

// ─── Mock Webhook Service ────────────────────

export const mockWebhookService = {
  initialize: () => {},
  trigger: async (_event: string, _clientId: string, _payload: Record<string, unknown>) => {},
  _deliveries: [] as any[]
};

// ─── Mock Vector Memory Service ──────────────

export const mockVectorMemory = {
  initialize: () => {},
  generateEmbedding: async (_text: string): Promise<number[]> =>
    Array.from({ length: 1536 }, () => Math.random() * 2 - 1),

  storeChunk: async () => {},
  storeArticleChunks: async () => {},

  findSimilar: async (): Promise<any[]> => [],

  isDuplicate: async (): Promise<boolean> => false,

  findRelated: async (): Promise<any[]> => [],

  close: async () => {}
};

// ─── Mock Cost Tracker ────────────────────────

export const mockCostTracker = {
  initialize: () => {},
  recordCost: async () => {},
  calculateOpenAICost: (_model: string, tokensIn: number, tokensOut: number): number =>
    tokensIn * 0.000005 + tokensOut * 0.000015,
  getMonthlyUsage: async () => ({
    totalCost: 12.50,
    totalTokens: 250000,
    articleCount: 5,
    byProvider: { openai: 12.50 }
  }),
  isBudgetExceeded: async (): Promise<boolean> => false,
  close: async () => {}
};

// ─── Mock Content Safety Service ─────────────

export const mockContentSafety = {
  checkContent: async (_content: string, _keyword?: string): Promise<SafetyResult> => ({
    safe: true,
    flags: [],
    summary: 'No issues found',
    needsHumanReview: false
  })
};

// ─── Mock Quality Scorer ─────────────────────

export const mockQualityScorer = {
  scoreArticle: async (_content: string, _keyword: string) => ({
    overall: 78,
    readability: 72,
    seoOptimization: 80,
    eatScore: 75,
    uniqueness: 85,
    semanticRichness: 70,
    ctaQuality: 65,
    breakdown: {
      readability: 72,
      seoOptimization: 80,
      eat_score: 75,
      semantic_richness: 70,
      cta_quality: 65,
      uniqueness: 85
    },
    suggestions: ['Content quality is good across all dimensions']
  })
};

// ─── Mock Internal Links Service ─────────────

export const mockInternalLinks = {
  initialize: () => {},
  refreshArticleCache: async () => [],
  findLinkOpportunities: async () => [
    { text: 'maintenance', url: '/blogs/maintenance-tips', reason: 'Related topic' }
  ],
  injectLinks: (content: string, links: Array<{ text: string; url: string }>): string => {
    let result = content;
    for (const link of links) {
      const regex = new RegExp(`\\b${link.text}\\b`, 'i');
      result = result.replace(regex, (match) => `[${match}](${link.url})`);
    }
    return result;
  },
  close: async () => {}
};

// ─── Mock Keyword Service ────────────────────

export const mockKeywordService = {
  initialize: () => {},
  discoverKeywords: async (_clientId: string, _industry: string, seedKeywords: string[], count: number = 20) =>
    seedKeywords.slice(0, count).map(kw => ({
      id: `mock-kw-${Date.now()}`,
      keyword: kw,
      search_volume: 200,
      competition: 0.3,
      relevance_score: 75,
      source: 'mock',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    })),
  getBestKeywords: async () => [],
  markKeywordUsed: async () => {},
  close: async () => {}
};

// ─── Mock SEO Service ────────────────────────

export const mockSeoService = {
  analyzeContent: async (_content: string, _keyword: string) => ({
    score: 72,
    keywordDensity: 1.5,
    readabilityScore: 70,
    suggestions: ['Good structure', 'Consider adding more internal links'],
    headingStructure: { h1: true, h2: 4, h3: 3 }
  }),
  generateSlug: (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  validateContent: (_article: any) => ({ valid: true, errors: [] }),
  generateSocialPreview: (content: string, _maxLength: number = 120) => content.slice(0, 120)
};

// ══════════════════════════════════════════════
// Test Database Helper
// ══════════════════════════════════════════════

/**
 * Mock pool for testing route handlers.
 */
export function createMockPool() {
  const query = async (_text: string, _params?: any[]) => ({
    rows: [],
    rowCount: 0
  });

  return {
    query,
    connect: async () => ({
      query: async (_text?: string, _params?: any[]) => ({ rows: [], rowCount: 0 }),
      release: () => {}
    }),
    end: async () => {},
    on: () => {}
  };
}

/**
 * Create a mock request object for testing routes.
 */
export function createMockRequest(overrides: Record<string, any> = {}) {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    method: 'GET',
    originalUrl: '/test',
    ...overrides,
    user: overrides.user || {
      userId: 'test-user',
      email: 'test@example.com',
      role: 'admin',
      clientId: overrides.clientId || 'test-client'
    }
  } as any;
}

/**
 * Create a mock response object for testing routes.
 */
export function createMockResponse() {
  const res: Record<string, any> = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  res.send = (data: any) => {
    res.body = data;
    return res;
  };
  res.statusCode = 200;
  return res;
}
