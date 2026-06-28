import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockImagesGenerate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
    images: { generate: mockImagesGenerate },
  })),
}));

vi.mock('../../services/circuitBreaker', () => ({
  default: {
    getCircuitBreaker: vi.fn().mockReturnValue({
      call: vi.fn().mockImplementation(async (_name: string, fn: () => any) => fn()),
    }),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../prompts', () => ({
  writingSystemPrompt: vi
    .fn()
    .mockReturnValue('You are an SEO content writer.'),
}));

vi.mock('../../utils/stringUtils', () => ({
  countKeywordOccurrences: vi.fn().mockReturnValue(3),
}));

const mockCrawlCompetitors = vi.fn().mockResolvedValue([]);
vi.mock('../../services/contentResearch', () => ({
  crawlCompetitors: mockCrawlCompetitors,
}));

const mockDataForSeo = {
  isEnabled: vi.fn().mockReturnValue(false),
  getKeywordVolume: vi.fn(),
  discoverContentKeywords: vi.fn(),
  getKeywordIdeas: vi.fn(),
  getDomainOverview: vi.fn(),
  getCompetitors: vi.fn(),
  getBacklinkSummary: vi.fn(),
  getSerpResults: vi.fn(),
  getPageAudit: vi.fn(),
};
vi.mock('../../services/dataforseo', () => ({
  default: mockDataForSeo,
}));

import openaiService from '../../services/openai';

function makeMockResponse(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 200 },
  };
}

