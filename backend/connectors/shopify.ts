// ══════════════════════════════════════════════════════════════════
// KOZMO Core — Shopify Connector
//
// Publishes/updates/deletes articles to Shopify blogs
// via the Shopify Admin REST API.
// ══════════════════════════════════════════════════════════════════

import { Article, PublishResult, PublisherAdapter } from '../types';
import { logger } from '../utils/logger';
import { createShopifyClient, resolveShopifyConfig } from './shopifyClient';

export class ShopifyConnector implements PublisherAdapter {
  readonly provider = 'shopify' as const;
  readonly name = 'Shopify Online Store 2.0';
  readonly capabilities = {
    supportsMedia: true,
    supportsTags: true,
    supportsCustomFields: false,
    supportsScheduling: true,
    supportsMultipleAuthors: false,
    maxTitleLength: 255,
    contentFormat: 'html' as const,
  };

  private connectionConfigs: Map<string, Record<string, unknown>> = new Map();

  async testConnection(): Promise<boolean> {
    try {
      const cfg = resolveShopifyConfig({});
      const { client } = createShopifyClient(cfg);
      await client.get('/shop.json');
      return true;
    } catch {
      return false;
    }
  }

  async publish(article: Article, config: Record<string, unknown>): Promise<PublishResult> {
    const cfg = resolveShopifyConfig(config);
    const { client, shopName } = createShopifyClient(cfg);
    const blogId = (config.blogId as number) || 1;

    const payload = {
      article: {
        title: article.title,
        body_html: article.content_html || article.content_md || '',
        tags: (article.tags || []).join(', '),
        published: config.publishImmediately !== false,
        published_at: config.publishImmediately !== false ? new Date().toISOString() : null,
        metafields_global_title_tag: article.meta_title || article.title,
        metafields_global_description_tag: article.meta_description || '',
      },
    };

    try {
      const result = await client.post(`/blogs/${blogId}/articles.json`, payload);
      const created = result.data.article;

      this.connectionConfigs.set(created.id.toString(), config);

      return {
        id: created.id,
        blogId: blogId,
        url: `https://${shopName}/blogs/${blogId}/${created.handle}`,
        handle: created.handle,
      };
    } catch (err) {
      const errorDetail = (err as any).response?.data || (err as Error).message;
      logger.error('Shopify publish failed', { shop: shopName, title: article.title, error: errorDetail });
      throw new Error(`Shopify publish failed: ${JSON.stringify(errorDetail)}`);
    }
  }

  async update(articleId: string, article: Partial<Article>): Promise<PublishResult> {
    const config = this.connectionConfigs.get(articleId) || {};
    const cfg = resolveShopifyConfig(config);
    const { client, shopName } = createShopifyClient(cfg);

    const payload: Record<string, unknown> = {
      article: {} as Record<string, unknown>,
    };
    const articlePayload = payload.article as Record<string, unknown>;

    if (article.title) articlePayload.title = article.title;
    if (article.content_html || article.content_md) articlePayload.body_html = article.content_html || article.content_md;
    if (article.tags) articlePayload.tags = article.tags.join(', ');
    if (article.meta_title) articlePayload.metafields_global_title_tag = article.meta_title;
    if (article.meta_description) articlePayload.metafields_global_description_tag = article.meta_description;

    try {
      const result = await client.put(`/articles/${articleId}.json`, payload);
      const updated = result.data.article;

      this.connectionConfigs.delete(articleId);

      return {
        id: updated.id,
        blogId: 0,
        url: `https://${shopName}/blogs/${updated.blog_id}/${updated.handle}`,
        handle: updated.handle,
      };
    } catch (err) {
      const errorDetail = (err as any).response?.data || (err as Error).message;
      throw new Error(`Shopify update failed: ${JSON.stringify(errorDetail)}`);
    }
  }

  async delete(articleId: string): Promise<boolean> {
    const config = this.connectionConfigs.get(articleId) || {};

    if (Object.keys(config).length > 0) {
      const cfg = resolveShopifyConfig(config);
      const { client } = createShopifyClient(cfg);
      try {
        await client.delete(`/articles/${articleId}.json`);
        this.connectionConfigs.delete(articleId);
        return true;
      } catch { /* fall through */ }
    }

    const cfg = resolveShopifyConfig({});
    try {
      const { client } = createShopifyClient(cfg);
      await client.delete(`/articles/${articleId}.json`);
      return true;
    } catch {
      logger.warn('Shopify credentials not configured for delete');
      return false;
    }
  }

  async getBlogs(): Promise<Array<{ id: number | string; title: string; handle: string }>> {
    const cfg = resolveShopifyConfig({});
    const { client } = createShopifyClient(cfg);
    const result = await client.get('/blogs.json');
    return (result.data.blogs || []).map((b: any) => ({ id: b.id, title: b.title, handle: b.handle }));
  }
}

export const shopifyConnector = new ShopifyConnector();
