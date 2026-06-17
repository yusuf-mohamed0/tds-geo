// ══════════════════════════════════════════════════════════════════
// Multi-CMS Publishing Architecture
// Provider-agnostic publishing layer supporting Shopify, WordPress,
// Webflow, Ghost, Medium, Headless CMS, Notion, Custom REST APIs
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { Article, PublishResult, CmsProvider, CmsConnection, PublisherAdapter, PublisherCapabilities } from '../types';
import { generateSlug } from '../utils/stringUtils';
import { wordpressConnector } from '../connectors/wordpress';
import { webflowConnector } from '../connectors/webflow';
import { ghostConnector } from '../connectors/ghost';
import { shopifyConnector } from '../connectors/shopify';

class MultiCmsPublisherService {
  private adapters: Map<CmsProvider, PublisherAdapter> = new Map();
  private pool: Pool | null = null;

  // Config store for Custom REST (Next.js KOZMO Core Plugin) adapter update/delete operations
  // Keyed by articleId → connection config
  private customRestConnectionConfigs: Map<string, Record<string, unknown>> = new Map();

  initialize(pool: Pool): void {
    this.pool = pool;
    this.registerBuiltInAdapters();
    logger.info('Multi-CMS Publisher initialized with built-in adapters');
  }

  private registerBuiltInAdapters(): void {
    // Shopify adapter — standalone connector from backend/connectors/
    this.adapters.set('shopify', shopifyConnector);

    // WordPress adapter — standalone connector from backend/connectors/
    this.adapters.set('wordpress', wordpressConnector);

    // Webflow adapter — standalone connector from backend/connectors/
    this.adapters.set('webflow', webflowConnector);

    // Ghost adapter — standalone connector from backend/connectors/
    this.adapters.set('ghost', ghostConnector);

    // ── Custom REST (Next.js KOZMO Core Plugin) adapter ──
    // Publishes articles to any site running @kozmo-core/nextjs-integration
    // via its /api/kozmo-core/* REST endpoints.
    // Auth: X-KOZMO-Core-Key header
    this.adapters.set('custom_rest', {
      provider: 'custom_rest',
      name: 'KOZMO Core Next.js Integration (Custom REST)',
      capabilities: {
        supportsMedia: true,
        supportsTags: true,
        supportsCustomFields: true,
        supportsScheduling: false,
        supportsMultipleAuthors: true,
        maxTitleLength: 255,
        contentFormat: 'markdown'
      },
      testConnection: async () => {
        return this.testCustomRestConnection();
      },
      publish: async (article: Article, config: Record<string, unknown>) => {
        return this.publishToCustomRest(article, config);
      },
      update: async (articleId: string, article: Partial<Article>) => {
        return this.updateCustomRestPost(articleId, article);
      },
      delete: async (articleId: string) => {
        return this.deleteCustomRestPost(articleId);
      },
      getBlogs: async () => {
        return [{ id: 1, title: 'Blog', handle: 'blog' }];
      }
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
    return shopifyConnector.publish(article, { publishImmediately: true });
  }

  /**
   * Publish article through a specific CMS connection.
   * Stores the connection config for use by subsequent update/delete operations.
   */
  async publishViaConnection(
    article: Article,
    connection: CmsConnection
  ): Promise<PublishResult> {
    const adapter = this.adapters.get(connection.provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${connection.provider}`);
    }

    // Publish — connector stores its own config internally for update/delete
    const result = await adapter.publish(article, connection.config || {});

    // Store config for Custom REST adapter (needs article UUID for lookup)
    if (connection.provider === 'custom_rest' && article.id) {
      this.customRestConnectionConfigs.set(article.id, connection.config || {});
    }
    
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
  // CUSTOM REST (Next.js KOZMO Core Plugin) ADAPTER
  // ══════════════════════════════════════════════════════════════

  /**
   * KOZMO Core API base path on the Next.js site.
   * The @kozmo-core/nextjs-integration package registers routes under /api/kozmo-core.
   */
  private static readonly KOZMO_CORE_NEXTJS_API_PATH = '/api/kozmo-core';

  /**
   * Build the request config for the Next.js KOZMO Core Plugin API.
   * Config is read from the CMS connection's config object.
   *
   * Required config keys:
   *   endpoint_url (or siteUrl): The base URL of the Next.js site (e.g. https://example.com)
   *   apiKey (or kozmo_core_api_key): The shared API key
   */
  private buildCustomRestRequest(
    config: Record<string, unknown>
  ): { baseUrl: string; headers: Record<string, string> } {
    const siteUrl = (config.endpoint_url as string) || (config.siteUrl as string) || '';
    const apiKey = (config.apiKey as string) || (config.kozmo_core_api_key as string) || '';

    const baseUrl = siteUrl.replace(/\/$/, '');

    return {
      baseUrl: `${baseUrl}${MultiCmsPublisherService.KOZMO_CORE_NEXTJS_API_PATH}`,
      headers: {
        'Content-Type': 'application/json',
        'X-KOZMO-Core-Key': apiKey,
        'User-Agent': 'KOZMO Core-Backend/2.0',
      },
    };
  }

  /**
   * Test connection to the Next.js KOZMO Core Plugin.
   * Pings the /api/kozmo-core/posts endpoint to verify credentials.
   */
  private async testCustomRestConnection(): Promise<boolean> {
    // Try env-var-based approach first (legacy single-site)
    const envUrl = process.env.KOZMO_CORE_NEXTJS_URL;
    const envKey = process.env.KOZMO_CORE_NEXTJS_API_KEY;

    if (envUrl && envKey) {
      try {
        const req = this.buildCustomRestRequest({ endpoint_url: envUrl, apiKey: envKey });
        const response = await fetch(`${req.baseUrl}/posts?limit=1`, {
          headers: req.headers,
          signal: AbortSignal.timeout(8000),
        });
        return response.ok;
      } catch {
        return false;
      }
    }

    // If no env vars set, the connection config will be provided per-client
    // This is fine — testConnection is also called with per-connection config
    // via the adapter's testConnection wrapper in the routes.
    logger.warn('Custom REST (Next.js) not configured globally. Set KOZMO_CORE_NEXTJS_URL + KOZMO_CORE_NEXTJS_API_KEY for global connection testing.');
    return false;
  }

  /**
   * Publish an article to the Next.js KOZMO Core Plugin.
   * POST /api/kozmo-core/posts
   */
  private async publishToCustomRest(
    article: Article,
    config: Record<string, unknown>
  ): Promise<PublishResult> {
    const req = this.buildCustomRestRequest(config);
    const endpoint = `${req.baseUrl}/posts`;

    // Build the payload matching the @kozmo-core/nextjs-integration KozmoCoreArticle schema
    const body: Record<string, unknown> = {
      title: article.title,
      content: article.content_md,
      contentHtml: article.content_html || '',
      slug: article.slug || generateSlug(article.title),
      excerpt: (article.meta_description || '').slice(0, 300),
      metaTitle: article.meta_title || '',
      metaDescription: article.meta_description || '',
      tags: article.tags || [],
      categories: (config.categories as string[]) || [],
      featuredImageUrl: (config.featured_image_url as string) || '',
      featuredImageAlt: (config.featured_image_alt as string) || '',
      focusKeyword: (config.focus_keyword as string) || '',
      status: (config.status as string) || 'published',
      id: article.id,
      createdAt: article.created_at?.toISOString?.() || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wordCount: article.word_count || 0,
      customFields: (config.custom_fields as Record<string, unknown>) || {},
    };

    // Add author info if available in config
    if (config.author) {
      body.author = config.author;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Custom REST publish failed (Next.js KOZMO Core Plugin)', {
        status: response.status,
        error: errorText.slice(0, 500),
        title: article.title,
        siteUrl: config.endpoint_url as string || 'env',
      });
      throw new Error(`Next.js KOZMO Core Plugin publish failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data: any = await response.json();

    // KOZMO Core plugin returns { success, data: { localId, slug, url } }
    // localId is a UUID string (not a number), so PublishResult.id is set to 0.
    // The localId is stored in the connection config map for update/delete operations.
    if (data.data) {
      const localId = data.data.localId || '';
      const slug = data.data.slug || '';
      const url = data.data.url || `/${slug}`;

      // Store the localId in a way that update/delete can retrieve it.
      // The connection config was already stored in customRestConnectionConfigs
      // keyed by article.id (KOZMO Core UUID) in publishViaConnection().
      // We also store the localId/slug for the API call.
      // Note: publishViaConnection already stored the config under article.id
      // before calling this method, so we can look it up and augment it.
      const configKey = article.id;
      if (configKey) {
        const existing = this.customRestConnectionConfigs.get(configKey) || {};
        this.customRestConnectionConfigs.set(configKey, {
          ...existing,
          _postLocalId: localId,
          _postSlug: slug,
        });
      }

      return {
        id: 0, // localId is a UUID, can't fit in PublishResult's number type
        blogId: 1,
        url,
        handle: slug,
      };
    }

    throw new Error('Next.js KOZMO Core Plugin returned unexpected response format: missing data');
  }

  /**
   * Get the effective post identifier for API calls.
   * Uses the stored _postLocalId (UUID from Next.js plugin) as the canonical
   * API identifier. Falls back to the original articleId parameter.
   */
  private getCustomRestPostId(articleId: string): { postId: string; config: Record<string, unknown> } {
    const config = this.customRestConnectionConfigs.get(articleId) || {};
    // Use the stored localId if available; otherwise fall back to articleId
    const postId = (config._postLocalId as string) || articleId;
    return { postId, config };
  }

  /**
   * Update an article on the Next.js KOZMO Core Plugin.
   * PUT /api/kozmo-core/posts/{postId}
   *
   * The postId is resolved from:
   *   1. _postLocalId stored in the connection config (UUID from initial publish)
   *   2. Fallback to the articleId parameter (works if it's a slug or KOZMO Core UUID)
   */
  private async updateCustomRestPost(
    articleId: string,
    article: Partial<Article>
  ): Promise<PublishResult> {
    const { postId, config } = this.getCustomRestPostId(articleId);
    const req = this.buildCustomRestRequest(config);
    const endpoint = `${req.baseUrl}/posts/${postId}`;

    const body: Record<string, unknown> = {
      title: article.title,
      content: article.content_md,
      contentHtml: article.content_html,
      slug: article.slug,
      metaTitle: article.meta_title,
      metaDescription: article.meta_description,
      tags: article.tags,
    };

    // Remove undefined values so we don't overwrite with empty
    Object.keys(body).forEach(key => {
      if (body[key] === undefined) delete body[key];
    });

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: req.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Next.js KOZMO Core Plugin update failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    // Clean up stored config on success
    this.customRestConnectionConfigs.delete(articleId);

    const data: any = await response.json();

    if (data.data) {
      return {
        id: 0,
        blogId: 1,
        url: data.data.url || '',
        handle: data.data.slug || '',
      };
    }

    return { id: 0, blogId: 1, url: '', handle: '' };
  }

  /**
   * Delete an article from the Next.js KOZMO Core Plugin.
   * DELETE /api/kozmo-core/posts/{postId}
   */
  private async deleteCustomRestPost(articleId: string): Promise<boolean> {
    const { postId, config } = this.getCustomRestPostId(articleId);

    if (Object.keys(config).length > 0) {
      const req = this.buildCustomRestRequest(config);
      try {
        const response = await fetch(`${req.baseUrl}/posts/${postId}`, {
          method: 'DELETE',
          headers: req.headers,
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          this.customRestConnectionConfigs.delete(articleId);
          return true;
        }

        // 404 means already gone — treat as success
        if (response.status === 404) {
          this.customRestConnectionConfigs.delete(articleId);
          return true;
        }
      } catch {
        // Fall through to env-var approach
      }
    }

    // Try env vars as fallback (legacy single-site support)
    const envUrl = process.env.KOZMO_CORE_NEXTJS_URL;
    const envKey = process.env.KOZMO_CORE_NEXTJS_API_KEY;

    if (envUrl && envKey) {
      try {
        const req = this.buildCustomRestRequest({ endpoint_url: envUrl, apiKey: envKey });
        const response = await fetch(`${req.baseUrl}/posts/${postId}`, {
          method: 'DELETE',
          headers: req.headers,
          signal: AbortSignal.timeout(15000),
        });
        return response.ok || response.status === 404;
      } catch {
        return false;
      }
    }

    logger.warn('Custom REST credentials not configured for delete — set KOZMO_CORE_NEXTJS_URL + KOZMO_CORE_NEXTJS_API_KEY or configure per-client CMS connection');
    return false;
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