describe('OpenAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.OPENAI_BASE_URL = '';
    process.env.OPENAI_MODEL = 'gpt-4o';
    process.env.OPENAI_MAX_TOKENS = '4096';
    process.env.OPENAI_TEMPERATURE = '0.7';
    process.env.SERPAPI_API_KEY = '';
    delete process.env.HEADROOM_BASE_URL;
  });

  // ─── getClient ────────────────────────────

  describe('getClient', () => {
    it('should return null when no API key configured', () => {
      delete process.env.OPENAI_API_KEY;
      const svc = new (openaiService.constructor as any)();
      expect(svc.getClient()).toBeNull();
    });

    it('should return a client proxy when API key is set', () => {
      const client = openaiService.getClient();
      expect(client).not.toBeNull();
      expect(client!.chat.completions.create).toBeDefined();
    });

    it('should return the same client on repeated calls', () => {
      const client1 = openaiService.getClient();
      const client2 = openaiService.getClient();
      expect(client1).toBe(client2);
    });
  });

  // ─── generateBlogPost ─────────────────────

  describe('generateBlogPost', () => {
    const defaultParams = {
      keyword: 'plumbing repair',
      tone: 'educational',
      minWords: 500,
      maxWords: 1000,
    };

    it('should return mock content in mock mode', async () => {
      mockCreate.mockRejectedValue(new Error('should not be called'));
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const result = await svc.generateBlogPost(defaultParams);
      expect(result).toBeDefined();
      expect(result.title).toContain('plumbing');
      expect(result.content).toBeDefined();
    });

    it('should generate blog post successfully', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'Complete Guide to Plumbing Repair',
            metaTitle: 'Plumbing Repair Guide',
            metaDescription: 'Expert plumbing repair tips',
            tags: ['plumbing', 'repair', 'maintenance'],
            faqSection: '## FAQ\n\n### Q1?\nA1...',
            content: '# Plumbing Repair\n\nContent here...',
          }),
        ),
      );

      const result = await openaiService.generateBlogPost(defaultParams);
      expect(result.title).toBe('Complete Guide to Plumbing Repair');
      expect(result.metaTitle).toBe('Plumbing Repair Guide');
      expect(result.tags).toEqual(['plumbing', 'repair', 'maintenance']);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should call crawlCompetitors for competitor research', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'Plumbing Tips',
            content: 'Plumbing content here...',
            metaTitle: 'Plumbing Tips',
            metaDescription: 'desc',
            tags: ['plumbing'],
            faqSection: '',
          }),
        ),
      );

      await openaiService.generateBlogPost(defaultParams);
      expect(mockCrawlCompetitors).toHaveBeenCalledWith('plumbing repair');
    });

    it('should include DataForSEO data when enabled', async () => {
      mockDataForSeo.isEnabled.mockReturnValue(true);
      mockDataForSeo.getKeywordVolume.mockResolvedValue([
        {
          keyword: 'plumbing repair',
          searchVolume: 12000,
          cpc: 8.5,
          competition: 0.7,
          trend: [10000, 11000, 12000],
          monthlySearches: [{ year: 2025, month: 1, volume: 12000 }],
        },
      ]);
      mockDataForSeo.discoverContentKeywords.mockResolvedValue({
        primary: ['pipe repair', 'faucet fix'],
        longTail: ['how to fix leaking pipe under sink'],
        questions: ['how to fix a dripping faucet?'],
        related: ['plumber cost'],
      });

      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'Plumbing Repair Guide',
            content: 'Content with keyword targeting...',
            metaTitle: 'Plumbing Repair Guide',
            metaDescription: 'desc',
            tags: ['plumbing'],
            faqSection: '',
          }),
        ),
      );

      await openaiService.generateBlogPost(defaultParams);

      expect(mockDataForSeo.getKeywordVolume).toHaveBeenCalledWith([
        'plumbing repair',
      ]);
      expect(mockDataForSeo.discoverContentKeywords).toHaveBeenCalledWith(
        'plumbing repair',
      );
    });

    it('should handle DataForSEO failure gracefully', async () => {
      mockDataForSeo.isEnabled.mockReturnValue(true);
      mockDataForSeo.getKeywordVolume.mockRejectedValue(
        new Error('API error'),
      );
      mockDataForSeo.discoverContentKeywords.mockRejectedValue(
        new Error('API error'),
      );

      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'Plumbing Guide',
            content: 'Content...',
            metaTitle: 'Plumbing Guide',
            metaDescription: 'desc',
            tags: [],
            faqSection: '',
          }),
        ),
      );

      const result = await openaiService.generateBlogPost(defaultParams);
      expect(result.title).toBe('Plumbing Guide');
    });

    it('should include website intelligence in prompt when provided', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'Test Title',
            content: 'Test content...',
            metaTitle: 'Test Title',
            metaDescription: 'desc',
            tags: [],
            faqSection: '',
          }),
        ),
      );

      await openaiService.generateBlogPost({
        ...defaultParams,
        clientSettings: {
          websiteIntelligence: 'Client Intelligence: plumbing company',
          brandVoiceGuidance: 'Professional and friendly tone',
        },
      });

      const capturedCall = mockCreate.mock.calls[0][0];
      const userMessage = capturedCall.messages[1].content;
      expect(userMessage).toContain('Client Intelligence');
      expect(userMessage).toContain('brand voice');
    });

    it('should pass custom prompt template', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'Custom',
            content: 'Custom content...',
            metaTitle: 'Custom',
            metaDescription: 'desc',
            tags: [],
            faqSection: '',
          }),
        ),
      );

      await openaiService.generateBlogPost({
        ...defaultParams,
        promptTemplate: 'Custom system prompt',
      });

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should throw when OpenAI response has no title', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(JSON.stringify({ content: 'Missing title' })),
      );

      await expect(
        openaiService.generateBlogPost(defaultParams),
      ).rejects.toThrow('missing required fields');
    });

    it('should throw when OpenAI response has no content', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(JSON.stringify({ title: 'No Content' })),
      );

      await expect(
        openaiService.generateBlogPost(defaultParams),
      ).rejects.toThrow('missing required fields');
    });

    it('should handle non-JSON OpenAI response', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse('not-json-at-all'),
      );

      await expect(
        openaiService.generateBlogPost(defaultParams),
      ).rejects.toThrow();
    });

    it('should append faqSection to content when present', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'FAQ Test',
            content: 'Main content...',
            metaTitle: 'FAQ Test',
            metaDescription: 'desc',
            tags: [],
            faqSection: '## FAQ\n\n### Q?\nA...',
          }),
        ),
      );

      const result = await openaiService.generateBlogPost(defaultParams);
      expect(result.content).toContain('FAQ');
    });

    it('should pass graphify context in system prompt', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            title: 'Graphify Test',
            content: 'Content...',
            metaTitle: 'Graphify Test',
            metaDescription: 'desc',
            tags: [],
            faqSection: '',
          }),
        ),
      );

      await openaiService.generateBlogPost({
        ...defaultParams,
        clientSettings: { graphifyContext: 'entity1,entity2' },
      });

      const { writingSystemPrompt } = await import('../../prompts');
      expect(writingSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ GRAPHIFY_CONTEXT: 'entity1,entity2' }),
      );
    });

    it('should handle circuit breaker fallback', async () => {
      const mockCircuitBreaker = {
        call: vi.fn().mockImplementation(
          async (_name: string, _fn: any, fallback: any) => fallback(),
        ),
      };
      const breakerModule = await import('../../services/circuitBreaker');
      (breakerModule.default.getCircuitBreaker as any).mockReturnValue(
        mockCircuitBreaker,
      );

      await expect(
        openaiService.generateBlogPost(defaultParams),
      ).rejects.toThrow('circuit breaker open');
    });
  });

  // ─── analyzeSEO ───────────────────────────

  describe('analyzeSEO', () => {
    it('should return mock result in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const result = await svc.analyzeSEO('content', 'keyword');
      expect(result).toBeDefined();
      expect((result as any).score).toBeGreaterThanOrEqual(0);
    });

    it('should analyze content for SEO', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            score: 85,
            keywordDensity: 2.1,
            suggestions: ['Add more H2 headings'],
            headingStructure: ['H1: Title', 'H2: Section'],
            readabilityScore: 70,
          }),
        ),
      );

      const result = await openaiService.analyzeSEO(
        '# Test content',
        'test keyword',
      );
      expect(result.score).toBe(85);
      expect(result.suggestions).toContain('Add more H2 headings');
    });

    it('should handle circuit breaker return null', async () => {
      const mockCircuitBreaker = {
        call: vi
          .fn()
          .mockImplementation(async (_name: string, _fn: any, fallback: any) =>
            fallback(),
          ),
      };
      const breakerModule = await import('../../services/circuitBreaker');
      (breakerModule.default.getCircuitBreaker as any).mockReturnValue(
        mockCircuitBreaker,
      );

      const result = await openaiService.analyzeSEO('content', 'keyword');
      expect(result).toEqual({});
    });
  });

  // ─── generateKeywordVariations ────────────

  describe('generateKeywordVariations', () => {
    it('should return mock keywords in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const result = await svc.generateKeywordVariations('plumbing', 5);
      expect(result.length).toBe(5);
    });

    it('should generate keyword variations', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            keywords: [
              'plumbing repair near me',
              'emergency plumber cost',
            ],
          }),
        ),
      );

      const result = await openaiService.generateKeywordVariations(
        'plumbing',
        5,
      );
      expect(result.length).toBe(2);
      expect(result[0]).toContain('plumbing');
    });

    it('should handle response as direct array', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify(['plumbing cost', 'plumber tips']),
        ),
      );

      const result = await openaiService.generateKeywordVariations(
        'plumbing',
        5,
      );
      expect(result.length).toBe(2);
    });
  });

  // ─── generateTitle ────────────────────────

  describe('generateTitle', () => {
    it('should return mock title in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const title = await svc.generateTitle('plumbing');
      expect(title).toContain('plumbing');
    });

    it('should generate a title', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse('Complete Plumbing Repair Guide'),
      );

      const title = await openaiService.generateTitle('plumbing');
      expect(title).toBe('Complete Plumbing Repair Guide');
    });

    it('should strip surrounding quotes from title', async () => {
      mockCreate.mockResolvedValue(makeMockResponse('"Plumbing Tips"'));

      const title = await openaiService.generateTitle('plumbing');
      expect(title).toBe('Plumbing Tips');
    });

    it('should pass brand voice when provided', async () => {
      mockCreate.mockResolvedValue(makeMockResponse('Professional Title'));

      await openaiService.generateTitle('plumbing', 'friendly');
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('friendly');
    });
  });

  // ─── generateOutline ──────────────────────

  describe('generateOutline', () => {
    it('should return mock outline in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const outline = await svc.generateOutline('plumbing', 'Title');
      expect(outline.length).toBeGreaterThan(0);
    });

    it('should generate an outline', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            sections: ['Introduction', 'Common Issues', 'Solutions'],
          }),
        ),
      );

      const outline = await openaiService.generateOutline('plumbing', 'Title');
      expect(outline).toEqual(['Introduction', 'Common Issues', 'Solutions']);
    });

    it('should pass blacklist keywords', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(JSON.stringify(['Section 1'])),
      );

      await openaiService.generateOutline('plumbing', 'Title', [
        'DIY',
        'dangerous',
      ]);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('DIY');
    });
  });

  // ─── enhanceSEO ───────────────────────────

  describe('enhanceSEO', () => {
    it('should pass through in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const result = await svc.enhanceSEO('Original content', 'keyword');
      expect(result).toBe('Original content');
    });

    it('should enhance content', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse('Enhanced content with better SEO'),
      );

      const result = await openaiService.enhanceSEO(
        'Original content',
        'keyword',
      );
      expect(result).toContain('Enhanced');
    });
  });

  // ─── moderateContent ──────────────────────

  describe('moderateContent', () => {
    it('should return safe result in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const result = await svc.moderateContent('Safe content');
      expect(result.flagged).toBe(false);
    });

    it('should moderate content', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            flagged: false,
            categories: {},
            scores: {},
          }),
        ),
      );

      const result = await openaiService.moderateContent('Safe content');
      expect(result.flagged).toBe(false);
    });
  });

  // ─── generateFAQ ──────────────────────────

  describe('generateFAQ', () => {
    it('should return mock FAQ in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const faq = await svc.generateFAQ('plumbing', 'Content');
      expect(faq).toContain('FAQ');
    });

    it('should generate FAQ section', async () => {
      mockCreate.mockResolvedValue(
        makeMockResponse(
          JSON.stringify({
            faqSection: '## FAQ\n\n### Q?\nA...',
          }),
        ),
      );

      const faq = await svc.generateFAQ('plumbing', 'Content');
      expect(faq).toContain('FAQ');
    });
  });

  // ─── generateArticleImage ─────────────────

  describe('generateArticleImage', () => {
    it('should return mock image in mock mode', async () => {
      const svc = new (openaiService.constructor as any)();
      svc.isMockMode = true;
      const result = await svc.generateArticleImage('Title', 'keyword');
      expect(result.imageUrl).toContain('placeholder');
      expect(result.altText).toContain('keyword');
    });

    it('should generate image end-to-end', async () => {
      mockCreate
        .mockResolvedValueOnce(makeMockResponse('A professional plumbing image'))
        .mockResolvedValueOnce(makeMockResponse('Alt text for image'));
      mockImagesGenerate.mockResolvedValue({
        data: [{ url: 'https://example.com/image.png' }],
      });

      const result = await openaiService.generateArticleImage(
        'Plumbing Guide',
        'plumbing',
      );
      expect(result.imageUrl).toBe('https://example.com/image.png');
      expect(result.prompt).toContain('plumbing');
      expect(mockImagesGenerate).toHaveBeenCalled();
    });

    it('should throw when image generation returns no URL', async () => {
      mockCreate.mockResolvedValueOnce(makeMockResponse('prompt'));
      mockImagesGenerate.mockResolvedValue({ data: [{}] });

      await expect(
        openaiService.generateArticleImage('Title', 'keyword'),
      ).rejects.toThrow('no URL');
    });
  });

  // ─── Error Handling ───────────────────────

  describe('error handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        openaiService.generateBlogPost({ keyword: 'test' }),
      ).rejects.toThrow('Content generation failed');
    });

    it('should handle missing OPENAI_API_KEY', async () => {
      delete process.env.OPENAI_API_KEY;
      const svc = new (openaiService.constructor as any)();

      await expect(
        svc.generateBlogPost({ keyword: 'test' }),
      ).rejects.toThrow();
    });
  });
});
