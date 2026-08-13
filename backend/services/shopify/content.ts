// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import axios from 'axios';
import { logger, logActivity } from '../../utils/logger';
import { ShopifyConfig } from '../../types';
import { refreshIfExpired } from './auth';
import { buildClient, getQueue } from './client';
import { truncateWithEllipsis, generateExcerptFromHtml } from '../../utils/stringUtils';
import { assertPublicArticleBody } from '../content/publicArticleGuard';

export function getClientDefaultBlogId(client: { settings?: unknown }): number | string | null {
  let settings: Record<string, unknown> = {};
  if (typeof client.settings === 'string') {
    try {
      settings = JSON.parse(client.settings) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (client.settings && typeof client.settings === 'object') {
    settings = client.settings as Record<string, unknown>;
  }

  const blogId = settings.shopifyBlogId ?? settings.shopify_blog_id;
  return typeof blogId === 'number' || typeof blogId === 'string' ? blogId : null;
}

export function getClientDefaultBlogHandle(client: { settings?: unknown }): string | null {
  let settings: Record<string, unknown> = {};
  if (typeof client.settings === 'string') {
    try {
      settings = JSON.parse(client.settings) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (client.settings && typeof client.settings === 'object') {
    settings = client.settings as Record<string, unknown>;
  }

  const blogHandle = settings.shopifyBlogHandle ?? settings.shopify_blog_handle;
  return typeof blogHandle === 'string' && blogHandle.trim() ? blogHandle.trim() : null;
}

function isNumericBlogId(blogId: number | string): boolean {
  return typeof blogId === 'number' || /^\d+$/.test(blogId);
}

async function resolveBlogHandle(
  shopConfig: ShopifyConfig,
  blogId: number | string,
  knownHandle?: string | null
): Promise<string> {
  if (knownHandle) return knownHandle;
  if (!isNumericBlogId(blogId)) return String(blogId);

  const blogs = await fetchBlogs(shopConfig);
  const blog = blogs.find((candidate: any) => String(candidate.id) === String(blogId));
  if (blog?.handle) return blog.handle;

  throw new Error(`Could not resolve Shopify blog handle for blog ${blogId}`);
}

function buildStorefrontArticleUrl(shopName: string, blogHandle: string, articleHandle: string): string {
  return `https://${shopName}/blogs/${blogHandle}/${articleHandle}`;
}

export async function fetchArticles(shopConfig: ShopifyConfig, blogId: number | null = null, options: {
  limit?: number;
  fields?: string;
} = {}): Promise<any[]> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);
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

// ──────────────────────────────────────────────────────────────
// SEO field limits per the article contract (see CLAUDE.md):
//   metafields_global_title_tag       — max 70 chars
//   metafields_global_description_tag — max 160 chars
//   summary_html                      — ~200 chars excerpt
// ──────────────────────────────────────────────────────────────
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 160;
const SUMMARY_MAX = 200;

export interface ShopifyArticleInput {
  title: string;
  contentHtml: string;
  metaTitle?: string;
  metaDescription?: string;
  summaryHtml?: string;
  tags?: string[];
  author?: string;
  /**
   * Legacy explicit opt-in for live publishing. Creating an article is ALWAYS
   * a hidden draft unless this (or `options.publish`) is explicitly true.
   */
  published?: boolean;
}

export interface ShopifyPublishOptions {
  /**
   * Explicit opt-in to flip the freshly created draft to LIVE after creation.
   * Defaults to false — articles are always created as hidden drafts.
   */
  publish?: boolean;
  /** Known Shopify blog handle, used to build canonical storefront URLs without another lookup. */
  blogHandle?: string;
}

export interface ShopifyArticleResult {
  id: number;
  blogId: number | string;
  blogHandle: string;
  url: string;
  handle: string;
  shopifyArticle: any;
}

/**
 * Single source of truth for live-publish intent: the explicit
 * `options.publish === true` OR the legacy `article.published === true` flag.
 * Both `publishArticle` and `publishArticleWithTracking` MUST agree on this so
 * tracking (history row + articles.status) stays consistent with the flip.
 */
function shouldPublish(article: ShopifyArticleInput, options?: ShopifyPublishOptions): boolean {
  return options?.publish === true || article.published === true;
}

function buildArticlePayload(article: ShopifyArticleInput): Record<string, unknown> {
  assertPublicArticleBody(article.contentHtml);

  const metaTitle = truncateWithEllipsis(article.metaTitle || article.title, SEO_TITLE_MAX);
  const metaDescription = truncateWithEllipsis(
    article.metaDescription || generateExcerptFromHtml(article.contentHtml, SEO_DESCRIPTION_MAX),
    SEO_DESCRIPTION_MAX
  );
  const summaryHtml = article.summaryHtml || generateExcerptFromHtml(article.contentHtml, SUMMARY_MAX);

  return {
    article: {
      title: article.title,
      body_html: article.contentHtml,
      tags: (article.tags || []).join(', '),
      author: article.author || 'AI SEO Agent',
      // Draft contract: always create as a hidden draft. Publishing to LIVE is
      // a separate, deliberate step (see publishArticleLive / options.publish).
      published: false,
      published_at: null,
      summary_html: summaryHtml,
      metafields_global_title_tag: metaTitle,
      metafields_global_description_tag: metaDescription
    }
  };
}

/**
 * Create a Shopify article. ALWAYS creates a hidden draft
 * (published:false, published_at:null) with SEO metafields and a summary,
 * unless the caller explicitly opts in to live publishing via
 * `options.publish === true` (or the legacy `article.published === true`).
 *
 * When live publishing is requested, the article is first created as a draft
 * and then flipped to live with a PUT via `publishArticleLive` — the create
 * call itself never publishes.
 */
export async function publishArticle(
  shopConfig: ShopifyConfig,
  blogId: number | string,
  article: ShopifyArticleInput,
  options?: ShopifyPublishOptions
): Promise<ShopifyArticleResult> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  const publishLive = shouldPublish(article, options);
  const payload = buildArticlePayload(article);

  try {
    logger.info('Creating Shopify article draft', { shop: shopName, blogId, title: article.title, publishLive });

    const result = await queue.schedule(() =>
      client.post(`/blogs/${blogId}/articles.json`, payload)
    );

    const created = result.data.article;
    logger.info('Shopify article draft created', {
      shop: shopName,
      shopifyId: created.id,
      title: article.title
    });

    if (publishLive) {
      // Flip the just-created draft to live — never create a live article directly.
      return publishArticleLive(shopConfig, blogId, created.id, options?.blogHandle);
    }

    const blogHandle = await resolveBlogHandle(config, blogId, options?.blogHandle);

    return {
      shopifyArticle: created,
      id: created.id,
      blogId,
      blogHandle,
      url: buildStorefrontArticleUrl(shopName, blogHandle, created.handle),
      handle: created.handle
    };
  } catch (err) {
    const errorDetail = (err as any).response?.data || (err as Error).message;
    logger.error('Failed to create Shopify article draft', { shop: shopName, title: article.title, error: errorDetail });
    throw new Error(`Shopify article draft creation failed: ${JSON.stringify(errorDetail)}`);
  }
}

/**
 * Flip an EXISTING Shopify article (a hidden draft) to LIVE via a PUT with
 * published:true. This is the only mechanism by which an article goes live —
 * creation always produces a hidden draft.
 */
export async function publishArticleLive(
  shopConfig: ShopifyConfig,
  blogId: number | string,
  shopifyArticleId: number | string,
  blogHandleHint?: string | null
): Promise<ShopifyArticleResult> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  const payload = {
    article: {
      published: true,
      published_at: new Date().toISOString()
    }
  };

  try {
    logger.info('Flipping Shopify article draft to live', {
      shop: shopName,
      blogId,
      shopifyArticleId
    });

    const result = await queue.schedule(() =>
      client.put(`/blogs/${blogId}/articles/${shopifyArticleId}.json`, payload)
    );

    const updated = result.data.article;
    const blogHandle = await resolveBlogHandle(config, blogId, blogHandleHint);
    logger.info('Shopify article published live', {
      shop: shopName,
      shopifyId: updated.id
    });

    return {
      shopifyArticle: updated,
      id: updated.id,
      blogId,
      blogHandle,
      url: buildStorefrontArticleUrl(shopName, blogHandle, updated.handle),
      handle: updated.handle
    };
  } catch (err) {
    const errorDetail = (err as any).response?.data || (err as Error).message;
    logger.error('Failed to flip Shopify article to live', {
      shop: shopName,
      blogId,
      shopifyArticleId,
      error: errorDetail
    });
    throw new Error(`Shopify live-publish failed: ${JSON.stringify(errorDetail)}`);
  }
}

export async function publishArticleWithTracking(
  pool: any,
  client: any,
  blogId: number | string | null,
  articleId: string,
  article: ShopifyArticleInput,
  options?: ShopifyPublishOptions
): Promise<any> {
  const shopConfig = {
    shop: client.shopify_shop,
    accessToken: client.shopify_token,
    apiVersion: client.shopify_api_version
  };

  let targetBlogId = blogId || getClientDefaultBlogId(client);
  let targetBlogHandle = getClientDefaultBlogHandle(client);
  if (!targetBlogId) {
    const blogs = await fetchBlogs(shopConfig);
    targetBlogId = blogs[0]?.id;
    targetBlogHandle = blogs[0]?.handle || targetBlogHandle;
    if (!targetBlogId) {
      throw new Error('No Shopify blogs found for this store');
    }
  }

  const publishLive = shouldPublish(article, options);
  const publishResult = await publishArticle(shopConfig, targetBlogId, article, {
    publish: publishLive,
    blogHandle: targetBlogHandle || options?.blogHandle,
  });

  // Draft contract: creation records a 'pending' (draft) history row with no
  // published_at. Live flipping marks the row 'published' with a timestamp.
  const historyStatus = publishLive ? 'published' : 'pending';
  await pool.query(
    `INSERT INTO publishing_history (article_id, client_id, shopify_article_id, shopify_blog_id, published_url, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [articleId, client.id, publishResult.id, targetBlogId, publishResult.url, historyStatus, publishLive ? new Date() : null]
  );

  if (publishLive) {
    await pool.query(
      `UPDATE articles SET status = 'published', published_at = NOW(), scheduled_at = NULL, updated_at = NOW() WHERE id = $1`,
      [articleId]
    );
  }

  await logActivity(pool, {
    clientId: client.id,
    action: publishLive ? 'article_published' : 'article_draft_created',
    entityType: 'article',
    entityId: articleId,
    level: 'info',
    message: publishLive
      ? `Article published to Shopify: ${article.title}`
      : `Article draft created in Shopify: ${article.title}`,
    metadata: { shopifyUrl: publishResult.url, draft: !publishLive }
  });

  return publishResult;
}

export async function uploadImage(
  shopConfig: ShopifyConfig,
  blogId: number | string,
  articleId: number | string,
  imageUrl: string,
  altText: string
): Promise<any> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const base64Image = Buffer.from(imageResponse.data).toString('base64');
  const contentType = imageResponse.headers['content-type'] || 'image/png';

  const payload = {
    article: {
      id: articleId,
      image: {
        attachment: base64Image,
        filename: `article-${articleId}-${Date.now()}.png`,
        content_type: contentType,
        alt: altText
      }
    }
  };

  try {
    const result = await queue.schedule(() =>
      client.put(`/blogs/${blogId}/articles/${articleId}.json`, payload)
    );
    const image = result.data.article?.image;

    logger.info('Image uploaded to Shopify article', {
      shop: shopName,
      blogId,
      articleId,
      imageId: image?.id
    });

    return image;
  } catch (err) {
    logger.error('Failed to upload image to Shopify', {
      shop: shopName,
      blogId,
      articleId,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}

export async function fetchBlogs(shopConfig: ShopifyConfig): Promise<any[]> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

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
