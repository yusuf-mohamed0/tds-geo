// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from '../../utils/logger';
import { ShopifyConfig } from '../../types';
import { refreshIfExpired } from './auth';
import { buildClient, getQueue } from './client';

export async function getRateLimitStatus(shopConfig: ShopifyConfig): Promise<{ calls: string | null; remaining: number | null }> {
  const config = await refreshIfExpired(shopConfig);
  const { client, shopName } = buildClient(config);
  const queue = getQueue(shopName);
  try {
    const result = await queue.schedule(() => client.get('/shop.json'));
    const headers = result.headers;
    return {
      calls: headers['x-shopify-shop-api-call-limit'] as string || null,
      remaining: headers['x-shopify-shop-api-call-limit']
        ? parseInt((headers['x-shopify-shop-api-call-limit'] as string).split('/')[0])
        : null
    };
  } catch (err) {
    logger.warn('Failed to get Shopify rate limit', { shop: shopName, error: (err as Error).message });
    return { calls: null, remaining: null };
  }
}
