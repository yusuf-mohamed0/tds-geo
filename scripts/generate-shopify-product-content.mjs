// ══════════════════════════════════════════════════════════════════
// TDS Geo — Shopify Product Content Generator
// Generates SEO product descriptions + meta for Shopify stores
// ══════════════════════════════════════════════════════════════════

import 'dotenv/config';
import pg from 'pg';
import { Ollama } from 'ollama';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || '';
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'ministral-3:14b';

function log(level, msg, data = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data }));
}

let ollamaClient = null;
function getOllamaClient() {
  if (ollamaClient) return ollamaClient;
  const host = OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  if (OLLAMA_API_KEY) {
    const originalFetch = globalThis.fetch;
    ollamaClient = new Ollama({
      host,
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('Authorization', `Bearer ${OLLAMA_API_KEY}`);
        return originalFetch(input, { ...init, headers });
      },
    });
  } else {
    ollamaClient = new Ollama({ host });
  }
  return ollamaClient;
}

async function callAI(systemPrompt, userPrompt) {
  const client = getOllamaClient();
  const response = await client.chat({
    model: OLLAMA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    options: { num_predict: 2000, temperature: 0.7 },
    format: 'json',
  });
  return response.message.content;
}

function extractJSON(text) {
  text = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
  const m = text.match(/{[\s\S]*}/);
  if (!m) return null;
  text = m[0];
  text = text.replace(/:\s*"([^"]*)"/g, (_, c) => ': "' + c.replace(/\n/g, ' ').replace(/\r/g, '') + '"');
  text = text.replace(/,\s*([}\]])/g, '$1');
  text = text.replace(/\n\s*/g, ' ');
  try { return JSON.parse(text); } catch { return null; }
}

const DESCRIPTION_PROMPT = `You are a senior e-commerce copywriter. Return ONLY valid JSON, no markdown:
{
  "description": "HTML product description with <h2> sections. 300-500 words.",
  "metaTitle": "SEO title max 60 chars",
  "metaDescription": "Meta description max 155 chars",
  "tags": "comma, separated, tags"
}`;

function buildPrompt(product) {
  return `Generate SEO product content for:
Title: ${product.title}
Type: ${product.product_type || 'Product'}
Vendor: ${product.vendor || ''}
Tags: ${product.tags || ''}
Existing description: ${(product.body_html || '').replace(/<[^>]+>/g, '').slice(0, 200) || 'none'}`;
}

async function getShopifyProducts(clientId) {
  const clientResult = await pool.query(
    'SELECT shopify_shop, shopify_token, shopify_api_version FROM clients WHERE id = $1 AND is_active = true',
    [clientId]
  );
  if (clientResult.rows.length === 0) throw new Error('Client not found or no Shopify config');

  const { shopify_shop: shop, shopify_token: accessToken, shopify_api_version: apiVersion } = clientResult.rows[0];
  const baseURL = `https://${shop}/admin/api/${apiVersion || '2025-07'}`;

  const allProducts = [];
  let pageInfo = null;

  do {
    const params = new URLSearchParams({ limit: '50', fields: 'id,title,handle,body_html,product_type,vendor,tags,status,published_at' });
    if (pageInfo) params.set('page_info', pageInfo);

    const res = await fetch(`${baseURL}/products.json?${params}`, {
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);

    const data = await res.json();
    allProducts.push(...(data.products || []));

    const linkHeader = res.headers.get('link');
    pageInfo = null;
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/page_info=([^&>]+)/);
      if (match) pageInfo = match[1];
    }
  } while (pageInfo);

  return allProducts;
}

