// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Multi-CMS Publishing Architecture
// Provider-agnostic publishing layer supporting Shopify, WordPress,
// Webflow, Ghost, Medium, Headless CMS, Notion, Custom REST APIs
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { Article, PublishResult, CmsProvider, CmsConnection, PublisherAdapter, PublisherCapabilities } from '../types';
import { generateSlug } from '../utils/stringUtils';
import { wordpressConnector as _wp } from '../connectors/wordpress';
import { webflowConnector as _wf } from '../connectors/webflow';
import { ghostConnector as _gh } from '../connectors/ghost';
import { shopifyConnector as _sh } from '../connectors/shopify';
const wordpressConnector: PublisherAdapter = _wp as any;
const webflowConnector: PublisherAdapter = _wf as any;
const ghostConnector: PublisherAdapter = _gh as any;
const shopifyConnector: PublisherAdapter = _sh as any;

class MultiCmsPublisherService {
  private adapters: Map<CmsProvider, PublisherAdapter> = new Map();
  private pool: Pool | null = null;

  // Config store for Custom REST (Kivo Geo Next.js connector) adapter update/delete operations
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

    // -- Custom REST (Kivo Geo Next.js connector) adapter --
    // Publishes articles to any site running @tds/nextjs-integration
    // via its /api/kivo/* REST endpoints.
    // Auth: X-Kivo-Key header
    this.adapters.set('custom_rest', {
      provider: 'custom_rest',
      name: 'Kivo Geo Next.js Integration (Custom REST)',
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
  // CUSTOM REST (Kivo Geo Next.js CONNECTOR) ADAPTER
  // ══════════════════════════════════════════════════════════════

  /**
   * Kivo Geo API base path on the Next.js site.
   * The @tds/nextjs-integration package registers routes under /api/kivo.
   */
  private static readonly KIVO_NEXTJS_API_PATH = '/api/kivo';

  /**
   * Build the request config for the Kivo Geo Next.js connector API.
   * Config is read from the CMS connection's config object.
   *
   * Required config keys:
   *   endpoint_url (or siteUrl): The base URL of the Next.js site (e.g. https://example.com)
   *   apiKey (or kivo_api_key): The shared API key
   */
  private buildCustomRestRequest(
    config: Record<string, unknown>
  ): { baseUrl: string; headers: Record<string, string> } {
    const siteUrl = (config.endpoint_url as string) || (config.siteUrl as string) || '';
    const apiKey = (config.apiKey as string) || (config.kivo_api_key as string) || '';

    const baseUrl = siteUrl.replace(/\/$/, '');

    return {
      baseUrl: `${baseUrl}${MultiCmsPublisherService.KIVO_NEXTJS_API_PATH}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Kivo-Key': apiKey,
        'User-Agent': 'TDS-Geo-Backend/3.0',
      },
    };
  }

  /**
   * Test connection to the Kivo Geo Next.js connector.
   * Pings the /api/kivo/posts endpoint to verify credentials.
   */
  private async testCustomRestConnection(): Promise<boolean> {
    // Try env-var-based approach first (legacy single-site)
    const envUrl = process.env.KIVO_NEXTJS_URL;
    const envKey = process.env.KIVO_NEXTJS_API_KEY;

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
    logger.warn('Custom REST (Next.js) not configured globally. Set KIVO_NEXTJS_URL + KIVO_NEXTJS_API_KEY for global connection testing.');
    return false;
  }

  /**
   * Publish an article to the Kivo Geo Next.js connector.
   * POST /api/kivo/posts
   */
  private async publishToCustomRest(
    article: Article,
    config: Record<string, unknown>
  ): Promise<PublishResult> {
    const req = this.buildCustomRestRequest(config);
    const endpoint = `${req.baseUrl}/posts`;

    // Build the payload matching the @tds/nextjs-integration TdsGeoArticle schema
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
      logger.error('Custom REST publish failed (Kivo Geo Next.js connector)', {
        status: response.status,
        error: errorText.slice(0, 500),
        title: article.title,
        siteUrl: config.endpoint_url as string || 'env',
      });
      throw new Error(`Kivo Geo Next.js connector publish failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data: any = await response.json();

    // Kivo Geo connector returns { success, data: { localId, slug, url } }
    // localId is a UUID string (not a number), so PublishResult.id is set to 0.
    // The localId is stored in the connection config map for update/delete operations.
    if (data.data) {
      const localId = data.data.localId || '';
      const slug = data.data.slug || '';
      const url = data.data.url || `/${slug}`;

      // Store the localId in a way that update/delete can retrieve it.
      // The connection config was already stored in customRestConnectionConfigs
      // keyed by article.id (Kivo Geo UUID) in publishViaConnection().
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
        success: true,
        provider: 'custom',
        url,
        handle: slug,
      };
    }

    throw new Error('Kivo Geo Next.js connector returned unexpected response format: missing data');
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
   * Update an article on the Kivo Geo Next.js connector.
   * PUT /api/kivo/posts/{postId}
   *
   * The postId is resolved from:
   *   1. _postLocalId stored in the connection config (UUID from initial publish)
   *   2. Fallback to the articleId parameter (works if it's a slug or Kivo Geo UUID)
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
      throw new Error(`Kivo Geo Next.js connector update failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    // Clean up stored config on success
    this.customRestConnectionConfigs.delete(articleId);

    const data: any = await response.json();

    if (data.data) {
      return {
        success: true,
        provider: 'custom',
        url: data.data.url || '',
        handle: data.data.slug || '',
      };
    }

    return { success: false, provider: 'custom', error: 'No data in response' };
  }

  /**
   * Delete an article from the Kivo Geo Next.js connector.
   * DELETE /api/kivo/posts/{postId}
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
    const envUrl = process.env.KIVO_NEXTJS_URL;
    const envKey = process.env.KIVO_NEXTJS_API_KEY;

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

    logger.warn('Custom REST credentials not configured for delete — set KIVO_NEXTJS_URL + KIVO_NEXTJS_API_KEY or configure per-client CMS connection');
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
        [article.id, article.client_id, connection.id, connection.provider, result.externalId || String((result as any).id || ''), result.url]
      );
    } catch (err) {
      logger.warn('Failed to record publish history', { error: (err as Error).message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // WORDPRESS SYNC (Pull posts FROM WordPress INTO local articles table)
  // ══════════════════════════════════════════════════════════════

  async syncFromWordPress(clientId: string, connectionId?: string): Promise<{
    synced: number;
    updated: number;
    skipped: number;
    errors: string[];
  }> {
    if (!this.pool) throw new Error('MultiCmsPublisher not initialized');

    const connections = connectionId
      ? (await this.pool.query('SELECT * FROM cms_connections WHERE id = $1 AND client_id = $2', [connectionId, clientId])).rows
      : await this.getConnections(clientId);

    const wpConnections = connections.filter((c: any) => c.provider === 'wordpress' && c.is_active);

    let totalSynced = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];

    for (const conn of wpConnections) {
      const apiKey = conn.config?.api_key;
      const endpointUrl = conn.config?.site_url || conn.endpoint_url;
      if (!apiKey || !endpointUrl) {
        allErrors.push(`Connection ${conn.id}: missing api_key or endpoint_url`);
        continue;
      }

      try {
        const result = await this.syncFromSingleWordPress(clientId, conn, apiKey, endpointUrl);
        totalSynced += result.synced;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        allErrors.push(...result.errors);

        await this.pool.query('UPDATE cms_connections SET last_sync_at = NOW() WHERE id = $1', [conn.id]);
      } catch (err: any) {
        allErrors.push(`Connection ${conn.id}: ${err.message}`);
      }
    }

    return { synced: totalSynced, updated: totalUpdated, skipped: totalSkipped, errors: allErrors };
  }

  private async wpFetch(
    endpointUrl: string, apiKey: string, path: string, params: Record<string, any> = {}
  ): Promise<any> {
    const baseUrl = `${endpointUrl.replace(/\/+$/, '')}/wp-json/kivo/v1`;
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const response = await fetch(url.toString(), {
      headers: { 'X-Kivo-Key': apiKey, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`WordPress API ${response.status}: ${text.slice(0, 200)}`);
    }
    return response.json();
  }

  private async syncFromSingleWordPress(
    clientId: string, connection: any, apiKey: string, endpointUrl: string
  ): Promise<{ synced: number; updated: number; skipped: number; errors: string[] }> {
    let page = 1;
    let totalSynced = 0, totalUpdated = 0, totalSkipped = 0;
    const errors: string[] = [];
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const body = await this.wpFetch(endpointUrl, apiKey, '/posts', { limit: perPage, page });
        const posts: any[] = body.data || body.posts || body || [];
        const total = body.total || posts.length;

        for (const post of posts) {
          if (post.type && post.type !== 'post') {
            totalSkipped++;
            continue;
          }

          const wpStatus = post.status === 'publish' ? 'published' : 'draft';
          const slug = post.slug || `wp-post-${post.id}`;
          const metaTitle = post.meta?.title || post.meta_title || '';
          const metaDescription = post.meta?.description || post.meta_description || '';
          const tags: string[] = (post.tags || []).map((t: any) => typeof t === 'string' ? t : t.name || t.slug || '');
          const publishedAt = post.publish_date || post.created_at || null;

          const existing = await this.pool!.query(
            `SELECT a.id FROM articles a
             LEFT JOIN publishing_history ph ON ph.article_id = a.id AND ph.provider = 'wordpress'
             WHERE (ph.external_id = $1 OR a.slug = $2) AND a.client_id = $3
             LIMIT 1`,
            [String(post.id), slug, clientId]
          );

          if (existing.rows.length > 0) {
            const params: any[] = [post.title, post.content, metaTitle, metaDescription, tags, wpStatus];
            let query: string;
            if (publishedAt) {
              params.push(publishedAt);
              params.push(existing.rows[0].id);
              query = `UPDATE articles SET title = $1, content_html = $2, meta_title = $3, meta_description = $4, tags = $5, status = $6, source = 'wordpress_sync', published_at = $7, updated_at = NOW() WHERE id = $8`;
            } else {
              params.push(existing.rows[0].id);
              query = `UPDATE articles SET title = $1, content_html = $2, meta_title = $3, meta_description = $4, tags = $5, status = $6, source = 'wordpress_sync', updated_at = NOW() WHERE id = $7`;
            }
            await this.pool!.query(query, params);
            totalUpdated++;
          } else {
            const insertResult = await this.pool!.query(
              `INSERT INTO articles (client_id, title, slug, content_html, content_md, meta_title, meta_description, tags, status, source, published_at, word_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'wordpress_sync', $10, 0)
               RETURNING id`,
              [clientId, post.title, slug, post.content, post.content || '', metaTitle, metaDescription, tags, wpStatus, publishedAt || null]
            );
            const articleId = insertResult.rows[0].id;

            await this.pool!.query(
              `INSERT INTO publishing_history (article_id, client_id, cms_connection_id, provider, external_id, external_url, status)
               VALUES ($1, $2, $3, 'wordpress', $4, $5, 'published')
               ON CONFLICT DO NOTHING`,
              [articleId, clientId, connection.id, String(post.id), post.permalink || '']
            );

            totalSynced++;
          }
        }

        hasMore = page * perPage < total;
        page++;
      } catch (err: any) {
        errors.push(`Page ${page}: ${err.message}`);
        hasMore = false;
      }
    }

    return { synced: totalSynced, updated: totalUpdated, skipped: totalSkipped, errors };
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
