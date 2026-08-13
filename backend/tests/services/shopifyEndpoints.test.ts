import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockBuildClient,
  mockGetQueue,
  mockRefreshIfExpired,
} = vi.hoisted(() => ({
  mockBuildClient: vi.fn(),
  mockGetQueue: vi.fn(),
  mockRefreshIfExpired: vi.fn(),
}));

vi.mock('../../services/shopify/client', () => ({
  buildClient: mockBuildClient,
  getQueue: mockGetQueue,
}));

vi.mock('../../services/shopify/auth', () => ({
  refreshIfExpired: mockRefreshIfExpired,
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logActivity: vi.fn(),
}));

import {
  fetchArticles,
  fetchBlogs,
  publishArticle,
} from '../../services/shopify/content';
import {
  getArticle,
  updateArticle,
  deleteArticle,
  getArticleImage,
} from '../../services/shopify/articles';
import {
  fetchProducts,
  updateProduct,
  getProduct,
  fetchCollections,
  fetchProductTags,
} from '../../services/shopify/products';

const shopConfig = {
  shop: 'test-shop.myshopify.com',
  accessToken: 'shpat_test_123',
  apiVersion: '2025-07',
};

function setupClient() {
  const client = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  const queue = {
    schedule: vi.fn(async (fn: () => Promise<unknown>) => fn()),
  };
  mockBuildClient.mockReturnValue({ client, shopName: 'test-shop.myshopify.com' });
  mockGetQueue.mockReturnValue(queue);
  mockRefreshIfExpired.mockImplementation(async (config: any) => config);
  return { client, queue };
}

