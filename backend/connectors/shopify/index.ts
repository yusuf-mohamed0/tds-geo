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
      const blogId = blogs[0]?.id;
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
    return { success: false, error: 'Update via connector not yet implemented', provider: 'shopify' };
  }

  async delete(id: string): Promise<boolean> {
    return false;
  }

  async getContent(id: string): Promise<ContentPayload | null> {
    return null;
  }

  async getMedia(id: string): Promise<MediaPayload | null> {
    return null;
  }

  async getCategories(): Promise<Taxonomy[]> {
    return [];
  }

  async getTags(): Promise<Taxonomy[]> {
    return [];
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
