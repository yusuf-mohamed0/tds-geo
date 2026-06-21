// ══════════════════════════════════════════════════════════════════
// TDS Geo — Webflow Connector
//
// Publishes/updates/deletes articles to Webflow CMS collections
// via the Webflow CMS API v2.
// ══════════════════════════════════════════════════════════════════

import { Article, PublishResult, PublisherAdapter } from '../types';
import { logger } from '../utils/logger';
import { generateSlug } from '../utils/stringUtils';

export class WebflowConnector implements PublisherAdapter {
  readonly provider = 'webflow' as const;
  readonly name = 'Webflow';
  readonly capabilities = {
    supportsMedia: true,
    supportsTags: true,
    supportsCustomFields: true,
    supportsScheduling: false,
    supportsMultipleAuthors: false,
    maxTitleLength: 100,
    contentFormat: 'rich_text' as const,
  };

  private connectionConfigs: Map<string, Record<string, unknown>> = new Map();

  async testConnection(): Promise<boolean> {
    const webflowToken = process.env.WEBFLOW_API_KEY || '';
    if (!webflowToken) return false;
    try {
      const response = await fetch('https://api.webflow.com/v2/sites', {
        headers: { Authorization: `Bearer ${webflowToken}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async publish(article: Article, config: Record<string, unknown>): Promise<PublishResult> {
    const token = this.resolveToken(config);
    const collectionId = this.resolveCollectionId(config);

    const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items`, {
      method: 'POST',
      headers: this.buildHeaders(token),
      body: JSON.stringify({
        isArchived: false,
        isDraft: false,
        fieldData: {
          name: article.title,
          slug: article.slug || (article.title ? generateSlug(article.title) : ''),
          'post-body': article.content_html || `<p>${article.content_md}</p>`,
          'post-summary': article.meta_description,
          'main-image': (config.featured_image_url as string) || '',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Webflow publish failed', {
        status: response.status,
        error: errorText.slice(0, 500),
        title: article.title,
      });
      throw new Error(`Webflow publish failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const itemId = data.id || '';
    this.connectionConfigs.set(itemId, config);

    return { id: Number(itemId), blogId: 0, url: `/${article.slug}`, handle: article.slug };
  }

  async update(articleId: string, article: Partial<Article>): Promise<PublishResult> {
    const config = this.connectionConfigs.get(articleId) || {};
    const token = this.resolveToken(config);
    const collectionId = this.resolveCollectionId(config);

    const body: Record<string, unknown> = { fieldData: {} as Record<string, unknown> };
    const fieldData = body.fieldData as Record<string, unknown>;

    if (article.title) fieldData.name = article.title;
    if (article.slug) fieldData.slug = article.slug;
    if (article.content_html || article.content_md) fieldData['post-body'] = article.content_html || `<p>${article.content_md}</p>`;

    const response = await fetch(`https://api.webflow.com/v2/collections/${collectionId}/items/${articleId}`, {
      method: 'PATCH',
      headers: this.buildHeaders(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webflow update failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    this.connectionConfigs.delete(articleId);
    return { id: Number(articleId), blogId: 0, url: '', handle: article.slug || '' };
  }

  async delete(articleId: string): Promise<boolean> {
    const config = this.connectionConfigs.get(articleId) || {};

    if (Object.keys(config).length > 0) {
      const token = this.resolveToken(config);
      const collectionId = this.resolveCollectionId(config);
      try {
        const response = await fetch(
          `https://api.webflow.com/v2/collections/${collectionId}/items/${articleId}`,
          { method: 'DELETE', headers: this.buildHeaders(token), signal: AbortSignal.timeout(15000) }
        );
        if (response.ok) {
          this.connectionConfigs.delete(articleId);
          return true;
        }
      } catch { /* fall through */ }
    }

    const token = process.env.WEBFLOW_API_KEY || '';
    const collectionId = process.env.WEBFLOW_COLLECTION_ID || '';
    if (token && collectionId) {
      try {
        const response = await fetch(
          `https://api.webflow.com/v2/collections/${collectionId}/items/${articleId}`,
          { method: 'DELETE', headers: this.buildHeaders(token), signal: AbortSignal.timeout(15000) }
        );
        return response.ok;
      } catch { return false; }
    }

    logger.warn('Webflow credentials not configured for delete');
    return false;
  }

  async getBlogs(): Promise<Array<{ id: number | string; title: string; handle: string }>> {
    return [{ id: 1, title: 'Blog', handle: 'blog' }];
  }

  private resolveToken(config: Record<string, unknown>): string {
    return (config.webflowToken as string) ||
      (config.apiKey as string) ||
      process.env.WEBFLOW_API_KEY ||
      '';
  }

  private resolveCollectionId(config: Record<string, unknown>): string {
    return (config.collectionId as string) ||
      process.env.WEBFLOW_COLLECTION_ID ||
      '';
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }
}

export const webflowConnector = new WebflowConnector();