describe('Shopify service endpoint calls (rate-limited client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getArticle hits GET /blogs/{blog_id}/articles/{id}.json', async () => {
    const { client, queue } = setupClient();
    client.get.mockResolvedValue({ data: { article: { id: 123, title: 'Hi' } }, headers: {} });

    const article = await getArticle(shopConfig, 42, 123);

    expect(client.get).toHaveBeenCalledWith('/blogs/42/articles/123.json');
    expect(article).toEqual({ id: 123, title: 'Hi' });
    expect(mockGetQueue).toHaveBeenCalledWith('test-shop.myshopify.com');
    expect(queue.schedule).toHaveBeenCalled();
  });

  it('updateArticle hits PUT /blogs/{blog_id}/articles/{id}.json without publishing fields', async () => {
    const { client } = setupClient();
    client.put.mockResolvedValue({
      data: { article: { id: 123, blog_id: 9, handle: 'hi' } },
      headers: {},
    });

    const result = await updateArticle(shopConfig, 42, 123, {
      title: 'New title',
      contentHtml: '<p>Body</p>',
      tags: ['a', 'b'],
      metaTitle: 'SEO',
      metaDescription: 'Desc',
    });

    expect(client.put).toHaveBeenCalledWith('/blogs/42/articles/123.json', {
      article: {
        title: 'New title',
        body_html: '<p>Body</p>',
        tags: 'a, b',
        metafields_global_title_tag: 'SEO',
        metafields_global_description_tag: 'Desc',
      },
    });

    // Draft contract: the update payload must never touch published state.
    const sentPayload = client.put.mock.calls[0][1].article;
    expect(sentPayload.published).toBeUndefined();
    expect(sentPayload.published_at).toBeUndefined();

    expect(result).toEqual({ id: 123, blog_id: 9, handle: 'hi' });
  });

  it('updateArticle rejects internal planning sections before calling Shopify', async () => {
    const { client } = setupClient();

    await expect(updateArticle(shopConfig, 42, 123, {
      title: 'Bad Article',
      contentHtml: '<h2>Meta Draft</h2><p>Internal SEO notes.</p><h2>FAQ Opportunities</h2>',
    })).rejects.toThrow('internal draft markers');

    expect(client.put).not.toHaveBeenCalled();
  });

  it('deleteArticle hits DELETE /blogs/{blog_id}/articles/{id}.json', async () => {
    const { client } = setupClient();
    client.delete.mockResolvedValue({ data: {}, headers: {} });

    await deleteArticle(shopConfig, 42, 123);

    expect(client.delete).toHaveBeenCalledWith('/blogs/42/articles/123.json');
  });

  it('getArticleImage hits GET /blogs/{blog_id}/articles/{id}.json and returns the article image', async () => {
    const { client } = setupClient();
    client.get.mockResolvedValue({
      data: { article: { image: { id: 7, src: 'https://cdn.example.com/a.png', alt: 'x' } } },
      headers: {},
    });

    const image = await getArticleImage(shopConfig, 42, 123);

    expect(client.get).toHaveBeenCalledWith('/blogs/42/articles/123.json');
    expect(image).toEqual({ id: 7, src: 'https://cdn.example.com/a.png', alt: 'x' });
  });

  it('fetchCollections hits smart + custom collection endpoints', async () => {
    const { client } = setupClient();
    client.get
      .mockResolvedValueOnce({ data: { smart_collections: [{ id: 1, title: 'Smart' }] }, headers: {} })
      .mockResolvedValueOnce({ data: { custom_collections: [{ id: 2, title: 'Custom' }] }, headers: {} });

    const collections = await fetchCollections(shopConfig);

    expect(client.get).toHaveBeenNthCalledWith(1, '/smart_collections.json', {
      params: { fields: expect.any(String), limit: 250 },
    });
    expect(client.get).toHaveBeenNthCalledWith(2, '/custom_collections.json', {
      params: { fields: expect.any(String), limit: 250 },
    });
    expect(collections).toEqual([
      { id: 1, title: 'Smart' },
      { id: 2, title: 'Custom' },
    ]);
  });

  it('fetchCollections paginates via Link headers on both endpoints and aggregates all pages', async () => {
    const { client } = setupClient();
    client.get
      .mockResolvedValueOnce({
        data: { smart_collections: [{ id: 1, title: 'Smart 1a' }, { id: 2, title: 'Smart 1b' }] },
        headers: {
          link: '<https://x/admin/api/2025-07/smart_collections.json?page_info=snext&limit=250>; rel="next"',
        },
      })
      .mockResolvedValueOnce({
        data: { custom_collections: [{ id: 3, title: 'Custom 1a' }] },
        headers: {
          link: '<https://x/admin/api/2025-07/custom_collections.json?page_info=cnext&limit=250>; rel="next"',
        },
      })
      .mockResolvedValueOnce({
        data: { smart_collections: [{ id: 4, title: 'Smart 2a' }] },
        headers: {},
      })
      .mockResolvedValueOnce({
        data: { custom_collections: [{ id: 5, title: 'Custom 2a' }] },
        headers: {},
      });

    const collections = await fetchCollections(shopConfig);

    expect(client.get).toHaveBeenNthCalledWith(1, '/smart_collections.json', {
      params: { fields: expect.any(String), limit: 250 },
    });
    expect(client.get).toHaveBeenNthCalledWith(2, '/custom_collections.json', {
      params: { fields: expect.any(String), limit: 250 },
    });
    expect(client.get).toHaveBeenNthCalledWith(3, '/smart_collections.json', {
      params: { fields: expect.any(String), limit: 250, page_info: 'snext' },
    });
    expect(client.get).toHaveBeenNthCalledWith(4, '/custom_collections.json', {
      params: { fields: expect.any(String), limit: 250, page_info: 'cnext' },
    });
    expect(collections).toEqual([
      { id: 1, title: 'Smart 1a' },
      { id: 2, title: 'Smart 1b' },
      { id: 4, title: 'Smart 2a' },
      { id: 3, title: 'Custom 1a' },
      { id: 5, title: 'Custom 2a' },
    ]);
  });

  it('fetchProductTags aggregates tags across paginated product pages', async () => {
    const { client } = setupClient();
    client.get
      .mockResolvedValueOnce({
        data: {
          products: [{ tags: 'Outdoor, Furniture' }, { tags: 'Outdoor, Playground' }],
        },
        headers: {
          link: '<https://x/admin/api/2025-07/products.json?page_info=abc&limit=250>; rel="next"',
        },
      })
      .mockResolvedValueOnce({
        data: { products: [{ tags: 'Playground' }] },
        headers: {},
      });

    const tags = await fetchProductTags(shopConfig);

    expect(client.get).toHaveBeenNthCalledWith(1, '/products.json', {
      params: { fields: 'tags', limit: 250 },
    });
    expect(client.get).toHaveBeenNthCalledWith(2, '/products.json', {
      params: { fields: 'tags', limit: 250, page_info: 'abc' },
    });
    expect(tags).toEqual([
      { tag: 'Outdoor', count: 2 },
      { tag: 'Furniture', count: 1 },
      { tag: 'Playground', count: 2 },
    ]);
  });

  it('existing content service calls still route through the rate-limited queue', async () => {
    const { client, queue } = setupClient();
    client.get.mockResolvedValue({ data: { articles: [{ id: 1 }] }, headers: {} });

    const articles = await fetchArticles(shopConfig);

    expect(client.get).toHaveBeenCalledWith('/articles.json', {
      params: { limit: 50, fields: 'id,title,handle,body_html,published_at,tags' },
    });
    expect(mockGetQueue).toHaveBeenCalledWith('test-shop.myshopify.com');
    expect(queue.schedule).toHaveBeenCalled();
    expect(articles).toEqual([{ id: 1 }]);
  });

  it('publishArticle creates drafts through the rate-limited queue', async () => {
    const { client, queue } = setupClient();
    client.post.mockResolvedValue({
      data: { article: { id: 55, handle: 'draft', blog_id: 111 } },
      headers: {},
    });
    client.get.mockResolvedValue({
      data: { blogs: [{ id: 111, handle: 'news' }] },
      headers: {},
    });

    const result = await publishArticle(shopConfig, 111, {
      title: 'Draft',
      contentHtml: '<p>Body</p>',
      published: false,
    });

    expect(client.post).toHaveBeenCalledWith('/blogs/111/articles.json', expect.anything());
    expect(client.get).toHaveBeenCalledWith('/blogs.json');
    expect(queue.schedule).toHaveBeenCalled();
    expect(result.id).toBe(55);
    expect(result.url).toBe('https://test-shop.myshopify.com/blogs/news/draft');
  });

  it('fetchBlogs routes through the rate-limited queue', async () => {
    const { client, queue } = setupClient();
    client.get.mockResolvedValue({ data: { blogs: [{ id: 111 }] }, headers: {} });

    const blogs = await fetchBlogs(shopConfig);

    expect(client.get).toHaveBeenCalledWith('/blogs.json');
    expect(queue.schedule).toHaveBeenCalled();
    expect(blogs).toEqual([{ id: 111 }]);
  });

  it('fetchProducts routes through the rate-limited queue', async () => {
    const { client, queue } = setupClient();
    client.get.mockResolvedValue({ data: { products: [{ id: 1 }] }, headers: {} });

    await fetchProducts(shopConfig);

    expect(client.get).toHaveBeenCalledWith('/products.json', {
      params: { limit: 50, fields: expect.any(String) },
    });
    expect(queue.schedule).toHaveBeenCalled();
  });

  it('getProduct routes through the rate-limited queue', async () => {
    const { client, queue } = setupClient();
    client.get.mockResolvedValue({ data: { product: { id: 2 } }, headers: {} });

    const product = await getProduct(shopConfig, 2);

    expect(client.get).toHaveBeenCalledWith('/products/2.json', { params: {} });
    expect(queue.schedule).toHaveBeenCalled();
    expect(product).toEqual({ id: 2 });
  });

  it('updateProduct routes through the rate-limited queue', async () => {
    const { client, queue } = setupClient();
    client.put.mockResolvedValue({ data: { product: { id: 2 } }, headers: {} });

    await updateProduct(shopConfig, 2, { title: 'Updated' });

    expect(client.put).toHaveBeenCalledWith('/products/2.json', { product: { title: 'Updated' } });
    expect(queue.schedule).toHaveBeenCalled();
  });
});
