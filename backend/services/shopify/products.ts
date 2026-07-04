import { logger } from '../../utils/logger';
import { ShopifyConfig } from '../../types';
import { refreshIfExpired } from './auth';
import { buildClient, getQueue } from './client';

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
    if (updates.metaTitle) {
      await upsertMetafield(client, queue, productId, 'global', 'title_tag', updates.metaTitle);
    }
    if (updates.metaDescription) {
      await upsertMetafield(client, queue, productId, 'global', 'description_tag', updates.metaDescription);
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
