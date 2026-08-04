// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────────────────────
// Shopify article CRUD used by the ShopifyConnector.
//
// This module lives OUTSIDE content.ts (owned by the auto-publish
// lane) and reuses the same rate-limited axios client
// (buildClient + getQueue) so every Admin API call shares the
// per-shop concurrency/429 protections.
//
// Draft contract: updateArticle NEVER sets published / published_at.
// Articles stay hidden drafts until deliberately published through
// the publish path (publishArticleLive / options.publish) — see
// CLAUDE.md. The connector's update() therefore cannot publish.
// ──────────────────────────────────────────────────────────────

import { logger } from '../../utils/logger';
import { ShopifyConfig } from '../../types';
import { refreshIfExpired } from './auth';
import { buildClient, getQueue } from './client';

export async function getArticle(shopConfig: ShopifyConfig, blogId: number | string, articleId: number): Promise<any> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  try {
    const result = await queue.schedule(() => client.get(`/blogs/${blogId}/articles/${articleId}.json`));
    const article = result.data.article || null;
    logger.info('Fetched Shopify article', { shop: shopName, blogId, articleId });
    return article;
  } catch (err) {
    logger.error('Failed to get Shopify article', {
      shop: shopName,
      blogId,
      articleId,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}

export interface ArticleUpdate {
  title?: string;
  contentHtml?: string;
  summaryHtml?: string;
  tags?: string[];
  author?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export async function updateArticle(
  shopConfig: ShopifyConfig,
  blogId: number | string,
  articleId: number,
  updates: ArticleUpdate
): Promise<any> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  const payload: Record<string, any> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.contentHtml !== undefined) payload.body_html = updates.contentHtml;
  if (updates.summaryHtml !== undefined) payload.summary_html = updates.summaryHtml;
  if (updates.tags !== undefined) payload.tags = updates.tags.join(', ');
  if (updates.author !== undefined) payload.author = updates.author;
  if (updates.metaTitle !== undefined) payload.metafields_global_title_tag = updates.metaTitle;
  if (updates.metaDescription !== undefined) payload.metafields_global_description_tag = updates.metaDescription;

  // NOTE: published / published_at are intentionally never set here —
  // Shopify articles stay hidden drafts until deliberately published
  // through the publish path (see CLAUDE.md article contract).

  try {
    logger.info('Updating Shopify article', { shop: shopName, blogId, articleId, title: updates.title });

    const result = await queue.schedule(() =>
      client.put(`/blogs/${blogId}/articles/${articleId}.json`, { article: payload })
    );

    const updated = result.data.article;
    logger.info('Shopify article updated successfully', { shop: shopName, blogId, articleId });
    return updated;
  } catch (err) {
    const errorDetail = (err as any).response?.data || (err as Error).message;
    logger.error('Failed to update Shopify article', {
      shop: shopName,
      blogId,
      articleId,
      error: errorDetail
    });
    throw new Error(`Shopify article update failed: ${JSON.stringify(errorDetail)}`);
  }
}

export async function deleteArticle(shopConfig: ShopifyConfig, blogId: number | string, articleId: number): Promise<void> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  try {
    await queue.schedule(() => client.delete(`/blogs/${blogId}/articles/${articleId}.json`));
    logger.info('Shopify article deleted', { shop: shopName, blogId, articleId });
  } catch (err) {
    logger.error('Failed to delete Shopify article', {
      shop: shopName,
      blogId,
      articleId,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}

export async function getArticleImage(shopConfig: ShopifyConfig, blogId: number | string, articleId: number): Promise<any> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  try {
    const result = await queue.schedule(() => client.get(`/blogs/${blogId}/articles/${articleId}.json`));
    const image = result.data.article?.image || null;
    if (image) {
      logger.info('Fetched Shopify article image', { shop: shopName, blogId, articleId, imageId: image.id });
    }
    return image;
  } catch (err) {
    logger.error('Failed to get Shopify article image', {
      shop: shopName,
      blogId,
      articleId,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}
