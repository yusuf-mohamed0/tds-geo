import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectorConfig, ContentPayload } from '../../sdk/connector-interface';

const {
  mockGetRateLimitStatus,
  mockFetchArticles,
  mockFetchBlogs,
  mockPublishArticle,
  mockPublishArticleWithTracking,
  mockGetArticle,
  mockUpdateArticle,
  mockDeleteArticle,
  mockGetArticleImage,
  mockFetchCollections,
  mockFetchProductTags,
} = vi.hoisted(() => ({
  mockGetRateLimitStatus: vi.fn(),
  mockFetchArticles: vi.fn(),
  mockFetchBlogs: vi.fn(),
  mockPublishArticle: vi.fn(),
  mockPublishArticleWithTracking: vi.fn(),
  mockGetArticle: vi.fn(),
  mockUpdateArticle: vi.fn(),
  mockDeleteArticle: vi.fn(),
  mockGetArticleImage: vi.fn(),
  mockFetchCollections: vi.fn(),
  mockFetchProductTags: vi.fn(),
}));

vi.mock('../../services/shopify', () => ({
  default: {
    getRateLimitStatus: mockGetRateLimitStatus,
    fetchArticles: mockFetchArticles,
    fetchBlogs: mockFetchBlogs,
    publishArticle: mockPublishArticle,
    publishArticleWithTracking: mockPublishArticleWithTracking,
    getArticle: mockGetArticle,
    updateArticle: mockUpdateArticle,
    deleteArticle: mockDeleteArticle,
    getArticleImage: mockGetArticleImage,
    fetchCollections: mockFetchCollections,
    fetchProductTags: mockFetchProductTags,
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ShopifyConnector } from '../../connectors/shopify/index';

const validConfig: ConnectorConfig = {
  provider: 'shopify',
  endpointUrl: 'https://test-shop.myshopify.com/admin',
  apiKey: 'shpat_test_token_12345',
  defaultBlogId: 111,
  defaultBlogHandle: 'news',
};

const sampleArticle: ContentPayload = {
  title: 'Test Article',
  content: '<p>Test content</p>',
  metaTitle: 'Test Article Title',
  metaDescription: 'Test description',
  tags: ['test', 'article'],
  status: 'draft',
};

function createConnector() {
  const c = new ShopifyConnector();
  c.setPool({ query: vi.fn() });
  return c;
}

describe('ShopifyConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct provider metadata', () => {
      const c = new ShopifyConnector();
      expect(c.provider).toBe('shopify');
      expect(c.name).toBe('Shopify Online Store 2.0');
      expect(c.version).toBe('1.0.0');
    });
  });

  describe('setPool', () => {
    it('should store the pool reference', () => {
      const c = new ShopifyConnector();
      const pool = { query: vi.fn() };
      c.setPool(pool);
      expect((c as any).pool).toBe(pool);
    });
  });

  describe('connect', () => {
    it('should connect successfully when health returns healthy', async () => {
      mockGetRateLimitStatus.mockResolvedValue({ calls: '5/40', remaining: 35 });
      const c = createConnector();
      const result = await c.connect(validConfig);
      expect(result).toBe(true);
      expect((c as any).connected).toBe(true);
      expect((c as any).config).toEqual(validConfig);
    });

    it('should return false when shop is missing', async () => {
      const c = createConnector();
      const result = await c.connect({ provider: 'shopify', apiKey: 'token' });
      expect(result).toBe(false);
      expect((c as any).connected).toBe(false);
    });

    it('should return false when token is missing', async () => {
      const c = createConnector();
      const result = await c.connect({
        provider: 'shopify',
        endpointUrl: 'https://test-shop.myshopify.com/admin',
      });
      expect(result).toBe(false);
      expect((c as any).connected).toBe(false);
    });

    it('should return false when health check throws', async () => {
      mockGetRateLimitStatus.mockRejectedValue(new Error('API unreachable'));
      const c = createConnector();
      const result = await c.connect(validConfig);
      expect(result).toBe(false);
      expect((c as any).connected).toBe(false);
    });

    it('should return false when health status is degraded', async () => {
      mockGetRateLimitStatus.mockResolvedValue({ calls: '40/40', remaining: 0 });
      const c = createConnector();
      const result = await c.connect(validConfig);
      expect(result).toBe(false);
      expect((c as any).connected).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('should return the apiKey from config', async () => {
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.authenticate();
      expect(result).toBe('shpat_test_token_12345');
    });

    it('should return empty string when no config', async () => {
      const c = new ShopifyConnector();
      const result = await c.authenticate();
      expect(result).toBe('');
    });
  });

  describe('health', () => {
    it('should return healthy when rate limit has remaining calls', async () => {
      mockGetRateLimitStatus.mockResolvedValue({ calls: '5/40', remaining: 35 });
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.health();
      expect(result.status).toBe('healthy');
      expect(result.errors).toEqual([]);
      expect(result.version).toBe('1.0.0');
    });

    it('should return degraded when rate limit is exhausted', async () => {
      mockGetRateLimitStatus.mockResolvedValue({ calls: '40/40', remaining: 0 });
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.health();
      expect(result.status).toBe('degraded');
      expect(result.errors).toContain('API rate limit low');
    });

    it('should return down when service throws', async () => {
      mockGetRateLimitStatus.mockRejectedValue(new Error('Connection refused'));
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.health();
      expect(result.status).toBe('down');
      expect(result.errors).toContain('Connection refused');
    });
  });

  describe('sync', () => {
    it('should return sync result with article count', async () => {
      mockFetchArticles.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.sync();
      expect(result.synced).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should handle sync errors', async () => {
      mockFetchArticles.mockRejectedValue(new Error('Sync failed'));
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.sync();
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Sync failed');
    });
  });

  describe('publish', () => {
    it('should publish article successfully', async () => {
      mockFetchBlogs.mockResolvedValue([{ id: 111, title: 'Blog' }]);
      mockPublishArticle.mockResolvedValue({
        id: 999,
        url: 'https://test-shop.myshopify.com/blogs/111/test-article',
      });
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.publish(sampleArticle);
      expect(result.success).toBe(true);
      expect(result.externalId).toBe('999');
      expect(result.url).toContain('test-shop');
    });

    it('should return error when no blogs found', async () => {
      mockFetchBlogs.mockResolvedValue([]);
      const c = createConnector();
      await c.connect({ ...validConfig, defaultBlogId: undefined, defaultBlogHandle: undefined });
      const result = await c.publish(sampleArticle);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No blog found');
    });

    it('should handle publish errors', async () => {
      mockFetchBlogs.mockResolvedValue([{ id: 111, title: 'Blog' }]);
      mockPublishArticle.mockRejectedValue(new Error('Publish failed'));
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.publish(sampleArticle);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Publish failed');
    });
  });

  describe('update', () => {
    it('should update an article via the service and return success', async () => {
      mockUpdateArticle.mockResolvedValue({
        id: 999,
        blog_id: 111,
        handle: 'updated-article',
      });
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.update('999', {
        title: 'Updated Title',
        content: '<p>New body</p>',
        tags: ['a', 'b'],
        status: 'published', // connector never publishes — status is ignored
      });

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('999');
      expect(result.url).toBe('https://test-shop.myshopify.com/blogs/news/updated-article');
      expect(mockUpdateArticle).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
        111,
        999,
        expect.objectContaining({
          title: 'Updated Title',
          contentHtml: '<p>New body</p>',
          tags: ['a', 'b'],
        })
      );
    });

    it('should return failure when the service throws', async () => {
      mockUpdateArticle.mockRejectedValue(new Error('Update failed'));
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.update('999', { title: 'X' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
      expect(result.provider).toBe('shopify');
    });

    it('resolves the article blog by scanning nested blog article lists when no default blog id is configured', async () => {
      mockFetchBlogs.mockResolvedValue([{ id: 111, handle: 'news' }, { id: 222, handle: 'updates' }]);
      mockFetchArticles
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ id: 999, blog_id: 222 }]);
      mockUpdateArticle.mockResolvedValue({ id: 999, blog_id: 222, handle: 'updated-article' });
      const c = createConnector();
      await c.connect({ ...validConfig, defaultBlogId: undefined, defaultBlogHandle: undefined });

      const result = await c.update('999', { title: 'Updated Title' });

      expect(result.success).toBe(true);
      expect(mockFetchArticles).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
        111,
        { limit: 250, fields: 'id,blog_id' }
      );
      expect(mockFetchArticles).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
        222,
        { limit: 250, fields: 'id,blog_id' }
      );
      expect(mockUpdateArticle).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
        222,
        999,
        expect.objectContaining({ title: 'Updated Title' })
      );
      expect(result.url).toBe('https://test-shop.myshopify.com/blogs/updates/updated-article');
    });
  });

  describe('delete', () => {
    it('should return true when the article is deleted', async () => {
      mockDeleteArticle.mockResolvedValue(undefined);
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.delete('123');
      expect(result).toBe(true);
      expect(mockDeleteArticle).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
        111,
        123
      );
    });

    it('should return false when the service throws', async () => {
      mockDeleteArticle.mockRejectedValue(new Error('Delete failed'));
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.delete('123');
      expect(result).toBe(false);
    });
  });

  describe('getContent', () => {
    it('should map a fetched article to a ContentPayload', async () => {
      mockGetArticle.mockResolvedValue({
        id: 42,
        title: 'Hello',
        body_html: '<p>Body</p>',
        summary_html: 'Summary',
        handle: 'hello',
        tags: 'one, two',
        published_at: null,
        published: false,
        author: 'AI Agent',
        metafields_global_title_tag: 'SEO Title',
        metafields_global_description_tag: 'SEO Desc',
        image: { src: 'https://cdn.example.com/img.png' },
      });
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.getContent('42');
      expect(result).toEqual({
        id: '42',
        title: 'Hello',
        content: '<p>Body</p>',
        excerpt: 'Summary',
        slug: 'hello',
        status: 'draft',
        categories: [],
        tags: ['one', 'two'],
        metaTitle: 'SEO Title',
        metaDescription: 'SEO Desc',
        imageUrl: 'https://cdn.example.com/img.png',
        author: 'AI Agent',
        publishedAt: null,
      });
      expect(mockGetArticle).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
        111,
        42
      );
    });

    it('should return null when the service throws or returns nothing', async () => {
      mockGetArticle.mockRejectedValue(new Error('Not found'));
      const c = createConnector();
      await c.connect(validConfig);
      expect(await c.getContent('999')).toBeNull();

      mockGetArticle.mockResolvedValue(null);
      expect(await c.getContent('1000')).toBeNull();
    });
  });

  describe('getMedia', () => {
    it('should map an article image to a MediaPayload', async () => {
      mockGetArticleImage.mockResolvedValue({
        id: 7,
        src: 'https://cdn.example.com/img/photo.png',
        filename: 'photo.png',
        alt: 'A photo',
      });
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.getMedia('42');
      expect(result).toEqual({
        id: '7',
        url: 'https://cdn.example.com/img/photo.png',
        filename: 'photo.png',
        mimeType: 'image/png',
        alt: 'A photo',
      });
      expect(mockGetArticleImage).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'test-shop.myshopify.com' }),
        111,
        42
      );
    });

    it('should return null when there is no image or the service throws', async () => {
      mockGetArticleImage.mockResolvedValue(null);
      const c = createConnector();
      await c.connect(validConfig);
      expect(await c.getMedia('42')).toBeNull();

      mockGetArticleImage.mockRejectedValue(new Error('boom'));
      expect(await c.getMedia('43')).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('should map smart/custom collections to Taxonomy items', async () => {
      mockFetchCollections.mockResolvedValue([
        { id: 1, title: 'Home', handle: 'home', products_count: 3 },
        { id: 2, title: 'Outdoor', handle: 'outdoor' },
      ]);
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.getCategories();
      expect(result).toEqual([
        { id: 1, name: 'Home', slug: 'home', count: 3 },
        { id: 2, name: 'Outdoor', slug: 'outdoor', count: undefined },
      ]);
    });

    it('should return an empty array when the service throws', async () => {
      mockFetchCollections.mockRejectedValue(new Error('boom'));
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.getCategories();
      expect(result).toEqual([]);
    });
  });

  describe('getTags', () => {
    it('should aggregate product tags into Taxonomy items', async () => {
      mockFetchProductTags.mockResolvedValue([
        { tag: 'Outdoor Furniture', count: 4 },
        { tag: 'Playground', count: 2 },
      ]);
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.getTags();
      expect(result).toEqual([
        { id: 'Outdoor Furniture', name: 'Outdoor Furniture', slug: 'outdoor-furniture', count: 4 },
        { id: 'Playground', name: 'Playground', slug: 'playground', count: 2 },
      ]);
    });

    it('should return an empty array when the service throws', async () => {
      mockFetchProductTags.mockRejectedValue(new Error('boom'));
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.getTags();
      expect(result).toEqual([]);
    });
  });

  describe('disconnect', () => {
    it('should reset all state', async () => {
      mockGetRateLimitStatus.mockResolvedValue({ calls: '5/40', remaining: 35 });
      const c = createConnector();
      await c.connect(validConfig);
      expect((c as any).connected).toBe(true);

      await c.disconnect();
      expect((c as any).connected).toBe(false);
      expect((c as any).config).toBeNull();
      expect((c as any).shopConfig).toBeNull();
    });
  });

  describe('publishWithTracking', () => {
    it('should delegate to shopifyService', async () => {
      mockPublishArticleWithTracking.mockResolvedValue({ id: 999 });
      const c = createConnector();
      const client = { id: 'client-1' };
      const article = { title: 'Test', contentHtml: '<p>Test</p>' };

      const result = await c.publishWithTracking(client, 111, 'article-1', article);
      expect(mockPublishArticleWithTracking).toHaveBeenCalledWith(
        (c as any).pool, client, 111, 'article-1', article
      );
      expect(result).toEqual({ id: 999 });
    });

    it('should throw when pool is not set', async () => {
      const c = new ShopifyConnector();
      await expect(c.publishWithTracking({}, 111, 'a1', { title: 'T', contentHtml: '<p>T</p>' }))
        .rejects.toThrow('pool not set');
    });
  });

  describe('fetchBlogs', () => {
    it('should delegate to shopifyService', async () => {
      mockFetchBlogs.mockResolvedValue([{ id: 1, title: 'Blog' }]);
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.fetchBlogs();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Blog');
    });
  });

  describe('fetchArticles', () => {
    it('should delegate to shopifyService', async () => {
      mockFetchArticles.mockResolvedValue([{ id: 1, title: 'Article' }]);
      const c = createConnector();
      await c.connect(validConfig);
      const result = await c.fetchArticles();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Article');
    });
  });

  describe('getShopConfig (private)', () => {
    it('should derive config from endpointUrl', () => {
      const c = createConnector();
      (c as any).config = validConfig;
      (c as any).shopConfig = null;
      const result = (c as any).getShopConfig();
      expect(result.shop).toBe('test-shop.myshopify.com');
      expect(result.accessToken).toBe('shpat_test_token_12345');
      expect(result.apiVersion).toBe('2025-07');
    });

    it('should use stored shopConfig when available', () => {
      const c = createConnector();
      (c as any).config = validConfig;
      (c as any).shopConfig = {
        shop: 'cached-shop.myshopify.com',
        accessToken: 'cached-token',
        apiVersion: '2025-07',
      };
      const result = (c as any).getShopConfig();
      expect(result.shop).toBe('cached-shop.myshopify.com');
      expect(result.accessToken).toBe('cached-token');
    });
  });
});