async function updateShopifyProduct(clientId, productId, updates) {
  const clientResult = await pool.query(
    'SELECT shopify_shop, shopify_token, shopify_api_version FROM clients WHERE id = $1',
    [clientId]
  );
  const { shopify_shop: shop, shopify_token: accessToken, shopify_api_version: apiVersion } = clientResult.rows[0];
  const baseURL = `https://${shop}/admin/api/${apiVersion || '2025-07'}`;

  const payload = {};
  if (updates.description !== undefined) payload.body_html = updates.description;
  if (updates.tags !== undefined) payload.tags = updates.tags;

  const res = await fetch(`${baseURL}/products/${productId}.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: payload }),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);

  // Set SEO metafields via Metafield API
  if (updates.metaTitle) {
    await upsertMetafield(baseURL, accessToken, productId, 'global', 'title_tag', updates.metaTitle);
  }
  if (updates.metaDescription) {
    await upsertMetafield(baseURL, accessToken, productId, 'global', 'description_tag', updates.metaDescription);
  }

  return res.json();
}

async function upsertMetafield(baseURL, token, productId, namespace, key, value) {
  // Check if exists
  const getRes = await fetch(
    `${baseURL}/products/${productId}/metafields.json?namespace=${namespace}&key=${key}`,
    { headers: { 'X-Shopify-Access-Token': token } }
  );
  const existing = (await getRes.json()).metafields || [];
  const metafield = existing[0];

  const body = {
    metafield: { namespace, key, value, type: 'single_line_text_field' }
  };

  if (metafield) {
    await fetch(`${baseURL}/products/${productId}/metafields/${metafield.id}.json`, {
      method: 'PUT',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } else {
    await fetch(`${baseURL}/products/${productId}/metafields.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}

async function main() {
  const command = process.argv[2] || 'list';
  const clientId = process.argv[3] || '';
  const limit = parseInt(process.argv[4] || '0');

  if (!clientId) {
    console.log('Usage: node scripts/generate-shopify-product-content.mjs [list|run|audit] <clientId> [limit]');
    console.log('Available Shopify stores:');
    const stores = await pool.query(
      "SELECT id, name, shopify_shop FROM clients WHERE shopify_shop IS NOT NULL AND shopify_shop != ''"
    );
    for (const s of stores.rows) {
      console.log(`  ${s.id} | ${s.name} | ${s.shopify_shop}`);
    }
    await pool.end();
    return;
  }

  log('info', `═══ Shopify Product Content Generator ═══`, { clientId });

  if (command === 'list' || command === 'audit') {
    const products = await getShopifyProducts(clientId);
    log('info', `Found ${products.length} products`);

    for (const p of products) {
      const hasDesc = (p.body_html || '').length > 20;
      const flags = [];
      if (!hasDesc) flags.push('NO_DESC');
      if (!p.status || p.status === 'draft') flags.push(p.status || 'DRAFT');
      console.log(`[${flags.join(',') || 'OK'}] ${p.id} | ${(p.title || '').slice(0, 55)}`);
    }

    console.log(`\nTotal: ${products.length} | With desc: ${products.filter(p => (p.body_html || '').length > 20).length}`);
    await pool.end();
    return;
  }

  if (command === 'run') {
    const products = await getShopifyProducts(clientId);
    const needsWork = products.filter(p => (p.body_html || '').length <= 20);
    log('info', `Products needing descriptions: ${needsWork.length}`);

    const toProcess = limit > 0 ? needsWork.slice(0, limit) : needsWork;
    let success = 0, failed = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const p = toProcess[i];
      log('info', `[${i + 1}/${toProcess.length}] ${p.title}`);

      try {
        const prompt = buildPrompt(p);
        const raw = await callAI(DESCRIPTION_PROMPT, prompt);
        const parsed = extractJSON(raw);

        if (!parsed) {
          log('warn', 'Parse failed', { preview: (raw || '').slice(0, 200) });
          failed++;
          continue;
        }

        await updateShopifyProduct(clientId, p.id, {
          description: parsed.description,
          metaTitle: (parsed.metaTitle || '').slice(0, 60),
          metaDescription: (parsed.metaDescription || '').slice(0, 155),
          tags: parsed.tags || p.tags,
        });

        log('info', `✅ ${p.title} | ${(parsed.metaTitle || '').slice(0, 50)}`);
        success++;
      } catch (err) {
        log('error', `❌ ${p.title}`, { error: err.message });
        failed++;
      }

      if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    log('info', '═══ Complete ═══', { success, failed, total: toProcess.length });
  }

  await pool.end();
}

main().catch(err => { log('error', 'Fatal', { error: err.message }); process.exit(1); });
