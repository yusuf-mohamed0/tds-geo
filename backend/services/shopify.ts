// ──────────────────────────────────────────────
// Shopify Admin API Service
// Multi-client with BullMQ rate limiting
// ──────────────────────────────────────────────

import axios, { AxiosInstance } from 'axios';
import { logger, logActivity } from '../utils/logger';
import { ShopifyConfig } from '../types';

class ShopifyService {
  private queues = new Map<string, any>();

  private getQueue(_shopName: string): any {
    // Placeholder — in production, use the BullMQ queue system
    return {
      schedule: async <T>(fn: () => Promise<T>): Promise<T> => fn()
    };
  }

  private buildClient(shopConfig: ShopifyConfig): { client: AxiosInstance; shopName: string } {
    const shop = shopConfig.shop || process.env.SHOPIFY_DEFAULT_SHOP || '';
    const accessToken = shopConfig.accessToken || process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN || '';
    const apiVersion = shopConfig.apiVersion || process.env.SHOPIFY_DEFAULT_API_VERSION || '2024-07';

    if (!shop || !accessToken) {
      throw new Error('Shopify shop URL and access token are required');
    }

    const client = axios.create({
      baseURL: `https://${shop}/admin/api/${apiVersion}`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return { client, shopName: shop };
  }

  async fetchArticles(shopConfig: ShopifyConfig, blogId: number | null = null, options: {
    limit?: number;
    fields?: string;
  } = {}): Promise<any[]> {
    const { client, shopName } = this.buildClient(shopConfig);
    const queue = this.getQueue(shopName);
    const limit = options.limit || 50;
    const fields = options.fields || 'id,title,handle,body_html,published_at,tags';

    let allArticles: any[] = [];
    let pageInfo: string | null = null;

    try {
      do {
        const result = await queue.schedule(() => {
          const params: Record<string, any> = { limit, fields };
          if (pageInfo) params.page_info = pageInfo;
          const endpoint = blogId ? `/blogs/${blogId}/articles.json` : '/articles.json';
          return client.get(endpoint, { params });
        });

        const articles = result.data.articles || [];
        allArticles = allArticles.concat(articles);

        const linkHeader = result.headers.link as string | undefined;
        pageInfo = null;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/page_info=([^&>]+)/);
          if (match) pageInfo = match[1];
        }
      } while (pageInfo);

      logger.info(`Fetched ${allArticles.length} articles from Shopify`, { shop: shopName });
      return allArticles;
    } catch (err) {
      logger.error('Failed to fetch Shopify articles', {
        shop: shopName,
        error: (err as any).response?.data || (err as Error).message
      });
      throw err;
    }
  }

  async publishArticle(shopConfig: ShopifyConfig, blogId: number | string, article: {
    title: string;
    contentHtml: string;
    metaTitle?: string;
    metaDescription?: string;
    tags?: string[];
    author?: string;
    published?: boolean;
  }): Promise<{ id: number; blogId: number; url: string; handle: string; shopifyArticle: any }> {
    const { client, shopName } = this.buildClient(shopConfig);
    const queue = this.getQueue(shopName);

    const payload = {
      article: {
        title: article.title,
        body_html: article.contentHtml,
        tags: (article.tags || []).join(', '),
        author: article.author || 'AI SEO Agent',
        published: article.published !== false,
        published_at: article.published !== false ? new Date().toISOString() : null,
        metafields_global_title_tag: article.metaTitle || article.title,
        metafields_global_description_tag: article.metaDescription || ''
      }
    };

    try {
      logger.info('Publishing article to Shopify', { shop: shopName, blogId, title: article.title });

      const result = await queue.schedule(() =>
        client.post(`/blogs/${blogId}/articles.json`, payload)
      );

      const created = result.data.article;
      logger.info('Article published successfully', {
        shop: shopName,
        shopifyId: created.id
      });

      return {
        shopifyArticle: created,
        id: created.id,
        blogId: blogId as number,
        url: `https://${shopName}/blogs/${blogId}/${created.handle}`,
        handle: created.handle
      };
    } catch (err) {
      const errorDetail = (err as any).response?.data || (err as Error).message;
      logger.error('Failed to publish Shopify article', { shop: shopName, title: article.title, error: errorDetail });
      throw new Error(`Shopify publish failed: ${JSON.stringify(errorDetail)}`);
    }
  }

