// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { ConnectorInterface, ConnectorConfig, HealthStatus, SyncResult, ContentPayload, MediaPayload, PublishResult, Taxonomy } from '../../sdk/connector-interface';
import { logger } from '../../utils/logger';
import shopifyService from '../../services/shopify';

export class ShopifyConnector implements ConnectorInterface {
  readonly provider = 'shopify';
  readonly name = 'Shopify Online Store 2.0';
  readonly version = '1.0.0';

  private config: ConnectorConfig | null = null;
  private shopConfig: { shop: string; accessToken: string; apiVersion: string } | null = null;
  private pool: any = null;
  private connected = false;

  setPool(pool: any): void {
    this.pool = pool;
  }

  async connect(config: ConnectorConfig): Promise<boolean> {
    this.config = config;
    this.shopConfig = {
      shop: config.endpointUrl?.replace('https://', '').replace('/admin', '') || '',
      accessToken: config.apiKey || '',
      apiVersion: '2025-07',
    };

    if (!this.shopConfig.shop || !this.shopConfig.accessToken) {
      logger.error('ShopifyConnector: missing shop or token');
      return false;
    }

    try {
      const status = await this.health();
      this.connected = status.status === 'healthy';
      return this.connected;
    } catch (err) {
      logger.error('ShopifyConnector: connect failed', { error: (err as Error).message });
      this.connected = false;
      return false;
    }
  }

  async authenticate(): Promise<string> {
    return this.config?.apiKey || '';
  }

  async health(): Promise<HealthStatus> {
    try {
      const status = await shopifyService.getRateLimitStatus(this.getShopConfig());
      const healthy = status.remaining !== null && status.remaining > 0;
      return {
        status: healthy ? 'healthy' : 'degraded',
        version: this.version,
        lastSync: null,
        uptime: 0,
        errors: healthy ? [] : ['API rate limit low'],
      };
    } catch (err) {
      return {
        status: 'down',
        version: this.version,
        lastSync: null,
        uptime: 0,
        errors: [(err as Error).message],
      };
    }
  }

  async sync(): Promise<SyncResult> {
    const config = this.getShopConfig();
    try {
      const articles = await shopifyService.fetchArticles(config);
      return {
        synced: articles.length,
        updated: 0,
        deleted: 0,
        failed: 0,
        errors: [],
      };
    } catch (err) {
      return {
        synced: 0, updated: 0, deleted: 0, failed: 1,
        errors: [(err as Error).message],
      };
    }
  }

  async publish(article: ContentPayload): Promise<PublishResult> {
    const config = this.getShopConfig();
    try {
      const blogs = await shopifyService.fetchBlogs(config);
      const blogId = this.config?.defaultBlogId || blogs[0]?.id;
      if (!blogId) {
        return { success: false, error: 'No blog found', provider: 'shopify' };
      }

      const result = await shopifyService.publishArticle(config, blogId, {
        title: article.title,
        contentHtml: article.content,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        tags: article.tags || [],
        published: article.status === 'published',
      });

      return {
        success: true,
        externalId: String(result.id),
        url: result.url,
        provider: 'shopify',
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
        provider: 'shopify',
      };
    }
  }

  async update(id: string, article: Partial<ContentPayload>): Promise<PublishResult> {
    const config = this.getShopConfig();
    try {
      const blogId = await this.resolveBlogIdForArticle(Number(id));
      const updated = await shopifyService.updateArticle(config, blogId, Number(id), {
        title: article.title,
        contentHtml: article.content,
        summaryHtml: article.excerpt,
        tags: article.tags,
        author: article.author,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
      });
      const blogHandle = await this.resolveBlogHandle(updated.blog_id || blogId);

      return {
        success: true,
        externalId: String(updated.id),
        url: updated.handle
          ? `https://${config.shop}/blogs/${blogHandle}/${updated.handle}`
          : undefined,
        provider: 'shopify',
      };
    } catch (err) {
      logger.error('ShopifyConnector: update failed', { id, error: (err as Error).message });
      return { success: false, error: (err as Error).message, provider: 'shopify' };
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const blogId = await this.resolveBlogIdForArticle(Number(id));
      await shopifyService.deleteArticle(this.getShopConfig(), blogId, Number(id));
      return true;
    } catch (err) {
      logger.error('ShopifyConnector: delete failed', { id, error: (err as Error).message });
      return false;
    }
  }

