// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { config } from 'dotenv';
import { resolve } from 'path';
import { SHOPIFY_COMPLIANCE_WEBHOOKS } from '../utils/shopifyWebhook';

config({ path: resolve(__dirname, '../../.env') });

const SHOP = process.env.SHOPIFY_SHOP || 'traffic-test.myshopify.com';
const TOKEN = process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN;
const APP_URL = process.env.SHOPIFY_APP_URL || 'https://16.192.29.174.nip.io';
const API_VERSION = '2025-07';

async function main() {
  if (!TOKEN) {
    console.error('SHOPIFY_DEFAULT_ACCESS_TOKEN not set');
    process.exit(1);
  }

  // Fetch all webhooks
  const listRes = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/webhooks.json`, {
    headers: { 'X-Shopify-Access-Token': TOKEN },
  });
  const { webhooks } = await listRes.json() as any;

  const desiredAddresses = new Map(
    SHOPIFY_COMPLIANCE_WEBHOOKS.map(({ topic, path }) => [topic, `${APP_URL}${path}`])
  );

  const toUpdate = webhooks.filter((w: any) => desiredAddresses.get(w.topic) && w.address !== desiredAddresses.get(w.topic));

  if (toUpdate.length === 0) {
    console.log('No compliance webhooks need updating');
    return;
  }

  for (const w of toUpdate) {
    const address = desiredAddresses.get(w.topic);
    if (!address) continue;

    console.log(`Updating ${w.topic}: ${w.address} → ${address}`);
    const updateRes = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/webhooks/${w.id}.json`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook: { id: w.id, address } }),
    });
    if (updateRes.ok) {
      console.log(`  ✓ ${w.topic} updated`);
    } else {
      const err = await updateRes.text();
      console.error(`  ✗ ${w.topic} failed: ${err.substring(0, 200)}`);
    }
  }
}

main().catch(console.error);
