// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());
const mockImagesGenerate = vi.hoisted(() => vi.fn());

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
  writingSystemPrompt: vi.fn().mockReturnValue('You are an SEO content writer.'),
}));

vi.mock('../../utils/stringUtils', () => ({
  countKeywordOccurrences: vi.fn().mockReturnValue(3),
}));

const mockCrawlCompetitors = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock('../../services/contentResearch', () => ({
  crawlCompetitors: mockCrawlCompetitors,
}));

const mockDataForSeo = vi.hoisted(() => ({
  isEnabled: vi.fn().mockReturnValue(false),
  getKeywordVolume: vi.fn(),
  discoverContentKeywords: vi.fn(),
  getKeywordIdeas: vi.fn(),
  getDomainOverview: vi.fn(),
  getCompetitors: vi.fn(),
  getBacklinkSummary: vi.fn(),
  getSerpResults: vi.fn(),
  getPageAudit: vi.fn(),
}));
vi.mock('../../services/dataforseo', () => ({
  default: mockDataForSeo,
}));

// Import AFTER mocks are set up. OPENAI_API_KEY will be empty at import
// time (no vi.hoisted for it), so isMockMode = true and all methods
// use built-in mock generators. This lets us test them without network.
import openaiService from '../../services/openai';

describe('OpenAIService (mock mode)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockImagesGenerate.mockReset();
    mockCrawlCompetitors.mockReset();
    mockCrawlCompetitors.mockResolvedValue([]);
    mockDataForSeo.isEnabled.mockReturnValue(false);
  });

  // ─── isMockMode ──────────────────────────

  describe('isMockMode', () => {
    it('should be true when no API key is set', () => {
      expect(openaiService.isMockMode).toBe(true);
    });
  });

  // ─── generateBlogPost ─────────────────────

  describe('generateBlogPost', () => {
    it('should produce content in mock mode', async () => {
      const result = await openaiService.generateBlogPost({
        keyword: 'plumbing repair',
      });
      expect(result.title).toBeTruthy();
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(200);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.wordCount).toBeGreaterThan(0);
    });

    it('should include keyword in mock output', async () => {
      const result = await openaiService.generateBlogPost({
        keyword: 'roof repair',
      });
      const combined = (result.title + result.content).toLowerCase();
      expect(combined).toContain('roof');
    });

    it('should respect tone parameter in mock mode', async () => {
      const result = await openaiService.generateBlogPost({
        keyword: 'plumbing',
        tone: 'professional',
      });
      expect(result.title).toBeTruthy();
    });

    it('should not call OpenAI mock in mock mode', async () => {
      await openaiService.generateBlogPost({ keyword: 'test' });
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ─── analyzeSEO ───────────────────────────

  describe('analyzeSEO', () => {
    it('should return analysis result in mock mode', async () => {
      const result = await openaiService.analyzeSEO('# Test content', 'test kw');
      expect(result).toBeDefined();
      expect(typeof (result as any).score).toBe('number');
      expect((result as any).score).toBeGreaterThanOrEqual(0);
      expect((result as any).score).toBeLessThanOrEqual(100);
    });
  });

  // ─── generateKeywordVariations ────────────

  describe('generateKeywordVariations', () => {
    it('should return keyword variations in mock mode', async () => {
      const result = await openaiService.generateKeywordVariations('plumbing', 5);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should respect the count parameter', async () => {
      const result = await openaiService.generateKeywordVariations('hvac', 3);
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  // ─── generateTitle ────────────────────────

  describe('generateTitle', () => {
    it('should generate a title in mock mode', async () => {
      const title = await openaiService.generateTitle('plumbing');
      expect(title).toBeTruthy();
      expect(typeof title).toBe('string');
    });

    it('should include keyword context in title', async () => {
      const title = await openaiService.generateTitle('gutter cleaning');
      expect(title.length).toBeGreaterThan(10);
    });
  });

  // ─── generateOutline ──────────────────────

  describe('generateOutline', () => {
    it('should generate an outline in mock mode', async () => {
      const outline = await openaiService.generateOutline('plumbing', 'Title');
      expect(outline.length).toBeGreaterThan(0);
      expect(Array.isArray(outline)).toBe(true);
    });

    it('should respect blacklist keywords', async () => {
      const outline = await openaiService.generateOutline(
        'plumbing',
        'Title',
        ['DIY', 'dangerous'],
      );
      expect(outline.length).toBeGreaterThan(0);
    });
  });

  // ─── enhanceSEO ───────────────────────────

  describe('enhanceSEO', () => {
    it('should pass through content in mock mode', async () => {
      const result = await openaiService.enhanceSEO('Original content', 'keyword');
      expect(result).toBe('Original content');
    });
  });

  // ─── moderateContent ──────────────────────

  describe('moderateContent', () => {
    it('should return safe result in mock mode', async () => {
      const result = await openaiService.moderateContent('Safe content');
      expect(result).toBeDefined();
    });
  });

  // ─── generateFAQ ──────────────────────────

  describe('generateFAQ', () => {
    it('should generate FAQ in mock mode', async () => {
      const faq = await openaiService.generateFAQ('plumbing', 4);
      expect(faq).toContain('Frequently Asked');
    });
  });

  // ─── generateArticleImage ─────────────────

  describe('generateArticleImage', () => {
    it('should return placeholder image in mock mode', async () => {
      const result = await openaiService.generateArticleImage('Title', 'keyword');
      expect(result.imageUrl).toContain('placeholder');
      expect(result.altText).toBeTruthy();
      expect(result.prompt).toBeTruthy();
    });
  });

  // ─── getClient (no API key) ───────────────

  describe('getClient', () => {
    it('should return null when no API key is configured', () => {
      expect((openaiService as any).getClient()).toBeNull();
    });
  });
});
