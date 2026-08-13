// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { postMock, putMock, getMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  putMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('../../services/shopify/auth', () => ({
  refreshIfExpired: vi.fn(async (config: any) => config),
}));

vi.mock('../../services/shopify/client', () => ({
  buildClient: vi.fn(() => ({
    client: { post: postMock, put: putMock, get: getMock },
    shopName: 'test-shop.myshopify.com',
  })),
  getQueue: vi.fn(() => ({ schedule: async (fn: any) => fn() })),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
  logActivity: vi.fn(),
}));

import { publishArticle, publishArticleLive, publishArticleWithTracking } from '../../services/shopify/content';

const shopConfig = {
  shop: 'test-shop.myshopify.com',
  accessToken: 'shpat_test_token_12345',
  apiVersion: '2025-07',
};

const BLOG_ID = 42;

function mockCreatedArticle(id = 123, handle = 'test-article') {
  postMock.mockResolvedValue({ data: { article: { id, handle } } });
  putMock.mockResolvedValue({
    data: {
      article: {
        id,
        handle,
        published: true,
        published_at: '2026-01-01T00:00:00Z',
      },
    },
  });
  getMock.mockResolvedValue({ data: { blogs: [{ id: BLOG_ID, handle: 'news' }] } });
}

describe('shopify content — draft-first article contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatedArticle();
  });

  describe('publishArticle', () => {
    it('(a) creates a hidden draft with published:false and published_at:null', async () => {
      const result = await publishArticle(shopConfig, BLOG_ID, {
        title: 'Test Article',
        contentHtml: '<p>Body content</p>',
      });

      const payload = postMock.mock.calls[0][1] as any;
      expect(payload.article.published).toBe(false);
      expect(payload.article.published_at).toBeNull();

      // Creation is a single POST — no PUT, no live flip.
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith(`/blogs/${BLOG_ID}/articles.json`, expect.any(Object));
      expect(putMock).not.toHaveBeenCalled();

      expect(result.id).toBe(123);
      expect(result.url).toBe('https://test-shop.myshopify.com/blogs/news/test-article');
      expect(getMock).toHaveBeenCalledWith('/blogs.json');
    });

    it('(b) truncates a >70 char meta title to <=70 chars with an ellipsis', async () => {
      const longTitle = 'x'.repeat(80);
      await publishArticle(shopConfig, BLOG_ID, {
        title: 'Short Title',
        contentHtml: '<p>Body</p>',
        metaTitle: longTitle,
      });

      const payload = postMock.mock.calls[0][1] as any;
      const titleTag = payload.article.metafields_global_title_tag as string;
      expect(titleTag.length).toBeLessThanOrEqual(70);
      expect(titleTag.endsWith('\u2026')).toBe(true);
      expect(titleTag.length).toBe(70);
    });

    it('(b2) falls back to the article title for the title tag and truncates it too', async () => {
      const longTitle = 'y'.repeat(80);
      await publishArticle(shopConfig, BLOG_ID, {
        title: longTitle,
        contentHtml: '<p>Body</p>',
      });

      const payload = postMock.mock.calls[0][1] as any;
      const titleTag = payload.article.metafields_global_title_tag as string;
      expect(titleTag.length).toBeLessThanOrEqual(70);
      expect(titleTag.endsWith('\u2026')).toBe(true);
    });

    it('(c) truncates a >160 char meta description to <=160 chars', async () => {
      const longDescription = 'd'.repeat(200);
      await publishArticle(shopConfig, BLOG_ID, {
        title: 'Test Article',
        contentHtml: '<p>Body</p>',
        metaDescription: longDescription,
      });

      const payload = postMock.mock.calls[0][1] as any;
      const descTag = payload.article.metafields_global_description_tag as string;
      expect(descTag.length).toBeLessThanOrEqual(160);
      expect(descTag.endsWith('\u2026')).toBe(true);
    });

    it('(c2) auto-extracts and truncates the description from content when not provided', async () => {
      const longBody = '<p>' + 'descriptive text '.repeat(30) + '</p>';
      await publishArticle(shopConfig, BLOG_ID, {
        title: 'Test Article',
        contentHtml: longBody,
      });

      const payload = postMock.mock.calls[0][1] as any;
      const descTag = payload.article.metafields_global_description_tag as string;
      expect(descTag.length).toBeGreaterThan(0);
      expect(descTag.length).toBeLessThanOrEqual(160);
      expect(descTag).not.toContain('<');
    });

    it('(d) always attaches summary_html (~200 chars) even when not provided', async () => {
      const body = '<p>' + 'word '.repeat(100) + '</p>';
      await publishArticle(shopConfig, BLOG_ID, {
        title: 'Test Article',
        contentHtml: body,
      });

      const payload = postMock.mock.calls[0][1] as any;
      const summary = payload.article.summary_html as string;
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
      expect(summary.length).toBeLessThanOrEqual(200);
      expect(summary).not.toContain('<');
    });

    it('(d2) honors an explicitly provided summary_html', async () => {
      await publishArticle(shopConfig, BLOG_ID, {
        title: 'Test Article',
        contentHtml: '<p>Body</p>',
        summaryHtml: 'My custom summary',
      });

      const payload = postMock.mock.calls[0][1] as any;
      expect(payload.article.summary_html).toBe('My custom summary');
    });

    it('rejects internal planning sections before creating a Shopify draft', async () => {
      await expect(publishArticle(shopConfig, BLOG_ID, {
        title: 'Bad Article',
        contentHtml: '<h2>GEO/AEO Answer Capsule</h2><p>Internal draft notes.</p><h2>Publishing Checklist</h2>',
      })).rejects.toThrow('internal draft markers');

      expect(postMock).not.toHaveBeenCalled();
    });

    it('(e) live flip path: creates a draft first (published:false) then PUTs published:true', async () => {
      const result = await publishArticle(
        shopConfig,
        BLOG_ID,
        { title: 'Test Article', contentHtml: '<p>Body</p>' },
        { publish: true }
      );

      // The create call is ALWAYS a draft.
      const postPayload = postMock.mock.calls[0][1] as any;
      expect(postPayload.article.published).toBe(false);
      expect(postPayload.article.published_at).toBeNull();

      // Live publishing is a separate PUT flip on the created draft.
      expect(putMock).toHaveBeenCalledTimes(1);
      expect(putMock).toHaveBeenCalledWith(
        `/blogs/${BLOG_ID}/articles/123.json`,
        expect.objectContaining({ article: expect.objectContaining({ published: true }) })
      );
      expect(result.id).toBe(123);
    });

    it('(e2) legacy published:true still opts in to the live flip', async () => {
      await publishArticle(shopConfig, BLOG_ID, {
        title: 'Test Article',
        contentHtml: '<p>Body</p>',
        published: true,
      });

      const postPayload = postMock.mock.calls[0][1] as any;
      expect(postPayload.article.published).toBe(false);
      expect(putMock).toHaveBeenCalledTimes(1);
      const putPayload = putMock.mock.calls[0][1] as any;
      expect(putPayload.article.published).toBe(true);
    });

    it('(e3) never creates a live article — POST payload is always a draft', async () => {
      await publishArticle(
        shopConfig,
        BLOG_ID,
        { title: 'Test Article', contentHtml: '<p>Body</p>' },
        { publish: true }
      );

      const postPayload = postMock.mock.calls[0][1] as any;
      expect(postPayload.article.published).toBe(false);
      expect(postPayload.article.published_at).toBeNull();
    });
  });

  describe('publishArticleLive', () => {
    it('(e) flips an existing draft to live via PUT and never POSTs a new article', async () => {
      putMock.mockResolvedValue({
        data: { article: { id: 456, handle: 'existing-draft', published: true } },
      });

      const result = await publishArticleLive(shopConfig, BLOG_ID, 456);

      expect(postMock).not.toHaveBeenCalled();
      expect(putMock).toHaveBeenCalledTimes(1);
      expect(putMock).toHaveBeenCalledWith(`/blogs/${BLOG_ID}/articles/456.json`, expect.any(Object));
      const putPayload = putMock.mock.calls[0][1] as any;
      expect(putPayload.article.published).toBe(true);
      expect(putPayload.article.published_at).toBeTruthy();
      expect(result.id).toBe(456);
      expect(result.url).toBe('https://test-shop.myshopify.com/blogs/news/existing-draft');
    });
  });

  describe('publishArticleWithTracking', () => {
    it('records a pending (draft) history row without published_at by default', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const pool = { query: mockQuery };

      const result = await publishArticleWithTracking(
        pool,
        { id: 'c1', shopify_shop: 'test-shop.myshopify.com', shopify_token: 'tok', shopify_api_version: '2025-07' },
        BLOG_ID,
        'a1',
        { title: 'Test Article', contentHtml: '<p>Body</p>' }
      );

      expect(result.id).toBe(123);
      expect(result.url).toBe('https://test-shop.myshopify.com/blogs/news/test-article');
      const insertCall = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO publishing_history'));
      expect(insertCall).toBeTruthy();
      // [article_id, client_id, shopify_article_id, shopify_blog_id, published_url, status, published_at]
      expect(insertCall[1][4]).toBe('https://test-shop.myshopify.com/blogs/news/test-article');
      expect(insertCall[1][5]).toBe('pending');
      expect(insertCall[1][6]).toBeNull();

      // Draft creation must NOT mark the article published.
      const updateCall = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE articles'));
      expect(updateCall).toBeFalsy();
    });

    it('marks the history row published and flips the article live when publish:true', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const pool = { query: mockQuery };

      await publishArticleWithTracking(
        pool,
        { id: 'c1', shopify_shop: 'test-shop.myshopify.com', shopify_token: 'tok', shopify_api_version: '2025-07' },
        BLOG_ID,
        'a1',
        { title: 'Test Article', contentHtml: '<p>Body</p>' },
        { publish: true }
      );

      // Draft was created (POST) and then flipped live (PUT).
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(putMock).toHaveBeenCalledTimes(1);

      const insertCall = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO publishing_history'));
      expect(insertCall[1][5]).toBe('published');
      expect(insertCall[1][6]).toBeTruthy();

      const updateCall = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE articles'));
      expect(updateCall).toBeTruthy();
    });

    it('legacy article.published:true flows through tracking: history published + articles.status updated', async () => {
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      const pool = { query: mockQuery };

      await publishArticleWithTracking(
        pool,
        { id: 'c1', shopify_shop: 'test-shop.myshopify.com', shopify_token: 'tok', shopify_api_version: '2025-07' },
        BLOG_ID,
        'a1',
        { title: 'Test Article', contentHtml: '<p>Body</p>', published: true }
      );

      // Same live intent as options.publish:true — draft POST then live PUT flip.
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(putMock).toHaveBeenCalledTimes(1);

      const insertCall = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('INSERT INTO publishing_history'));
      expect(insertCall).toBeTruthy();
      expect(insertCall[1][5]).toBe('published');
      expect(insertCall[1][6]).toBeTruthy();

      const updateCall = mockQuery.mock.calls.find(([sql]: [string]) => sql.includes('UPDATE articles'));
      expect(updateCall).toBeTruthy();
      expect(String(updateCall[0])).toContain("status = 'published'");
    });
  });
});