  async uploadImage(shopConfig: ShopifyConfig, articleId: number, imageUrl: string, altText: string): Promise<any> {
    const { client, shopName } = this.buildClient(shopConfig);
    const queue = this.getQueue(shopName);

    // Download the image first
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const base64Image = Buffer.from(imageResponse.data).toString('base64');
    const contentType = imageResponse.headers['content-type'] || 'image/png';

    const payload = {
      image: {
        attachment: base64Image,
        filename: `article-${articleId}-${Date.now()}.png`,
        content_type: contentType,
        alt: altText
      }
    };

    try {
      const result = await queue.schedule(() =>
        client.post(`/articles/${articleId}/images.json`, payload)
      );

      logger.info('Image uploaded to Shopify article', {
        shop: shopName,
        articleId,
        imageId: result.data.image.id
      });

      return result.data.image;
    } catch (err) {
      logger.error('Failed to upload image to Shopify', {
        shop: shopName,
        articleId,
        error: (err as any).response?.data || (err as Error).message
      });
      throw err;
    }
  }

  async fetchBlogs(shopConfig: ShopifyConfig): Promise<any[]> {
    const { client, shopName } = this.buildClient(shopConfig);
    const queue = this.getQueue(shopName);

    try {
      const result = await queue.schedule(() => client.get('/blogs.json'));
      const blogs = result.data.blogs || [];
      logger.info(`Fetched ${blogs.length} blogs from Shopify`, { shop: shopName });
      return blogs;
    } catch (err) {
      logger.error('Failed to fetch Shopify blogs', {
        shop: shopName,
        error: (err as any).response?.data || (err as Error).message
      });
      throw err;
    }
  }

  async getRateLimitStatus(shopConfig: ShopifyConfig): Promise<{ calls: string | null; remaining: number | null }> {
    const { client, shopName } = this.buildClient(shopConfig);
    try {
      const result = await client.get('/shop.json');
      const headers = result.headers;
      return {
        calls: headers['x-shopify-shop-api-call-limit'] as string || null,
        remaining: headers['x-shopify-shop-api-call-limit']
          ? parseInt((headers['x-shopify-shop-api-call-limit'] as string).split('/')[0])
          : null
      };
    } catch (err) {
      logger.error('Failed to get Shopify rate limit', { shop: shopName, error: (err as Error).message });
      return { calls: null, remaining: null };
    }
  }

  /**
   * Publish an article to Shopify with full history tracking.
   * This is the shared helper used by both the route handler and workers.
   * Requires a DB pool to record publishing history and update article status.
   */
  async publishArticleWithTracking(
    pool: any,
    client: any,
    blogId: number | string | null,
    articleId: string,
    article: { title: string; contentHtml: string; metaTitle?: string; metaDescription?: string; tags?: string[] }
  ): Promise<any> {
    const shopConfig = {
      shop: client.shopify_shop,
      accessToken: client.shopify_token,
      apiVersion: client.shopify_api_version
    };

    let targetBlogId = blogId;
    if (!targetBlogId) {
      const blogs = await this.fetchBlogs(shopConfig);
      targetBlogId = blogs[0]?.id;
      if (!targetBlogId) {
        throw new Error('No Shopify blogs found for this store');
      }
    }

    const publishResult = await this.publishArticle(shopConfig, targetBlogId, article);

    await pool.query(
      `INSERT INTO publishing_history (article_id, client_id, shopify_article_id, shopify_blog_id, published_url, status, published_at)
       VALUES ($1, $2, $3, $4, $5, 'published', NOW())`,
      [articleId, client.id, publishResult.id, targetBlogId, publishResult.url]
    );

    await pool.query(
      `UPDATE articles SET status = 'published', updated_at = NOW() WHERE id = $1`,
      [articleId]
    );

    await logActivity(pool, {
      clientId: client.id,
      action: 'article_published',
      entityType: 'article',
      entityId: articleId,
      level: 'info',
      message: `Article published to Shopify: ${article.title}`,
      metadata: { shopifyUrl: publishResult.url }
    });

    return publishResult;
  }
}

export default new ShopifyService();
