// ══════════════════════════════════════════════════════════════════
// TDS Geo — Product Image Alt Text Generator
// Generates SEO-optimized alt text for WooCommerce product images
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
    options: { num_predict: 200, temperature: 0.4 },
  });
  return response.message.content;
}

const ALT_SYSTEM_PROMPT = `You are an SEO and accessibility specialist for an e-commerce pharmacy site. Generate descriptive, keyword-rich image alt text (max 125 characters) for product images. Rules:
- Describe what the product is: "Boston Pharma [Product Name] [Form] for [Benefit]"
- Include key ingredient if relevant
- Never use "image of" or "photo of"
- Max 125 characters
- One line only, no quotes around it`;

const WP_BASE = 'https://boston-pharma.com/wp-json';
const WP_KEY = process.env.BOSTON_PHARMA_API_KEY || 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1';
const WP_HEADERS = { 'X-TDS-GEO-Key': WP_KEY, 'Content-Type': 'application/json' };

async function getProducts() {
  const all = [];
  let page = 1, totalPages = 1;
  while (page <= totalPages) {
    const res = await fetch(
      `${WP_BASE}/wp/v2/product?per_page=50&page=${page}&_fields=id,title,featured_media`,
      { headers: WP_HEADERS }
    );
    if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) break;
    const totalHeader = res.headers.get('x-wp-totalpages');
    totalPages = totalHeader ? parseInt(totalHeader) : 1;
    all.push(...list);
    page++;
  }
  return all;
}

async function getMedia(mediaId) {
  const res = await fetch(`${WP_BASE}/wp/v2/media/${mediaId}?_fields=id,alt_text,title,source_url`, { headers: WP_HEADERS });
  if (!res.ok) return null;
  return res.json();
}

async function updateMediaAlt(mediaId, altText) {
  const res = await fetch(`${WP_BASE}/wp/v2/media/${mediaId}`, {
    method: 'POST',
    headers: WP_HEADERS,
    body: JSON.stringify({ alt_text: altText }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Media update failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const limit = parseInt(process.argv[2] || '0');
  log('info', '═══ Product Image Alt Text Generator ═══');

  const products = await getProducts();
  log('info', `Found ${products.length} products`);

  let success = 0, failed = 0, skipped = 0;
  const toProcess = limit > 0 ? products.slice(0, limit) : products;

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i];
    const name = p.title?.rendered || `Product #${p.id}`;

    if (!p.featured_media) {
      skipped++;
      continue;
    }

    const media = await getMedia(p.featured_media);
    if (!media) { skipped++; continue; }

    if (media.alt_text && media.alt_text.length > 10) {
      skipped++;
      continue;
    }

    log('info', `[${i + 1}/${toProcess.length}] Generating alt for: ${name}`);

    try {
      const prompt = `Generate alt text for this product image: "${name}". The product is from Boston Pharmaceutical Industries, a GMP-certified Egyptian pharmaceutical manufacturer.`;
      const altText = (await callAI(ALT_SYSTEM_PROMPT, prompt)).trim().replace(/^["']|["']$/g, '').slice(0, 125);

      if (altText.length < 5) {
        log('warn', 'Generated alt text too short', { altText, name });
        failed++;
        continue;
      }

      await updateMediaAlt(p.featured_media, altText);
      log('info', `✅ ${altText}`);
      success++;
    } catch (err) {
      log('error', `❌ ${name}`, { error: err.message });
      failed++;
    }

    if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  log('info', '═══ Complete ═══', { success, failed, skipped, total: toProcess.length });
}

main().catch(err => { log('error', 'Fatal', { error: err.message }); process.exit(1); });
