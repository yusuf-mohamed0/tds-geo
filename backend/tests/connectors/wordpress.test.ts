import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentPayload } from '../../sdk/connector-interface';

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../../connectors/wordpress/client', () => ({
  createWordPressClient: vi.fn(() => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  })),
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { WordPressConnector } from '../../connectors/wordpress';

const config = { provider: 'wordpress', endpointUrl: 'https://example.test', apiKey: 'test-key' };

describe('WordPressConnector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockPost.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
  });

  it('unwraps status and publish responses from the WordPress plugin', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: { status: 'ok', version: '2.0.0', active_keys: 1 } } });
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { post_id: 42, post_url: 'https://example.test/hello', status: 'draft' } } });

    const connector = new WordPressConnector();
    await expect(connector.connect(config)).resolves.toBe(true);

    const article: ContentPayload = { title: 'Hello', content: '<p>World</p>', status: 'draft' };
    await expect(connector.publish(article)).resolves.toEqual({
      success: true,
      externalId: '42',
      url: 'https://example.test/hello',
      provider: 'wordpress',
    });
  });

  it('unwraps plugin data for sync, content, categories and tags', async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (path === '/status') return { data: { success: true, data: { status: 'active', version: '2.0.0', active_keys: 1 } } };
      if (path === '/posts') return { data: { success: true, data: { posts: [{ id: 1 }, { id: 2 }] }, total: 2 } };
      if (path === '/posts/1') return { data: { success: true, data: { id: 1, title: 'Wrapped', content_html: '<p>Body</p>' } } };
      if (path === '/categories') return { data: { success: true, data: [{ id: 7, name: 'News', slug: 'news' }] } };
      if (path === '/tags') return { data: { success: true, data: { tags: [{ term_id: 8, name: 'AI', slug: 'ai' }] } } };
      return { data: {} };
    });

    const connector = new WordPressConnector();
    await connector.connect(config);

    await expect(connector.sync()).resolves.toMatchObject({ synced: 2, failed: 0 });
    await expect(connector.getContent('1')).resolves.toMatchObject({ id: '1', title: 'Wrapped', content: '<p>Body</p>' });
    await expect(connector.getCategories()).resolves.toEqual([{ id: 7, name: 'News', slug: 'news', parent: null, count: 0 }]);
    await expect(connector.getTags()).resolves.toEqual([{ id: 8, name: 'AI', slug: 'ai', parent: null, count: 0 }]);
  });
});
