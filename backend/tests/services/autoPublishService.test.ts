// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockPublishArticle,
  mockPublishArticleLive,
  mockUploadImage,
  mockFetchBlogs,
  mockGetClientDefaultBlogId,
  mockPingIndexNow,
  mockGenerateArticleImage,
} = vi.hoisted(() => ({
  mockPublishArticle: vi.fn(),
  mockPublishArticleLive: vi.fn(),
  mockUploadImage: vi.fn(),
  mockFetchBlogs: vi.fn(),
  mockGetClientDefaultBlogId: vi.fn(),
  mockPingIndexNow: vi.fn(),
  mockGenerateArticleImage: vi.fn(),
}));

vi.mock('../../services/shopify', () => ({
  default: {
    publishArticle: mockPublishArticle,
    publishArticleLive: mockPublishArticleLive,
    uploadImage: mockUploadImage,
    fetchBlogs: mockFetchBlogs,
  },
}));

vi.mock('../../services/shopify/content', () => ({
  getClientDefaultBlogId: mockGetClientDefaultBlogId,
}));

vi.mock('../../services/indexNowService', () => ({
  default: { pingArticlePublished: mockPingIndexNow },
}));

vi.mock('../../services/openai', () => ({
  default: { generateArticleImage: mockGenerateArticleImage },
}));

vi.mock('../../services/schemaGenerator', () => ({
  default: {
    extractFaqPairsFromContent: vi.fn(() => []),
    generateAllSchemas: vi.fn(() => ({})),
    injectSchemaIntoHtml: vi.fn((html: string) => html),
  },
}));

vi.mock('../../services/contentLength', () => ({
  countArticleWords: vi.fn(() => 2000),
  getMinimumArticleWords: vi.fn(() => 500),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}));

import autoPublishService from '../../services/autoPublishService';

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    client_id: 'c1',
    client_name: 'Test Client',
    title: 'Test Article',
    content_md: 'Some markdown content',
    content_html: '<p>Some html content</p>',
    meta_description: 'A meta description',
    tags: ['seo'],
    status: 'approved',
    scheduled_at: new Date(Date.now() - 60_000),
    published_at: null,
    shopify_shop: 'test-shop.myshopify.com',
    shopify_token: 'shpat_test_token_12345',
    shopify_api_version: '2025-07',
    settings: '{}',
    ...overrides,
  };
}

function makePool(rowsBySql: Array<{ match: (sql: string) => boolean; rows: any[] }>) {
  const mockQuery = vi.fn((sql: string) => {
    const hit = rowsBySql.find(r => r.match(sql));
    return Promise.resolve({ rows: hit ? hit.rows : [] });
  });
  return { pool: { query: mockQuery }, mockQuery };
}

describe('autoPublishService — scheduled draft-flip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientDefaultBlogId.mockReturnValue(42);
    mockPublishArticleLive.mockResolvedValue({
      id: 777,
      url: 'https://test-shop.myshopify.com/blogs/news/test-article',
      handle: 'test-article',
    });
    mockPublishArticle.mockResolvedValue({
      id: 555,
      url: 'https://test-shop.myshopify.com/blogs/news/draft',
      handle: 'draft',
    });
    mockUploadImage.mockResolvedValue({ id: 888 });
    mockGenerateArticleImage.mockResolvedValue({
      imageUrl: 'https://img.test/1.png',
      altText: 'alt text',
      prompt: 'prompt',
    });
    mockPingIndexNow.mockResolvedValue(undefined);
  });

  it('(f) does not publish articles whose scheduled_at is in the future', async () => {
    const dueArticle = makeArticle({ id: 'a-due' });
    const futureArticle = makeArticle({
      id: 'a-future',
      title: 'Future Article',
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    const { pool } = makePool([
      // tick() SELECT — returns both due and future rows; the service must
      // skip the future one even if the query were wrong to return it.
      { match: sql => sql.includes('FROM articles a'), rows: [dueArticle, futureArticle] },
      // Existing hidden draft lookup for the due article.
      { match: sql => sql.includes('FROM publishing_history'), rows: [{ shopify_article_id: 777, shopify_blog_id: 123 }] },
    ]);

    autoPublishService.initialize(pool as any);
    await (autoPublishService as any).tick();

    // Only the due article is flipped live — the future one is never touched.
    expect(mockPublishArticleLive).toHaveBeenCalledTimes(1);
    expect(mockPublishArticleLive).toHaveBeenCalledWith(
      expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
      123,
      777
    );
    // Never creates a live article.
    expect(mockPublishArticle).not.toHaveBeenCalled();
  });

  it('flips an existing hidden draft to live instead of creating a new live article', async () => {
    const dueArticle = makeArticle();
    const { pool, mockQuery } = makePool([
      { match: sql => sql.includes('FROM articles a'), rows: [dueArticle] },
      { match: sql => sql.includes('FROM publishing_history'), rows: [{ shopify_article_id: 777, shopify_blog_id: 123 }] },
    ]);

    autoPublishService.initialize(pool as any);
    await (autoPublishService as any).tick();

    expect(mockPublishArticleLive).toHaveBeenCalledTimes(1);
    expect(mockPublishArticle).not.toHaveBeenCalled();

    // Tracking row is updated to published (no duplicate insert).
    const updateHistory = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE publishing_history'));
    expect(updateHistory).toBeTruthy();
    expect(updateHistory?.[0]).not.toContain('updated_at');

    const updateArticle = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE articles SET status'));
    expect(updateArticle).toBeTruthy();

    // IndexNow notification fired for the live URL.
    expect(mockPingIndexNow).toHaveBeenCalledWith(
      'https://test-shop.myshopify.com/blogs/news/test-article'
    );
  });

  it('creates a hidden draft (never live) then flips it when no draft exists yet', async () => {
    const dueArticle = makeArticle();
    const { pool } = makePool([
      { match: sql => sql.includes('FROM articles a'), rows: [dueArticle] },
      // No existing draft in publishing_history.
      { match: sql => sql.includes('FROM publishing_history'), rows: [] },
    ]);

    autoPublishService.initialize(pool as any);
    await (autoPublishService as any).tick();

    // Draft created first...
    expect(mockPublishArticle).toHaveBeenCalledTimes(1);
    const createdArticle = mockPublishArticle.mock.calls[0][2] as Record<string, unknown>;
    expect(createdArticle.title).toBe('Test Article');
    // ...then flipped live via PUT helper.
    expect(mockPublishArticleLive).toHaveBeenCalledTimes(1);
    expect(mockPublishArticleLive).toHaveBeenCalledWith(
      expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
      42, // resolved blog id from getClientDefaultBlogId
      555
    );
  });
});
