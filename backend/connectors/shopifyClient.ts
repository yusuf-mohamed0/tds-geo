// ══════════════════════════════════════════════════════════════════
// TDS Geo — Shopify Client Factory
//
// Shared Axios client factory for Shopify Admin API.
// Used by the Shopify connector and any other code (OAuth routes,
// workers, etc.) that needs raw Shopify REST access.
// ══════════════════════════════════════════════════════════════════

import axios, { AxiosInstance } from 'axios';

export interface ShopifyClientConfig {
  shop?: string;
  accessToken?: string;
  apiVersion?: string;
}

export function createShopifyClient(config: ShopifyClientConfig): { client: AxiosInstance; shopName: string } {
  const shop = config.shop || process.env.SHOPIFY_DEFAULT_SHOP || '';
  const accessToken = config.accessToken || process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN || '';
  const apiVersion = config.apiVersion || process.env.SHOPIFY_DEFAULT_API_VERSION || '2024-07';

  if (!shop || !accessToken) {
    throw new Error('Shopify shop URL and access token are required');
  }

  const client = axios.create({
    baseURL: `https://${shop}/admin/api/${apiVersion}`,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  return { client, shopName: shop };
}

export function resolveShopifyConfig(config: Record<string, unknown>): ShopifyClientConfig {
  return {
    shop: (config.shop as string) || (config.shopify_shop as string) || '',
    accessToken: (config.accessToken as string) || (config.shopify_token as string) || '',
    apiVersion: (config.apiVersion as string) || (config.shopify_api_version as string) || undefined,
  };
}
