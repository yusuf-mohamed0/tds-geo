// ══════════════════════════════════════════════════════════════════
// TDS Geo — Ghost Connector
//
// Publishes/updates/deletes articles to Ghost sites
// via the Ghost Admin API.
// ══════════════════════════════════════════════════════════════════

import { Article, PublishResult, PublisherAdapter } from '../types';
import { logger } from '../utils/logger';
import { generateSlug } from '../utils/stringUtils';

export class GhostConnector implements PublisherAdapter {
  readonly provider = 'ghost' as const;
  readonly name = 'Ghost';
  readonly capabilities = {
    supportsMedia: true,
    supportsTags: true,
    supportsCustomFields: false,
    supportsScheduling: true,
    supportsMultipleAuthors: true,
    maxTitleLength: 200,
    contentFormat: 'markdown' as const,
  };

  private connectionConfigs: Map<string, Record<string, unknown>> = new Map();

  async testConnection(): Promise<boolean> {
    const ghostUrl = process.env.GHOST_API_URL || '';
    const ghostKey = process.env.GHOST_ADMIN_API_KEY || '';
    if (!ghostUrl || !ghostKey) return false;
    try {
      const response = await fetch(`${ghostUrl.replace(/\/$/, '')}/ghost/api/admin/posts/?limit=1`, {
        headers: { Authorization: `Ghost ${ghostKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async publish(article: Article, config: Record<string, unknown>): Promise<PublishResult> {
    const { ghostUrl, ghostKey } = this.resolveConfig(config);

    const response = await fetch(`${ghostUrl}/ghost/api/admin/posts/`, {
      method: 'POST',
      headers: this.buildHeaders(ghostKey),
      body: JSON.stringify({
        posts: [{
          title: article.title,
          slug: article.slug || (article.title ? generateSlug(article.title) : ''),
          html: article.content_html || `<p>${article.content_md}</p>`,
          status: (config.status as string) || 'draft',
          tags: (article.tags || []).map(t => typeof t === 'string' ? { name: t } : t),
          meta_title: article.meta_title,
          meta_description: article.meta_description,
          featured_image: (config.featured_image_url as string) || '',
          published_at: (config.publish_date as string) || undefined,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Ghost publish failed', {
        status: response.status,
        error: errorText.slice(0, 500),
        title: article.title,
      });
      throw new Error(`Ghost publish failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const post = data.posts?.[0] || data;
    const postId = post.id || '';
    this.connectionConfigs.set(postId, config);

    return { id: Number(postId), blogId: 1, url: `/${post.slug}`, handle: post.slug };
  }

  async update(articleId: string, article: Partial<Article>): Promise<PublishResult> {
    const config = this.connectionConfigs.get(articleId) || {};
    const { ghostUrl, ghostKey } = this.resolveConfig(config);

    const body: Record<string, unknown> = {
      posts: [{
        id: articleId,
        ...(article.title && { title: article.title }),
        ...(article.slug && { slug: article.slug }),
        ...((article.content_html || article.content_md) && { html: article.content_html || `<p>${article.content_md}</p>` }),
        ...(article.meta_title && { meta_title: article.meta_title }),
        ...(article.meta_description && { meta_description: article.meta_description }),
      }],
    };

    const response = await fetch(`${ghostUrl}/ghost/api/admin/posts/${articleId}/`, {
      method: 'PUT',
      headers: this.buildHeaders(ghostKey),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ghost update failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    this.connectionConfigs.delete(articleId);
    const data: any = await response.json();
    const post = data.posts?.[0] || data;

    return { id: Number(post.id), blogId: 1, url: `/${post.slug}`, handle: post.slug };
  }

  async delete(articleId: string): Promise<boolean> {
    const config = this.connectionConfigs.get(articleId) || {};

    if (Object.keys(config).length > 0) {
      const { ghostUrl, ghostKey } = this.resolveConfig(config);
      try {
        const response = await fetch(`${ghostUrl}/ghost/api/admin/posts/${articleId}/`, {
          method: 'DELETE',
          headers: this.buildHeaders(ghostKey),
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) {
          this.connectionConfigs.delete(articleId);
          return true;
        }
      } catch { /* fall through */ }
    }

    const ghostUrl = process.env.GHOST_API_URL || '';
    const ghostKey = process.env.GHOST_ADMIN_API_KEY || '';
    if (ghostUrl && ghostKey) {
      try {
        const response = await fetch(`${ghostUrl}/ghost/api/admin/posts/${articleId}/`, {
          method: 'DELETE',
          headers: this.buildHeaders(ghostKey),
          signal: AbortSignal.timeout(15000),
        });
        return response.ok;
      } catch { return false; }
    }

    logger.warn('Ghost credentials not configured for delete');
    return false;
  }

  async getBlogs(): Promise<Array<{ id: number | string; title: string; handle: string }>> {
    return [{ id: 1, title: 'Blog', handle: 'blog' }];
  }

  private resolveConfig(config: Record<string, unknown>): { ghostUrl: string; ghostKey: string } {
    return {
      ghostUrl: ((config.ghostUrl as string) || process.env.GHOST_API_URL || '').replace(/\/$/, ''),
      ghostKey: (config.ghostKey as string) || (config.apiKey as string) || process.env.GHOST_ADMIN_API_KEY || '',
    };
  }

  private buildHeaders(ghostKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Ghost ${ghostKey}`,
    };
  }
}

export const ghostConnector = new GhostConnector();