  async getContent(id: string): Promise<ContentPayload | null> {
    try {
      const blogId = await this.resolveBlogIdForArticle(Number(id));
      const article = await shopifyService.getArticle(this.getShopConfig(), blogId, Number(id));
      if (!article) return null;

      return {
        id: String(article.id),
        title: article.title || '',
        content: article.body_html || '',
        excerpt: article.summary_html || '',
        slug: article.handle || '',
        status: article.published ? 'published' : 'draft',
        categories: [],
        tags: String(article.tags || '')
          .split(',')
          .map((tag: string) => tag.trim())
          .filter(Boolean),
        metaTitle: article.metafields_global_title_tag || '',
        metaDescription: article.metafields_global_description_tag || '',
        imageUrl: article.image?.src || null,
        author: article.author || '',
        publishedAt: article.published_at || null,
      };
    } catch (err) {
      logger.error('ShopifyConnector: getContent failed', { id, error: (err as Error).message });
      return null;
    }
  }

  async getMedia(id: string): Promise<MediaPayload | null> {
    try {
      const blogId = await this.resolveBlogIdForArticle(Number(id));
      const image = await shopifyService.getArticleImage(this.getShopConfig(), blogId, Number(id));
      if (!image) return null;

      const filename = image.filename || String(image.src || '').split('/').pop() || '';

      return {
        id: String(image.id),
        url: image.src || '',
        filename,
        mimeType: this.guessMimeType(filename),
        alt: image.alt || '',
      };
    } catch (err) {
      logger.error('ShopifyConnector: getMedia failed', { id, error: (err as Error).message });
      return null;
    }
  }

  async getCategories(): Promise<Taxonomy[]> {
    try {
      const collections = await shopifyService.fetchCollections(this.getShopConfig());
      return collections.map((collection: any) => ({
        id: collection.id,
        name: collection.title || '',
        slug: collection.handle || '',
        count: typeof collection.products_count === 'number' ? collection.products_count : undefined,
      }));
    } catch (err) {
      logger.error('ShopifyConnector: getCategories failed', { error: (err as Error).message });
      return [];
    }
  }

  async getTags(): Promise<Taxonomy[]> {
    try {
      const tags = await shopifyService.fetchProductTags(this.getShopConfig());
      return tags.map((tag) => ({
        id: tag.tag,
        name: tag.tag,
        slug: this.slugify(tag.tag),
        count: tag.count,
      }));
    } catch (err) {
      logger.error('ShopifyConnector: getTags failed', { error: (err as Error).message });
      return [];
    }
  }

  private guessMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      avif: 'image/avif',
    };
    return map[ext] || 'application/octet-stream';
  }

  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  private getDefaultBlogId(): number | string | null {
    const blogId = this.config?.defaultBlogId;
    return blogId !== undefined && blogId !== null && blogId !== '' ? blogId : null;
  }

  private async resolveBlogIdForArticle(articleId: number): Promise<number | string> {
    const defaultBlogId = this.getDefaultBlogId();
    if (defaultBlogId) return defaultBlogId;

    const config = this.getShopConfig();
    const blogs = await shopifyService.fetchBlogs(config);
    for (const blog of blogs) {
      const articles = await shopifyService.fetchArticles(config, blog.id, { limit: 250, fields: 'id,blog_id' });
      if (articles.some((candidate: any) => Number(candidate.id) === articleId)) {
        return blog.id;
      }
    }

    throw new Error(`Unable to resolve Shopify blog for article ${articleId}`);
  }

  private async resolveBlogHandle(blogId: number | string): Promise<string> {
    if (this.config?.defaultBlogHandle && String(this.getDefaultBlogId()) === String(blogId)) {
      return this.config.defaultBlogHandle;
    }

    const blogs = await shopifyService.fetchBlogs(this.getShopConfig());
    const blog = blogs.find((candidate: any) => String(candidate.id) === String(blogId));
    if (blog?.handle) return blog.handle;
    throw new Error(`Unable to resolve Shopify blog handle for blog ${blogId}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.config = null;
    this.shopConfig = null;
    logger.info('ShopifyConnector: disconnected');
  }

  private getShopConfig() {
    if (!this.shopConfig) {
      const cfg = this.config;
      return {
        shop: cfg?.endpointUrl?.replace('https://', '').replace('/admin', '') || '',
        accessToken: cfg?.apiKey || '',
        apiVersion: '2025-07',
      };
    }
    return this.shopConfig;
  }

  async publishWithTracking(
    client: any,
    blogId: number | string | null,
    articleId: string,
    article: { title: string; contentHtml: string; metaTitle?: string; metaDescription?: string; tags?: string[] }
  ): Promise<any> {
    if (!this.pool) throw new Error('ShopifyConnector: pool not set');
    return shopifyService.publishArticleWithTracking(this.pool, client, blogId, articleId, article);
  }

  async fetchBlogs(): Promise<any[]> {
    return shopifyService.fetchBlogs(this.getShopConfig());
  }

  async fetchArticles(): Promise<any[]> {
    return shopifyService.fetchArticles(this.getShopConfig());
  }
}

export const shopifyConnector = new ShopifyConnector();
