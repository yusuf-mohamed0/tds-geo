// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { encrypt, mask } from '../services/credentialEncryption';

dotenv.config({ path: process.env.DOTENV_PATH || process.cwd() + '/.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_seo_automation' });

interface CredInput {
  category: string;
  service: string;
  label: string;
  url?: string;
  username: string;
  password: string;
}

function hasEntry(arr: any[], label: string, service: string): boolean {
  return arr.some((e: any) => e.label === label && e.service === service);
}

async function main() {
  // 1. Read existing vault entries to avoid dupes
  const existing = await pool.query(
    "SELECT id, service, label, masked_username, masked_password, username, password FROM credential_vault WHERE deleted_at IS NULL"
  );
  const existingLookup = existing.rows;
  console.log(`Existing vault entries: ${existingLookup.length}`);

  // 2. Clean up corrupted entries + generic placeholder entries
  const corrupted = existingLookup.filter((r: any) =>
    r.label.includes('|') || r.label.includes('Role') || r.label.includes('Display Name') ||
    (r.username && (r.username.length < 5 || r.username.includes('|'))) ||
    (r.service === 'openai' && r.label === 'OpenAI API') ||
    (r.service === 'boston-pharma' && r.label === 'Contact info') ||
    (r.service === 'boston-vet' && r.label === 'Contact info')
  );
  console.log(`Corrupted entries to remove: ${corrupted.length}`);
  for (const c of corrupted) {
    console.log(`  Deleting: [${c.service}] ${c.label}`);
    await pool.query("UPDATE credential_vault SET deleted_at = NOW() WHERE id = $1", [c.id]);
  }

  // Re-read existing after cleanup
  const remaining = await pool.query(
    "SELECT id, service, label FROM credential_vault WHERE deleted_at IS NULL"
  );
  const existingLookup2 = remaining.rows;

  const allCreds: CredInput[] = [];

  // 3. Import from api_keys table (OpenAI + Shopify for all clients)
  try {
    const tableExists = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') as exist"
    );
    if (tableExists.rows[0].exist) {
      const keys = await pool.query(`
        SELECT ak.client_id, c.name as client_name, c.slug,
               ak.key_value, ak.label, ak.service
        FROM api_keys ak
        LEFT JOIN clients c ON c.id = ak.client_id
        ORDER BY c.name
      `);
      console.log(`\nAPI keys found: ${keys.rows.length}`);

      for (const k of keys.rows) {
        const svc = k.slug || 'unknown';
        const name = k.client_name || svc;
        const serviceType = (k.service || '').toLowerCase();

        if ((serviceType === 'openai' || serviceType === 'ai' || serviceType === 'llm') && k.key_value) {
          if (!hasEntry(existingLookup2, `${name} — OpenAI API`, svc)) {
            allCreds.push({ category: 'api', service: svc, label: `${name} — OpenAI API`, username: k.key_value, password: '' });
          }
        }
        if ((serviceType === 'shopify' || serviceType === 'ecommerce') && k.key_value && k.key_value.startsWith('shpat')) {
          if (!hasEntry(existingLookup2, `${name} — Shopify Token`, svc)) {
            allCreds.push({ category: 'api', service: svc, label: `${name} — Shopify Token`, username: k.key_value, password: '' });
          }
        }
      }
    }
  } catch { console.log('(api_keys table not available, skipping)'); }

  // 4. Import from shopify_sessions
  try {
    const sessionTable = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shopify_sessions') as exist"
    );
    if (sessionTable.rows[0].exist) {
      const sessions = await pool.query('SELECT shop, access_token FROM shopify_sessions WHERE access_token IS NOT NULL');
      for (const s of sessions.rows) {
        const svc = s.shop.replace('.myshopify.com', '').replace(/\..+$/, '');
        if (!hasEntry(existingLookup2, `Shopify OAuth — ${s.shop}`, svc)) {
          allCreds.push({ category: 'api', service: svc, label: `Shopify OAuth — ${s.shop}`, username: s.access_token, password: '', url: `https://${s.shop}` });
        }
      }
    }
  } catch { console.log('(shopify_sessions table not available, skipping)'); }

  // 5. System credentials
  const systemCreds: CredInput[] = [
    { category: 'database', service: 'system', label: 'PostgreSQL — ai_seo_automation', username: 'postgres', password: 'postgres' },
    { category: 'database', service: 'system', label: 'PostgreSQL Connection String', username: 'postgresql://postgres:postgres@localhost:5432/ai_seo_automation', password: '' },
    { category: 'api', service: 'system', label: 'JWT Secret', username: 'dev-jwt-secret-change-in-production', password: '' },
    { category: 'api', service: 'system', label: 'Shopify API Key (hardcoded fallback)', username: 'a178c8740049e04eec663378b6e30ad8', password: '' },
    { category: 'api', service: 'system', label: 'Credential Vault Encryption Key', username: process.env.CREDENTIAL_VAULT_KEY || '', password: '' },
  ];
  for (const sc of systemCreds) {
    if (sc.username && !hasEntry(existingLookup2, sc.label, sc.service)) {
      allCreds.push(sc);
    }
  }

  // 6. Doc-based credentials (from doc/clients/*/contacts.md and technical-reference.md)
  const docCreds: CredInput[] = [
    // boston-pharma
    { category: 'api', service: 'boston-pharma', label: 'Kivo Geo API Key', username: 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Google Ads Conversion ID', username: 'AW-16695363279', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Google Tag Manager ID', username: 'GT-KTTRZ642', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Google Site Verification', username: 'iUvCHIei4OHpJKf9Dt6KW5ZkUfgkFMzH8iBxR4GZIlM', password: '' },
    { category: 'database', service: 'boston-pharma', label: 'MySQL DB Prefix', username: 'wp_8n1vqj9f85_', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Phone — General', username: '+20 15 01000681', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Phone — Alternate', username: '+20 1550643720', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Contact — Info Email', username: 'info@bostongroup-eg.com', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Contact — Export Email', username: 'export@bostongroup-eg.com', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Contact — TDS Web Dev', username: 'web.development@trafficdigitalsolutions.com', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'REST API Base URL', username: 'https://boston-pharma.com/wp-json/kivo/v1', password: '' },
    { category: 'other', service: 'boston-pharma', label: 'Webhook URL', username: 'https://boston-pharma.com/wp-json/kivo/v1/webhook', password: '' },
    // boston-vet
    { category: 'api', service: 'boston-vet', label: 'Kivo Geo API Key', username: 'kai_46f0d5d6cf30f13fd45463d8082e645323ead5c731b1b58f', password: '' },
    { category: 'other', service: 'boston-vet', label: 'Contact — TDS Web Dev', username: 'web.development@trafficdigitalsolutions.com', password: '' },
  ];

  for (const dc of docCreds) {
    if (!hasEntry(existingLookup2, dc.label, dc.service)) {
      allCreds.push(dc);
    }
  }

  // 7. Seed data users
  const seedUsers: CredInput[] = [
    { category: 'other', service: 'system', label: 'Admin Panel — super_admin', username: 'admin@kivo.internal', password: 'TDSg30!Pr0d#2026_X9', url: '' },
    { category: 'other', service: 'system', label: 'Admin Panel — editor', username: 'editor@kivo.internal', password: 'Ed1t0r!TDS#2026_X9', url: '' },
  ];
  for (const su of seedUsers) {
    if (!hasEntry(existingLookup2, su.label, su.service)) {
      allCreds.push(su);
    }
  }

  // 8. Insert all new credentials
  let inserted = 0;
  for (const cred of allCreds) {
    const eu = cred.username ? encrypt(cred.username) : '';
    const ep = cred.password ? encrypt(cred.password) : '';
    const mu = cred.username ? mask(cred.username) : '';
    const mp = cred.password ? mask(cred.password) : '';
    await pool.query(
      `INSERT INTO credential_vault (category, service, label, url, username, password, masked_username, masked_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [cred.category, cred.service, cred.label, cred.url || '', eu, ep, mu, mp]
    );
    inserted++;
  }
  console.log(`\nInserted ${inserted} new credentials`);

  // 9. Final summary
  const final = await pool.query(
    "SELECT category, service, label FROM credential_vault WHERE deleted_at IS NULL ORDER BY service, category, label"
  );
  console.log(`\n=== FINAL VAULT: ${final.rows.length} credentials ===`);
  for (const r of final.rows) {
    console.log(`  [${r.category}] ${r.service} — ${r.label}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
