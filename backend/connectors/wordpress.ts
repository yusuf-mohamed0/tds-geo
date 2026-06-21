// ══════════════════════════════════════════════════════════════════
// TDS Geo — WordPress Connector
//
// Publishes/updates/deletes articles to WordPress sites.
// Supports three auth modes (auto-detected from config):
//   1. Traffic Digital Solutions GEO WP Plugin  → X-TDS-GEO-Key header + tds-geo/v1/
//   2. TDS Geo WP Plugin    → X-TDS-GEO-Key header + tds-geo/v1/
//   3. Native WP REST API  → Basic Auth (App Passwords) + wp/v2/
// ══════════════════════════════════════════════════════════════════

import { Article, PublishResult, PublisherAdapter } from '../types';
import { logger } from '../utils/logger';
import { generateSlug } from '../utils/stringUtils';

// Plugin REST API namespaces
const TDS_GEO_API_NAMESPACE = 'tds-geo/v1';

interface WordPressRequestConfig {
  baseUrl: string;
  headers: Record<string, string>;
  mode: 'tds_geo' | 'tds-geo' | 'native';
}

export class WordPressConnector implements PublisherAdapter {
  readonly provider = 'wordpress' as const;
  readonly name = 'WordPress';
  readonly capabilities = {
    supportsMedia: true,
    supportsTags: true,
    supportsCustomFields: true,
    supportsScheduling: true,
    supportsMultipleAuthors: true,
    maxTitleLength: 200,
    contentFormat: 'html' as const,
  };

  // Per-article connection config storage for update/delete
  private connectionConfigs: Map<string, Record<string, unknown>> = new Map();

  // Tag name → ID cache for native WP REST API
  private tagCache: Map<string, number> = new Map();

  // ── Public API ──────────────────────────────

