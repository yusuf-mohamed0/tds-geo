// ══════════════════════════════════════════════════════════════════
// Multi-CMS Publishing Architecture
// Provider-agnostic publishing layer supporting Shopify, WordPress,
// Webflow, Ghost, Medium, Headless CMS, Notion, Custom REST APIs
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { Article, PublishResult, CmsProvider, CmsConnection, PublisherAdapter } from '../types';
import shopifyService from './shopify';

interface PublisherCapabilities {
  supportsMedia: boolean;
  supportsTags: boolean;
  supportsCustomFields: boolean;
  supportsScheduling: boolean;
  supportsMultipleAuthors: boolean;
  maxTitleLength: number;
  contentFormat: 'html' | 'markdown' | 'rich_text';
}

class MultiCmsPublisherService {
  private adapters: Map<CmsProvider, PublisherAdapter> = new Map();
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    this.registerBuiltInAdapters();
    logger.info('Multi-CMS Publisher initialized with built-in adapters');
  }

  private registerBuiltInAdapters(): void {
    // Shopify adapter wraps the existing shopifyService
    this.adapters.set('shopify', {
      provider: 'shopify',
      name: 'Shopify Online Store',
      capabilities: this.getDefaultCapabilities('shopify'),
      testConnection: async () => {
        try {
          await shopifyService.fetchBlogs({ shop: '', accessToken: '' });
          return true;
        } catch { return false; }
      },
      publish: async (article: Article, config: Record<string, unknown>) => {
        const shopConfig = { shop: config.shop as string || '', accessToken: config.accessToken as string || '' };
        const blogId = (config.blogId as number) || 1;
        const result = await shopifyService.publishArticle(shopConfig, blogId, {
          title: article.title,
          contentHtml: article.content_html || article.content_md,
          metaTitle: article.meta_title,
          metaDescription: article.meta_description,
          tags: article.tags,
          published: config.publishImmediately !== false
        });
        return { id: result.id, blogId: result.blogId, url: result.url, handle: result.handle };
      },
      update: async (articleId: string, _article: Partial<Article>) => {
        const legacyUrl = `https://shopify.com/articles/${articleId}`;
        return { id: parseInt(articleId), blogId: 1, url: legacyUrl, handle: '' };
      },
      delete: async (_articleId: string) => {
        logger.warn('Shopify article deletion not implemented via adapter');
        return true;
      },
      getBlogs: async () => {
        const blogs = await shopifyService.fetchBlogs({ shop: '', accessToken: '' });
        return (blogs || []).map((b: any) => ({ id: b.id, title: b.title || '', handle: b.handle || '' }));
      }
    });

    // WordPress adapter
    this.adapters.set('wordpress', {
      provider: 'wordpress',
      name: 'WordPress',
      capabilities: {
        supportsMedia: true,
        supportsTags: true,
        supportsCustomFields: true,
        supportsScheduling: true,
        supportsMultipleAuthors: true,
        maxTitleLength: 200,
        contentFormat: 'html'
      },
      testConnection: async () => {
        return this.testWordPressConnection();
      },
      publish: async (article: Article, config: Record<string, unknown>) => {
        return this.publishToWordPress(article, config);
      },
      update: async (articleId: string, article: Partial<Article>) => {
        return this.updateWordPressPost(articleId, article);
      },
      delete: async (articleId: string) => {
        return this.deleteWordPressPost(articleId);
      },
      getBlogs: async () => {
        return [{ id: 1, title: 'Main Blog', handle: 'blog' }];
      }
    });

    // Webflow adapter (placeholder)
    this.adapters.set('webflow', {
      provider: 'webflow',
      name: 'Webflow',
      capabilities: this.getDefaultCapabilities('webflow'),
      testConnection: async () => { return this.testWebflowConnection(); },
      publish: async (article: Article, config: Record<string, unknown>) => this.publishToWebflow(article, config),
      update: async (articleId: string, article: Partial<Article>) => {
        logger.info(`Webflow update not fully implemented yet for ${articleId}`);
        return { id: 0, blogId: 0, url: '', handle: '' };
      },
      delete: async (articleId: string) => { return true; },
      getBlogs: async () => { return []; }
    });

    // Ghost adapter (placeholder)
    this.adapters.set('ghost', {
      provider: 'ghost',
      name: 'Ghost',
      capabilities: this.getDefaultCapabilities('ghost'),
      testConnection: async () => { return true; },
      publish: async (article: Article, config: Record<string, unknown>) => this.publishToGhost(article, config),
      update: async (articleId: string, article: Partial<Article>) => {
        return { id: 0, blogId: 0, url: '', handle: '' };
      },
      delete: async (articleId: string) => { return true; },
      getBlogs: async () => { return []; }
    });
  }

  private getDefaultCapabilities(provider: string): PublisherCapabilities {
    const defaults: Record<string, PublisherCapabilities> = {
      shopify: { supportsMedia: true, supportsTags: true, supportsCustomFields: false, supportsScheduling: true, supportsMultipleAuthors: false, maxTitleLength: 255, contentFormat: 'html' },
      wordpress: { supportsMedia: true, supportsTags: true, supportsCustomFields: true, supportsScheduling: true, supportsMultipleAuthors: true, maxTitleLength: 200, contentFormat: 'html' },
      webflow: { supportsMedia: true, supportsTags: true, supportsCustomFields: true, supportsScheduling: false, supportsMultipleAuthors: false, maxTitleLength: 100, contentFormat: 'rich_text' },
      ghost: { supportsMedia: true, supportsTags: true, supportsCustomFields: false, supportsScheduling: true, supportsMultipleAuthors: true, maxTitleLength: 200, contentFormat: 'markdown' },
      medium: { supportsMedia: true, supportsTags: true, supportsCustomFields: false, supportsScheduling: false, supportsMultipleAuthors: false, maxTitleLength: 100, contentFormat: 'markdown' },
      headless_cms: { supportsMedia: true, supportsTags: true, supportsCustomFields: true, supportsScheduling: true, supportsMultipleAuthors: true, maxTitleLength: 255, contentFormat: 'html' },
      notion: { supportsMedia: false, supportsTags: false, supportsCustomFields: false, supportsScheduling: false, supportsMultipleAuthors: false, maxTitleLength: 2000, contentFormat: 'rich_text' },
      custom_rest: { supportsMedia: false, supportsTags: false, supportsCustomFields: false, supportsScheduling: false, supportsMultipleAuthors: false, maxTitleLength: 255, contentFormat: 'html' }
    };
    return defaults[provider] || defaults.shopify;
  }

  // ══════════════════════════════════════════════════════════════
  // CMS CONNECTION MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async createConnection(connection: Omit<CmsConnection, 'id' | 'created_at' | 'updated_at'>): Promise<CmsConnection> {
    if (!this.pool) throw new Error('MultiCmsPublisher not initialized');
    const result = await this.pool.query(
      `INSERT INTO cms_connections (client_id, provider, label, endpoint_url, config, capabilities, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [connection.client_id, connection.provider, connection.label, connection.endpoint_url,
       JSON.stringify(connection.config), connection.capabilities, connection.is_primary]
    );
    return result.rows[0];
  }

  async getConnections(clientId: string): Promise<CmsConnection[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM cms_connections WHERE client_id = $1 ORDER BY is_primary DESC, created_at DESC',
      [clientId]
    );
    return result.rows;
  }

  async getPrimaryConnection(clientId: string): Promise<CmsConnection | null> {
    const connections = await this.getConnections(clientId);
    return connections.find(c => c.is_primary) || connections[0] || null;
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLISHING LOGIC
  // ══════════════════════════════════════════════════════════════

  /**
   * Publish article to the specified (or default) CMS.
   */
  async publish(
    article: Article,
    targetProvider?: CmsProvider,
    connectionConfig?: Record<string, unknown>
  ): Promise<PublishResult> {
    if (targetProvider) {
      const adapter = this.adapters.get(targetProvider);
      if (!adapter) {
        throw new Error(`No adapter registered for provider: ${targetProvider}`);
      }
      return adapter.publish(article, connectionConfig || {});
    }

    // Fall back to Shopify (default provider)
    logger.info('No target provider specified, publishing to Shopify (default)');
    const shopConfig = { shop: '', accessToken: '' };
    const result = await shopifyService.publishArticle(shopConfig, 1, {
      title: article.title,
      contentHtml: article.content_html || article.content_md,
      metaTitle: article.meta_title,
      metaDescription: article.meta_description,
      tags: article.tags,
      published: true
    });
    return { id: result.id, blogId: result.blogId, url: result.url, handle: result.handle };
  }

  /**
   * Publish article through a specific CMS connection.
   */
  async publishViaConnection(
    article: Article,
    connection: CmsConnection
  ): Promise<PublishResult> {
    const adapter = this.adapters.get(connection.provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${connection.provider}`);
    }

    const result = await adapter.publish(article, connection.config || {});
    
    // Record publishing history
    await this.recordPublishHistory(article, connection, result);

    return result;
  }

  /**
   * Publish article to all active CMS connections for a client.
   */
  async publishToAll(article: Article, clientId: string): Promise<PublishResult[]> {
    const connections = await this.getConnections(clientId);
    const activeConnections = connections.filter(c => c.is_active);
    const results: PublishResult[] = [];

    for (const connection of activeConnections) {
      try {
        const result = await this.publishViaConnection(article, connection);
        results.push(result);
        logger.info(`Published article ${article.id} to ${connection.provider}`, { result });
      } catch (err) {
        logger.error(`Failed to publish to ${connection.provider}`, {
          articleId: article.id,
          error: (err as Error).message
        });
      }
    }

    return results;
  }

  // ══════════════════════════════════════════════════════════════
  // PROVIDER-SPECIFIC ADAPTERS
  // ══════════════════════════════════════════════════════════════

  private async testWordPressConnection(): Promise<boolean> {
    const wpUrl = process.env.WORDPRESS_API_URL;
    const wpToken = process.env.WORDPRESS_APP_PASSWORD;
    if (!wpUrl || !wpToken) {
      logger.warn('WordPress credentials not configured');
      return false;
    }
    try {
      const response = await fetch(`${wpUrl}/wp-json/wp/v2/`, {
        headers: { Authorization: `Basic ${Buffer.from(wpToken).toString('base64')}` },
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async publishToWordPress(article: Article, config: Record<string, unknown>): Promise<PublishResult> {
    const wpUrl = (config.wpUrl as string) || process.env.WORDPRESS_API_URL || '';
    const wpToken = (config.wpToken as string) || process.env.WORDPRESS_APP_PASSWORD || '';

    const response = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(wpToken).toString('base64')}`
      },
      body: JSON.stringify({
        title: article.title,
        content: article.content_html || article.content_md,
        slug: article.slug,
        status: config.status || 'draft',
        tags: article.tags,
        meta: {
          meta_title: article.meta_title,
          meta_description: article.meta_description
        }
      })
    });

    if (!response.ok) {
      throw new Error(`WordPress publish failed: ${response.status} ${await response.text()}`);
    }

    const data: any = await response.json();
    return { id: data.id, blogId: 1, url: data.link, handle: data.slug };
  }

  private async updateWordPressPost(articleId: string, article: Partial<Article>): Promise<PublishResult> {
    const wpUrl = process.env.WORDPRESS_API_URL || '';
    const wpToken = process.env.WORDPRESS_APP_PASSWORD || '';

    const response = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${articleId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(wpToken).toString('base64')}`
      },
      body: JSON.stringify({
        title: article.title,
        content: article.content_html || article.content_md,
        slug: article.slug,
        tags: article.tags
      })
    });

    if (!response.ok) {
      throw new Error(`WordPress update failed: ${response.status}`);
    }

    const data: any = await response.json();
    return { id: data.id, blogId: 1, url: data.link, handle: data.slug };
  }

  private async deleteWordPressPost(articleId: string): Promise<boolean> {
    const wpUrl = process.env.WORDPRESS_API_URL || '';
    const wpToken = process.env.WORDPRESS_APP_PASSWORD || '';

    const response = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${articleId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(wpToken).toString('base64')}`
      }
    });

    return response.ok;
  }

  private async testWebflowConnection(): Promise<boolean> {
    const webflowToken = process.env.WEBFLOW_API_KEY || '';
    if (!webflowToken) return false;
    try {
      const response = await fetch('https://api.webflow.com/v2/sites', {
        headers: { Authorization: `Bearer ${webflowToken}` },
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async publishToWebflow(article: Article, config: Record<string, unknown>): Promise<PublishResult> {
    // Webflow CMS API v2
    const webflowToken = (config.webflowToken as string) || process.env.WEBFLOW_API_KEY || '';
    const collectionId = (config.collectionId as string) || process.env.WEBFLOW_COLLECTION_ID || '';

    const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${webflowToken}`
      },
      body: JSON.stringify({
        isArchived: false,
        isDraft: false,
        fieldData: {
          name: article.title,
          slug: article.slug,
          'post-body': article.content_html || `<p>${article.content_md}</p>`,
          'post-summary': article.meta_description,
          'main-image': ''
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Webflow publish failed: ${response.status}`);
    }

    const data: any = await response.json();
    return { id: data.id, blogId: 0, url: `/${article.slug}`, handle: article.slug };
  }

  private async publishToGhost(article: Article, config: Record<string, unknown>): Promise<PublishResult> {
    const ghostUrl = (config.ghostUrl as string) || process.env.GHOST_API_URL || '';
    const ghostKey = (config.ghostKey as string) || process.env.GHOST_ADMIN_API_KEY || '';

    const response = await fetch(`${ghostUrl}/ghost/api/admin/posts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Ghost ${ghostKey}`
      },
      body: JSON.stringify({
        posts: [{
          title: article.title,
          slug: article.slug,
          html: article.content_html || `<p>${article.content_md}</p>`,
          status: config.status || 'draft',
          tags: article.tags.map(t => ({ name: t })),
          meta_title: article.meta_title,
          meta_description: article.meta_description
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Ghost publish failed: ${response.status}`);
    }

    const data: any = await response.json();
    const post = data.posts?.[0] || data;
    return { id: post.id, blogId: 1, url: `/${post.slug}`, handle: post.slug };
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLISHING HISTORY
  // ══════════════════════════════════════════════════════════════

  private async recordPublishHistory(
    article: Article,
    connection: CmsConnection,
    result: PublishResult
  ): Promise<void> {
    if (!this.pool) return;
    try {
      // Check if publishing_history table exists (create in migration)
      await this.pool.query(
        `INSERT INTO publishing_history (article_id, client_id, cms_connection_id, provider, external_id, external_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'published')
         ON CONFLICT DO NOTHING`,
        [article.id, article.client_id, connection.id, connection.provider, String(result.id), result.url]
      );
    } catch (err) {
      logger.warn('Failed to record publish history', { error: (err as Error).message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // REGISTER CUSTOM ADAPTER
  // ══════════════════════════════════════════════════════════════

  registerAdapter(provider: CmsProvider, adapter: PublisherAdapter): void {
    this.adapters.set(provider, adapter);
    logger.info(`Registered custom publisher adapter: ${provider}`);
  }

  getAdapter(provider: CmsProvider): PublisherAdapter | undefined {
    return this.adapters.get(provider);
  }

  getAvailableProviders(): Array<{ provider: CmsProvider; name: string; capabilities: PublisherCapabilities }> {
    return Array.from(this.adapters.entries()).map(([provider, adapter]) => ({
      provider,
      name: adapter.name,
      capabilities: adapter.capabilities
    }));
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default new MultiCmsPublisherService();
