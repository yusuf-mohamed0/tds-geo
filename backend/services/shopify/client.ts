import axios, { AxiosInstance } from 'axios';
import { ShopifyConfig } from '../../types';

export function buildClient(shopConfig: ShopifyConfig): { client: AxiosInstance; shopName: string } {
  const shop = shopConfig.shop || process.env.SHOPIFY_DEFAULT_SHOP || '';
  const accessToken = shopConfig.accessToken || process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN || '';
  const apiVersion = shopConfig.apiVersion || process.env.SHOPIFY_DEFAULT_API_VERSION || '2025-07';

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

export function getQueue(_shopName: string): any {
  return {
    schedule: async <T>(fn: () => Promise<T>): Promise<T> => fn()
  };
}
