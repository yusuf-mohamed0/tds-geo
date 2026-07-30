import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectorConfig, ContentPayload } from '../../sdk/connector-interface';

const mockGetRateLimitStatus = vi.fn();
const mockFetchArticles = vi.fn();
const mockFetchBlogs = vi.fn();
const mockPublishArticle = vi.fn();
const mockPublishArticleWithTracking = vi.fn();

vi.mock('../../services/shopify', () => ({
  default: {
    getRateLimitStatus: mockGetRateLimitStatus,
    fetchArticles: mockFetchArticles,
    fetchBlogs: mockFetchBlogs,
    publishArticle: mockPublishArticle,
    publishArticleWithTracking: mockPublishArticleWithTracking,
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
      await c.connect(validConfig);
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
    it('should return not-implemented error', async () => {
      const c = createConnector();
      const result = await c.update('123', { title: 'Updated' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not yet implemented');
    });
  });

  describe('delete', () => {
    it('should return false (stub)', async () => {
      const c = createConnector();
      const result = await c.delete('123');
      expect(result).toBe(false);
    });
  });

  describe('getContent', () => {
    it('should return null (stub)', async () => {
      const c = createConnector();
      const result = await c.getContent('123');
      expect(result).toBeNull();
    });
  });

  describe('getMedia', () => {
    it('should return null (stub)', async () => {
      const c = createConnector();
      const result = await c.getMedia('123');
      expect(result).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('should return empty array (stub)', async () => {
      const c = createConnector();
      const result = await c.getCategories();
      expect(result).toEqual([]);
    });
  });

  describe('getTags', () => {
    it('should return empty array (stub)', async () => {
      const c = createConnector();
      const result = await c.getTags();
      expect(result).toEqual([]);
    });
  });

  describe('disconnect', () => {
    it('should reset all state', async () => {
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
