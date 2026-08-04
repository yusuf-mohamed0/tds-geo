// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from '../../utils/logger';
import { ShopifyConfig } from '../../types';
import { refreshIfExpired } from './auth';
import { buildClient, getQueue } from './client';
import { truncateWithEllipsis } from '../../utils/stringUtils';

export interface ShopifyProductUpdate {
  title?: string;
  bodyHtml?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string;
  vendor?: string;
  productType?: string;
}

export async function fetchProducts(
  shopConfig: ShopifyConfig,
  options: { limit?: number; fields?: string } = {}
): Promise<any[]> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);
  const limit = options.limit || 50;
  const fields = options.fields || 'id,title,handle,body_html,product_type,vendor,tags,status,published_at';

  let allProducts: any[] = [];
  let pageInfo: string | null = null;

  try {
    do {
      const result = await queue.schedule(() => {
        const params: Record<string, any> = { limit, fields };
        if (pageInfo) params.page_info = pageInfo;
        return client.get('/products.json', { params });
      });

      const products = result.data.products || [];
      allProducts = allProducts.concat(products);

      const linkHeader = result.headers.link as string | undefined;
      pageInfo = null;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^&>]+)/);
        if (match) pageInfo = match[1];
      }
    } while (pageInfo);

    logger.info(`Fetched ${allProducts.length} products from Shopify`, { shop: shopName });
    return allProducts;
  } catch (err) {
    logger.error('Failed to fetch Shopify products', {
      shop: shopName,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}

export async function updateProduct(
  shopConfig: ShopifyConfig,
  productId: number,
  updates: ShopifyProductUpdate
): Promise<any> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  const payload: Record<string, any> = {};

  if (updates.title) payload.title = updates.title;
  if (updates.bodyHtml !== undefined) payload.body_html = updates.bodyHtml;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.vendor !== undefined) payload.vendor = updates.vendor;
  if (updates.productType !== undefined) payload.product_type = updates.productType;

  try {
    logger.info('Updating Shopify product', { shop: shopName, productId, title: updates.title });

    const result = await queue.schedule(() =>
      client.put(`/products/${productId}.json`, { product: payload })
    );

    const updated = result.data.product;

    // Set SEO metafields via Metafield API (namespace: global, key: title_tag / description_tag)
    // Title tag is capped at 70 chars, description tag at 160 chars (shared SEO helper).
    if (updates.metaTitle) {
      await upsertMetafield(client, queue, productId, 'global', 'title_tag', truncateWithEllipsis(updates.metaTitle, 70));
    }
    if (updates.metaDescription) {
      await upsertMetafield(client, queue, productId, 'global', 'description_tag', truncateWithEllipsis(updates.metaDescription, 160));
    }

    logger.info('Product updated successfully', { shop: shopName, productId });
    return updated;
  } catch (err) {
    const errorDetail = (err as any).response?.data || (err as Error).message;
    logger.error('Failed to update Shopify product', {
      shop: shopName,
      productId,
      error: errorDetail
    });
    throw new Error(`Shopify product update failed: ${JSON.stringify(errorDetail)}`);
  }
}

async function upsertMetafield(
  client: any,
  queue: any,
  productId: number,
  namespace: string,
  key: string,
  value: string
): Promise<void> {
  try {
    // Find existing metafield
    const existing = await queue.schedule(() =>
      client.get(`/products/${productId}/metafields.json`, {
        params: { namespace, key }
      })
    );

    const metafield = (existing.data.metafields || [])[0];
    const body = {
      metafield: {
        namespace,
        key,
        value,
        type: 'single_line_text_field',
      }
    };

    if (metafield) {
      await queue.schedule(() =>
        client.put(`/products/${productId}/metafields/${metafield.id}.json`, body)
      );
    } else {
      await queue.schedule(() =>
        client.post(`/products/${productId}/metafields.json`, body)
      );
    }
  } catch (err) {
    logger.warn('Failed to set SEO metafield', {
      productId, namespace, key,
      error: (err as any).response?.data || (err as Error).message,
    });
  }
}

export async function getProduct(
  shopConfig: ShopifyConfig,
  productId: number,
  fields?: string
): Promise<any> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  try {
    const params: Record<string, any> = {};
    if (fields) params.fields = fields;

    const result = await queue.schedule(() =>
      client.get(`/products/${productId}.json`, { params })
    );

    return result.data.product;
  } catch (err) {
    logger.error('Failed to get Shopify product', {
      shop: shopName,
      productId,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}

/**
 * Fetch EVERY page of a collections endpoint via Link-header pagination
 * (limit=250, page_info), mirroring the fetchProductTags pattern. Stores with
 * more than 250 collections would otherwise be silently truncated.
 */
async function fetchAllCollectionPages(
  queue: any,
  client: any,
  endpoint: string,
  dataKey: 'smart_collections' | 'custom_collections',
  params: Record<string, any>
): Promise<any[]> {
  let allCollections: any[] = [];
  let pageInfo: string | null = null;

  do {
    const requestParams = { ...params };
    if (pageInfo) requestParams.page_info = pageInfo;

    const result = await queue.schedule(() => client.get(endpoint, { params: requestParams }));
    allCollections = allCollections.concat(result.data[dataKey] || []);

    const linkHeader = result.headers.link as string | undefined;
    pageInfo = null;
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/page_info=([^&>]+)/);
      if (match) pageInfo = match[1];
    }
  } while (pageInfo);

  return allCollections;
}

export async function fetchCollections(shopConfig: ShopifyConfig): Promise<any[]> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  try {
    const fields = 'id,title,handle,products_count,updated_at';
    const params = { fields, limit: 250 };

    const [smartCollections, customCollections] = await Promise.all([
      fetchAllCollectionPages(queue, client, '/smart_collections.json', 'smart_collections', params),
      fetchAllCollectionPages(queue, client, '/custom_collections.json', 'custom_collections', params),
    ]);

    const collections = [...smartCollections, ...customCollections];

    logger.info(`Fetched ${collections.length} collections from Shopify`, { shop: shopName });
    return collections;
  } catch (err) {
    logger.error('Failed to fetch Shopify collections', {
      shop: shopName,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}

export interface ProductTag {
  tag: string;
  count: number;
}

export async function fetchProductTags(shopConfig: ShopifyConfig): Promise<ProductTag[]> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);

  const tagCounts = new Map<string, number>();
  let pageInfo: string | null = null;

  try {
    do {
      const result = await queue.schedule(() => {
        const params: Record<string, any> = { fields: 'tags', limit: 250 };
        if (pageInfo) params.page_info = pageInfo;
        return client.get('/products.json', { params });
      });

      const products = result.data.products || [];
      for (const product of products) {
        const tags = String(product.tags || '')
          .split(',')
          .map((tag: string) => tag.trim())
          .filter(Boolean);
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      const linkHeader = result.headers.link as string | undefined;
      pageInfo = null;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^&>]+)/);
        if (match) pageInfo = match[1];
      }
    } while (pageInfo);

    const tags = Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count }));
    logger.info(`Aggregated ${tags.length} tags from Shopify products`, { shop: shopName });
    return tags;
  } catch (err) {
    logger.error('Failed to aggregate Shopify product tags', {
      shop: shopName,
      error: (err as any).response?.data || (err as Error).message
    });
    throw err;
  }
}
