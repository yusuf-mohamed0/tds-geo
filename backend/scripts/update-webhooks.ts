// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { config } from 'dotenv';
import { resolve } from 'path';
import { Pool } from 'pg';
import { SHOPIFY_COMPLIANCE_WEBHOOKS } from '../utils/shopifyWebhook';

config({ path: resolve(__dirname, '../../.env') });

const APP_URL = (process.env.SHOPIFY_APP_URL || 'https://16.192.29.174.nip.io').replace(/\/$/, '');
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-07';
const DRY_RUN = process.argv.includes('--dry-run');
const SHOP_FILTER = valueAfter('--shop');
const TOKEN_FILTER = valueAfter('--token');

interface ShopifyStore {
  shop: string;
  accessToken: string;
  clientId?: string;
}

interface ShopifyWebhook {
  id: number | string;
  topic: string;
  address: string;
}

async function main() {
  const stores = await loadStores();
  if (stores.length === 0) {
    console.log('No Shopify stores found for webhook update.');
    return;
  }

  let failures = 0;
  for (const store of stores) {
    const ok = await updateStoreWebhooks(store);
    if (!ok) failures++;
  }

  if (failures > 0) {
    console.error(`Webhook update completed with ${failures} store failure${failures === 1 ? '' : 's'}.`);
    process.exit(1);
  }
}

async function loadStores(): Promise<ShopifyStore[]> {
  if (SHOP_FILTER && TOKEN_FILTER) {
    return [{ shop: normalizeShop(SHOP_FILTER), accessToken: TOKEN_FILTER }];
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required, or pass both --shop <shop> and --token <access-token>.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const { rows } = await pool.query(
      `SELECT id, shopify_shop, shopify_token
       FROM clients
       WHERE is_active = true
         AND shopify_shop IS NOT NULL
         AND shopify_shop ILIKE '%.myshopify.com'
         AND shopify_token IS NOT NULL
       ORDER BY shopify_shop`
    );
    return rows.map((row) => ({
      clientId: row.id,
      shop: normalizeShop(row.shopify_shop),
      accessToken: row.shopify_token,
    }));
  } finally {
    await pool.end();
  }
}

async function updateStoreWebhooks(store: ShopifyStore): Promise<boolean> {
  const desired = SHOPIFY_COMPLIANCE_WEBHOOKS.filter(({ topic }) => topic === 'app/uninstalled').map(({ topic, path }) => ({
    topic,
    address: `${APP_URL}${path}`,
  }));
  const baseUrl = `https://${store.shop}/admin/api/${API_VERSION}`;

  console.log(`\n${DRY_RUN ? '[dry-run] ' : ''}Updating compliance webhooks for ${store.shop}`);
  console.log('  Note: privacy compliance topics are managed by shopify.app*.toml app configuration deploys.');

  try {
    const existing = await fetchWebhooks(baseUrl, store.accessToken);
    for (const target of desired) {
      const topicHooks = existing.filter((hook) => hook.topic === target.topic);
      const exact = topicHooks.find((hook) => hook.address === target.address);

      if (exact) {
        console.log(`  ✓ ${target.topic} already points to ${target.address}`);
        continue;
      }

      const hookToUpdate = topicHooks[0];
      if (hookToUpdate) {
        await updateWebhook(baseUrl, store.accessToken, hookToUpdate.id, target.address, target.topic);
      } else {
        await createWebhook(baseUrl, store.accessToken, target.topic, target.address);
      }
    }
    return true;
  } catch (err) {
    console.error(`  ✗ ${store.shop}: ${(err as Error).message}`);
    return false;
  }
}

async function fetchWebhooks(baseUrl: string, accessToken: string): Promise<ShopifyWebhook[]> {
  const response = await fetch(`${baseUrl}/webhooks.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  if (!response.ok) throw new Error(`Failed to list webhooks (${response.status}): ${await response.text()}`);
  const data = await response.json() as { webhooks?: ShopifyWebhook[] };
  return data.webhooks || [];
}

async function updateWebhook(baseUrl: string, accessToken: string, id: string | number, address: string, topic: string) {
  console.log(`  → ${topic}: update webhook ${id} to ${address}`);
  if (DRY_RUN) return;

  const response = await fetch(`${baseUrl}/webhooks/${id}.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook: { id, address, format: 'json' } }),
  });
  if (!response.ok) throw new Error(`Failed to update ${topic} (${response.status}): ${await response.text()}`);
  console.log(`  ✓ ${topic} updated`);
}

async function createWebhook(baseUrl: string, accessToken: string, topic: string, address: string) {
  console.log(`  → ${topic}: create ${address}`);
  if (DRY_RUN) return;

  const response = await fetch(`${baseUrl}/webhooks.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
  });
  if (!response.ok) throw new Error(`Failed to create ${topic} (${response.status}): ${await response.text()}`);
  console.log(`  ✓ ${topic} created`);
}

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeShop(shop: string): string {
  return shop.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
