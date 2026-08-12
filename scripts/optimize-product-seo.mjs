// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Kivo Geo — Product SEO Optimizer
// Generates SEO-optimized meta titles and descriptions for products
// ══════════════════════════════════════════════════════════════════

import 'dotenv/config';
import { Ollama } from 'ollama';

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
    options: { num_predict: 500, temperature: 0.5 },
    format: 'json',
  });
  return response.message.content;
}

const SEO_SYSTEM_PROMPT = `You are an SEO specialist for Boston Pharmaceutical Industries' e-commerce site. 

For each product, generate:
1. An SEO page title (max 60 chars) including "| Boston Pharma" suffix
2. A meta description (max 155 chars) that includes the key benefit and a call to action
3. Focus keyword suggestions (comma-separated)

Return ONLY valid JSON. No markdown. No code blocks.:
{
  "metaTitle": "title max 60 chars | Boston Pharma",
  "metaDescription": "description max 155 chars with CTA",
  "focusKeywords": "kw1, kw2, kw3"
}`;

function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()); } catch {}
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const cleaned = objMatch[0]
        .replace(/[\u0000-\u001F]+/g, ' ')
        .replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch {}
  }

  // One more try: flatten newlines in string values
  const flat = text.replace(/\n\s*/g, ' ');
  try { return JSON.parse(flat); } catch {}

  return null;
}

const WP_BASE = 'https://boston-pharma.com/wp-json';
const WP_KEY = process.env.BOSTON_PHARMA_API_KEY || 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1';
const WP_HEADERS = { 'X-Kivo-Key': WP_KEY, 'Content-Type': 'application/json' };

async function getProducts() {
  log('info', 'Fetching products via Kivo Geo plugin');
  const all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${WP_BASE}/kivo/v1/posts?post_type=product&limit=50&offset=${offset}`,
      { headers: WP_HEADERS }
    );
    if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
    const d = await res.json();
    const items = d.data || [];
    if (items.length === 0) break;
    // Only actual products (articles have type=post, despite post_type filter)
    const actualProducts = items.filter(p => p.type === 'product');
    all.push(...actualProducts);
    offset += items.length;
  }
  return all;
}

async function updateProductMeta(id, metaTitle, metaDescription) {
  const body = { post_type: 'product', meta_title: metaTitle, meta_description: metaDescription };
  const res = await fetch(`${WP_BASE}/kivo/v1/posts/${id}`, {
    method: 'PUT', headers: WP_HEADERS, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const mode = process.argv[2] || 'optimize';
  const limit = parseInt(process.argv[3] || '0');

  log('info', '═══ Product SEO Optimizer ═══');
  const products = await getProducts();
  log('info', `Found ${products.length} products`);

  if (mode === 'audit') {
    for (const p of products) {
      const name = p.title?.rendered || '?';
      const content = (p.content?.rendered || '').replace(/<[^>]+>/g, '').trim();
      const excerpt = (p.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim();
      console.log(`${p.id} | ${(p.price || 'N/A').padStart(8)} | desc:${String(content.length > 30).padStart(5)} | excerpt:${String(excerpt.length > 30).padStart(5)} | ${name.slice(0, 60)}`);
    }
    return;
  }

  let success = 0, failed = 0;
  const toProcess = limit > 0 ? products.slice(0, limit) : products;

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i];
    const name = p.title?.rendered || `Product #${p.id}`;

    log('info', `[${i + 1}/${toProcess.length}] ${name.slice(0, 60)}`);

    try {
      const prompt = `Generate SEO meta for: "${name}". Product is from Boston Pharmaceutical Industries (GMP-certified Egyptian pharma manufacturer, "Quality Beyond Seven Stars" standard). Price: ${p.price || 'N/A'}.`;
      const raw = await callAI(SEO_SYSTEM_PROMPT, prompt);
      const parsed = extractJSON(raw);

      if (!parsed) {
        log('warn', 'Parse failed', { preview: raw.slice(0, 200) });
        failed++;
        continue;
      }

      await updateProductMeta(p.id, parsed.metaTitle, parsed.metaDescription);
      log('info', `✅ ${parsed.metaTitle} | ${parsed.metaDescription.slice(0, 80)}...`);
      success++;
    } catch (err) {
      log('error', `❌ ${name}`, { error: err.message });
      failed++;
    }

    if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  log('info', '═══ Complete ═══', { success, failed, total: toProcess.length });
}

main().catch(err => { log('error', 'Fatal', { error: err.message }); process.exit(1); });