  async testConnection(): Promise<boolean> {
    const tdsGeoAiWpUrl = process.env.TDS_GEO_WORDPRESS_URL;
    const tdsGeoAiKey = process.env.TDS_GEO_WORDPRESS_API_KEY;
    if (tdsGeoAiWpUrl && tdsGeoAiKey) {
      try {
        const baseSiteUrl = tdsGeoAiWpUrl.replace(/\/wp-json.*$/, '').replace(/\/$/, '');
        const res = await fetch(`${baseSiteUrl}/wp-json/${TDS_GEO_API_NAMESPACE}/status`, {
          headers: { 'X-TDS-GEO-Key': tdsGeoAiKey },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return true;
      } catch { /* fall through */ }
    }

    const tdsGeoWpUrl = process.env.TDS_GEO_WORDPRESS_URL;
    const tdsGeoApiKey = process.env.TDS_GEO_WORDPRESS_API_KEY;
    if (tdsGeoWpUrl && tdsGeoApiKey) {
      try {
        const baseSiteUrl = tdsGeoWpUrl.replace(/\/wp-json.*$/, '').replace(/\/$/, '');
        const res = await fetch(`${baseSiteUrl}/wp-json/tds-geo/v1/status`, {
          headers: { 'X-TDS-GEO-Key': tdsGeoApiKey },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return true;
      } catch { /* fall through */ }
    }

    const wpUrl = process.env.WORDPRESS_API_URL;
    const wpToken = process.env.WORDPRESS_APP_PASSWORD;
    if (wpUrl && wpToken) {
      try {
        const res = await fetch(`${wpUrl}/wp-json/wp/v2/`, {
          headers: { Authorization: `Basic ${Buffer.from(wpToken).toString('base64')}` },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return true;
      } catch { /* fall through */ }
    }

    logger.warn('WordPress credentials not configured');
    return false;
  }

  async publish(article: Article, config: Record<string, unknown>): Promise<PublishResult> {
    const req = this.buildRequest(config);

    const endpoint = `${req.baseUrl}/posts`;

    // Resolve tag names → IDs for native WP REST API
    if (req.mode === 'native' && article.tags && article.tags.length > 0) {
      const resolvedIds = await this.resolveTagIds(
        article.tags as string[],
        req.baseUrl,
        req.headers,
      );
      article = { ...article, tags: resolvedIds };
    }

    const body = this.buildPublishBody(article, config, req.mode);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('WordPress publish failed', {
        status: response.status,
        error: errorText.slice(0, 500),
        mode: req.mode,
        title: article.title,
      });
      throw new Error(`WordPress publish failed (${req.mode}): ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const result = this.parseResponse(data, req.mode);

    // Store config for future update/delete
    this.connectionConfigs.set(result.id.toString(), config);

    return result;
  }

  async update(articleId: string, article: Partial<Article>): Promise<PublishResult> {
    const config = this.connectionConfigs.get(articleId) || {};
    const req = this.buildRequest(config);

    const endpoint = `${req.baseUrl}/posts/${articleId}`;
    const body: Record<string, unknown> = {};

    if (article.title) body.title = article.title;
    if (article.content_html || article.content_md) body.content_html = article.content_html || article.content_md;
    if (article.slug) body.slug = article.slug;
    if (article.tags) body.tags = article.tags;
    if (article.meta_title) body.meta_title = article.meta_title;
    if (article.meta_description) body.meta_description = article.meta_description;
    if (config.status) body.status = config.status as string;

    // Remove undefined values
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k]; });

    const method = req.mode === 'tds_geo' ? 'PUT' : 'POST';
    const response = await fetch(endpoint, {
      method,
      headers: req.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress update failed (${req.mode}): ${response.status} ${errorText.slice(0, 200)}`);
    }

    this.connectionConfigs.delete(articleId);
    const data: any = await response.json();
    return this.parseResponse(data, req.mode);
  }

  async delete(articleId: string): Promise<boolean> {
    const config = this.connectionConfigs.get(articleId) || {};

    if (Object.keys(config).length > 0) {
      const req = this.buildRequest(config);
      try {
        const response = await fetch(`${req.baseUrl}/posts/${articleId}`, {
          method: 'DELETE',
          headers: req.headers,
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) {
          this.connectionConfigs.delete(articleId);
          return true;
        }
      } catch { /* fall through to env fallback */ }
    }

    // Legacy env var fallback
    const wpUrl = process.env.WORDPRESS_API_URL || '';
    const wpToken = process.env.WORDPRESS_APP_PASSWORD || '';
    if (wpUrl && wpToken) {
      try {
        const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${articleId}`, {
          method: 'DELETE',
          headers: { Authorization: `Basic ${Buffer.from(wpToken).toString('base64')}` },
          signal: AbortSignal.timeout(15000),
        });
        return res.ok;
      } catch { return false; }
    }

    logger.warn('WordPress credentials not configured for delete');
    return false;
  }

  async getBlogs(): Promise<Array<{ id: number | string; title: string; handle: string }>> {
    return [{ id: 1, title: 'Main Blog', handle: 'blog' }];
  }

  /**
   * Resolve tag names to WP tag IDs via REST API.
   * Caches results to avoid repeated lookups.
   */
  private async resolveTagIds(
    tagNames: string[],
    baseUrl: string,
    headers: Record<string, string>,
  ): Promise<number[]> {
    if (tagNames.length === 0) return [];

    const ids: number[] = [];
    const uncached: string[] = [];

    for (const name of tagNames) {
      const cached = this.tagCache.get(name.toLowerCase());
      if (cached !== undefined) {
        ids.push(cached);
      } else {
        uncached.push(name);
      }
    }

    if (uncached.length > 0) {
      try {
        const res = await fetch(`${baseUrl}/tags?search=${encodeURIComponent(uncached.join(','))}&per_page=100`, {
          headers,
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const existingTags: any[] = await res.json();
          const existingMap = new Map<string, number>();
          for (const t of existingTags) {
            existingMap.set(t.name.toLowerCase(), t.id);
          }

          // Try to create missing tags
          for (const name of uncached) {
            const existing = existingMap.get(name.toLowerCase());
            if (existing !== undefined) {
              this.tagCache.set(name.toLowerCase(), existing);
              ids.push(existing);
            } else {
              try {
                const createRes = await fetch(`${baseUrl}/tags`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ name }),
                  signal: AbortSignal.timeout(10000),
                });
                if (createRes.ok) {
                  const newTag = await createRes.json();
                  this.tagCache.set(name.toLowerCase(), newTag.id);
                  ids.push(newTag.id);
                }
              } catch {
                // Silently skip tags we can't create
              }
            }
          }
        }
      } catch {
        // Fall through with whatever we resolved
      }
    }

    return ids;
  }

  // ── Internal ────────────────────────────────

  private buildRequest(config: Record<string, unknown>): WordPressRequestConfig {
    const wpUrl = (config.wpUrl as string) ||
      (config.endpoint_url as string) ||
      process.env.WORDPRESS_API_URL ||
      '';
    const tdsGeoAiKey = (config.tdsGeoAiKey as string) ||
      (config.tds_geo_api_key as string) ||
      process.env.TDS_GEO_WORDPRESS_API_KEY ||
      '';
    const tdsGeoKey = (config.apiKey as string) ||
      (config.tds_geo_api_key as string) ||
      '';
    const wpToken = (config.wpToken as string) ||
      (config.wpAppPassword as string) ||
      process.env.WORDPRESS_APP_PASSWORD ||
      '';

    const baseSiteUrl = wpUrl.replace(/\/wp-json.*$/, '').replace(/\/$/, '');

    if (tdsGeoAiKey) {
      return {
        baseUrl: `${baseSiteUrl}/wp-json/${TDS_GEO_API_NAMESPACE}`,
        headers: { 'Content-Type': 'application/json', 'X-TDS-GEO-Key': tdsGeoAiKey },
        mode: 'tds_geo',
      };
    }

    if (tdsGeoKey) {
      return {
        baseUrl: `${baseSiteUrl}/wp-json/${TDS_GEO_API_NAMESPACE}`,
        headers: { 'Content-Type': 'application/json', 'X-TDS-GEO-Key': tdsGeoKey },
        mode: 'tds-geo',
      };
    }

    return {
      baseUrl: `${baseSiteUrl}/wp-json/wp/v2`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(wpToken).toString('base64')}`,
      },
      mode: 'native',
    };
  }

  private buildPublishBody(
    article: Article,
    config: Record<string, unknown>,
    mode: 'tds_geo' | 'tds-geo' | 'native',
  ): Record<string, unknown> {
    const base = {
      title: article.title,
      slug: article.slug || (article.title ? generateSlug(article.title) : '') || '',
      status: (config.status as string) || 'publish',
      tags: article.tags || [],
      categories: (config.categories as string[]) || [],
    };

    if (mode === 'tds_geo') {
      return {
        ...base,
        content_html: article.content_html || article.content_md || '',
        meta_title: article.meta_title || '',
        meta_description: article.meta_description || '',
        focus_keyword: (config.focus_keyword as string) || '',
        featured_image_url: (config.featured_image_url as string) || '',
        publish_date: (config.publish_date as string) || '',
        author_id: (config.author_id as number) || 0,
        agent_article_id: article.id,
        auto_publish: config.auto_publish ?? true,
      };
    }

    if (mode === 'tds-geo') {
      return {
        ...base,
        content: article.content_html || article.content_md,
        content_html: article.content_html || article.content_md,
        meta_title: article.meta_title || '',
        meta_description: article.meta_description || '',
        focus_keyword: (config.focus_keyword as string) || '',
        featured_image_url: (config.featured_image_url as string) || '',
        publish_date: (config.publish_date as string) || '',
        author_id: (config.author_id as number) || 0,
        tds_geo_article_id: article.id,
        custom_fields: (config.custom_fields as Record<string, unknown>) || {},
      };
    }

    // native (tags already resolved to IDs in publish())
    return {
      ...base,
      content: article.content_html || article.content_md,
      meta: {
        meta_title: article.meta_title || '',
        meta_description: article.meta_description || '',
      },
    };
  }

  private parseResponse(data: any, mode: string): PublishResult {
    if ((mode === 'tds_geo' || mode === 'tds-geo') && data.data) {
      return {
        id: data.data.post_id,
        blogId: 1,
        url: data.data.post_url || '',
        handle: data.data.post_id?.toString() || '',
      };
    }
    return { id: data.id, blogId: 1, url: data.link || '', handle: data.slug || '' };
  }
}

/** Singleton instance for use across the app */
export const wordpressConnector = new WordPressConnector();
