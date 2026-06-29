import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env') });

const SHOP = 'traffic-test.myshopify.com';
const TOKEN = process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN;
const NEW_URL = 'https://13.51.207.126.nip.io/api/webhooks/compliance';
const API_VERSION = '2024-07';
const COMPLIANCE_TOPICS = ['customers/redact', 'customers/data_request', 'shop/redact'];

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

  const toUpdate = webhooks.filter((w: any) =>
    COMPLIANCE_TOPICS.includes(w.topic) && w.address !== NEW_URL
  );

  if (toUpdate.length === 0) {
    console.log('No compliance webhooks need updating');
    return;
  }

  for (const w of toUpdate) {
    console.log(`Updating ${w.topic}: ${w.address} → ${NEW_URL}`);
    const updateRes = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/webhooks/${w.id}.json`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook: { id: w.id, address: NEW_URL } }),
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
