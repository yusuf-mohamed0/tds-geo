// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Kivo Geo — Product Content Generator
// Generates SEO product descriptions + meta for WooCommerce/Shopify
// ══════════════════════════════════════════════════════════════════

import 'dotenv/config';
import pg from 'pg';
import { randomUUID } from 'crypto';
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
  if (!OLLAMA_BASE_URL && !OLLAMA_API_KEY) {
    throw new Error('Ollama not configured: set OLLAMA_BASE_URL');
  }
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
    options: {
      num_predict: 2000,
      temperature: 0.7,
    },
    format: 'json',
  });
  return response.message.content;
}

// ─── Generation Prompts ─────────────────────────────────────────

const DESCRIPTION_SYSTEM_PROMPT = `You are a senior pharmaceutical and e-commerce copywriter for Boston Pharmaceutical Industries.

Return ONLY valid JSON. No markdown. No code blocks. Just raw JSON.
The description field uses escaped HTML (\\n for newlines, no literal newlines inside strings).

{
  "description": "Full product description in HTML. Use <h2> sections: Overview, Key Ingredients, Benefits, Who It's For, Why Choose Boston Pharma. Use <p> for paragraphs, <ul><li> for lists. 300-500 words.",
  "shortDescription": "2-3 sentence summary (50-80 words). HTML allowed.",
  "metaTitle": "SEO title max 60 characters",
  "metaDescription": "Meta description max 155 characters",
  "altText": "Image alt text max 125 characters",
  "keyBenefits": ["benefit1", "benefit2", "benefit3"]
}`;

function buildProductPrompt(product) {
  return `Generate SEO-optimized product content for:

Product Name: ${product.name}
Product Type: ${product.type || 'Dietary Supplement / Pharmaceutical'}
Category: ${product.category || 'General Health'}
Key Ingredients: ${product.ingredients || 'Not specified'}
Form: ${product.form || 'Not specified'}
Target Audience: ${product.audience || 'Adults'}
Health Focus: ${product.benefit || 'General wellness'}

The content should position this as a premium-quality product from an Egyptian GMP-certified pharmaceutical manufacturer. Reference "Quality Beyond Seven Stars" brand standard.`;
}

// ─── WordPress API ──────────────────────────────────────────────

const WP_BASE = 'https://boston-pharma.com/wp-json';
const WP_PLUGIN_KEY = process.env.BOSTON_PHARMA_API_KEY || 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1';
const WP_HEADERS = { 'X-TDS-Geo-Key': WP_PLUGIN_KEY, 'Content-Type': 'application/json' };

async function getWooProducts() {
  log('info', 'Fetching WooCommerce products from Boston Pharma');
  const allProducts = [];
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${WP_BASE}/kivo/v1/posts?post_type=product&limit=50&offset=${offset}`,
      { headers: WP_HEADERS }
    );
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const d = await res.json();
    const items = d.data || [];
    if (items.length === 0) break;

    for (const p of items) {
      // Only actual products (articles have type=post)
      if (p.type !== 'product') continue;
      allProducts.push({
        id: parseInt(p.id),
        title: { rendered: p.title || '' },
        content: { rendered: p.content || '' },
        excerpt: { rendered: p.excerpt || '' },
        name: p.title || '',
        price: '',
        categories: [],
        slug: p.slug || '',
        meta: p.meta || {},
      });
    }

    offset += items.length;
  }

  return allProducts;
}

async function updateWooProduct(productId, data) {
  log('info', 'Updating product in WooCommerce', { id: productId });

  // Use Kivo Geo plugin API which bypasses WP user capability checks
  const body = {
    post_type: 'product',
    content: data.description,
    excerpt: data.shortDescription,
    meta_title: data.metaTitle,
    meta_description: data.metaDescription,
  };

  const res = await fetch(`${WP_BASE}/kivo/v1/posts/${productId}`, {
    method: 'PUT',
    headers: WP_HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed: ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Main ────────────────────────────────────────────────────────

function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Try extracting from markdown code block
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()); } catch {}
  }
  // Try finding JSON object in text
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      // Clean up common issues
      const cleaned = objMatch[0]
        .replace(/[\u0000-\u001F]+/g, ' ')         // remove control chars
        .replace(/,\s*([}\]])/g, '$1')              // trailing commas
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":'); // unquoted keys
      return JSON.parse(cleaned);
    } catch {}
  }
  return null;
}

async function generateAndUpdateProducts(options = {}) {
  const { limit = 0, skipExisting = true, onlyEmpty = true } = options;

  log('info', '═══ Product Content Generator ═══');

  // Step 1: Fetch all products
  const products = await getWooProducts();
  log('info', `Found ${products.length} products`);

  // Step 2: Filter products that need descriptions
  const needsWork = products.filter(p => {
    const hasContent = (p.content?.rendered || '').length > 20;
    const hasExcerpt = (p.excerpt?.rendered || '').length > 20;
    if (onlyEmpty) return !hasContent || !hasExcerpt;
    return true;
  });

  log('info', `Products needing descriptions: ${needsWork.length}`);
  if (limit > 0) needsWork.splice(limit);

  // Step 3: Generate and update each product
  let success = 0;
  let failed = 0;

  for (let i = 0; i < needsWork.length; i++) {
    const product = needsWork[i];
    const name = product.title?.rendered || product.name || `Product #${product.id}`;

    log('info', `[${i + 1}/${needsWork.length}] Generating for: ${name}`);

    try {
      // Parse product info
      const excerpt = (product.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim();
      const content = (product.content?.rendered || '').replace(/<[^>]+>/g, '').trim();

      // Build product info
      const productInfo = {
        name,
        type: name.toLowerCase().includes('vitamin') || name.toLowerCase().includes('supplement') ? 'Dietary Supplement' : 'Pharmaceutical',
        category: 'General Health',
        ingredients: excerpt || 'Premium quality ingredients',
        form: content || 'Tablet / Capsule',
        audience: 'Adults',
        benefit: name.includes('Vitamin') ? 'Nutritional support' :
                 name.includes('Immune') ? 'Immune system support' :
                 name.includes('Heart') ? 'Cardiovascular health' : 'General wellness',
      };

      // Generate content via AI
      const prompt = buildProductPrompt(productInfo);
      const aiResponse = await callAI(DESCRIPTION_SYSTEM_PROMPT, prompt);

      let parsed = extractJSON(aiResponse);
      if (!parsed) {
        log('warn', 'Response not parsable, length', { bytes: aiResponse.length });
        log('warn', 'Raw text', { text: aiResponse.slice(0, 3000) });

        // Last resort: try to clean up literal newlines in string values
        const cleaned = aiResponse
          .replace(/```json\s*|```\s*/g, '')
          .replace(/\n\s*/g, ' ')
          .replace(/,(\s*[}\]])/g, '$1');
        try { parsed = JSON.parse(cleaned); } catch {}
      }
      if (!parsed) {
        throw new Error('Failed to parse AI response as JSON');
      }

      // Validate and trim SEO meta
      const metaTitle = (parsed.metaTitle || '').replace(/<[^>]+>/g, '').slice(0, 60);
      const metaDescription = (parsed.metaDescription || '').replace(/<[^>]+>/g, '').slice(0, 155);

      // Update in WooCommerce
      await updateWooProduct(product.id, {
        description: parsed.description,
        shortDescription: parsed.shortDescription,
        metaTitle,
        metaDescription,
      });

      log('info', `✅ Updated: ${name}`, {
        metaTitle: parsed.metaTitle,
        descLength: parsed.description?.length,
      });
      success++;
    } catch (err) {
      log('error', `❌ Failed: ${name}`, { error: err.message });
      failed++;
    }

    // Small delay to avoid rate limits
    if (i < needsWork.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  log('info', '═══ Complete ═══', { success, failed, total: needsWork.length });
  return { success, failed, total: needsWork.length };
}

// ─── CLI ─────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2] || 'run';
  const limit = parseInt(process.argv[3] || '0');

  try {
    switch (command) {
      case 'run':
        await generateAndUpdateProducts({ limit, onlyEmpty: true });
        break;
      case 'list':
        const products = await getWooProducts();
        for (const p of products) {
          const hasContent = (p.content?.rendered || '').length > 20;
          const hasExcerpt = (p.excerpt?.rendered || '').length > 20;
          const hasPrice = p.price && p.price !== '0' && p.price !== '';
          const flags = [];
          if (!hasContent) flags.push('NO_DESC');
          if (!hasExcerpt) flags.push('NO_EXCERPT');
          if (!hasPrice) flags.push('NO_PRICE');
          console.log(`[${flags.join(',') || 'OK'}] ${p.title?.rendered || '?'} (price=${p.price})`);
        }
        console.log(`\nTotal: ${products.length} products`);
        break;
      case 'count':
        const all = await getWooProducts();
        const emptyDesc = all.filter(p => (p.content?.rendered || '').length < 20).length;
        const emptyPrice = all.filter(p => !p.price || p.price === '0').length;
        console.log(`Total: ${all.length}`);
        console.log(`No description: ${emptyDesc}`);
        console.log(`No price ($0): ${emptyPrice}`);
        break;
      default:
        console.log('Usage: node scripts/generate-product-content.mjs [run|list|count] [limit]');
        console.log('  run [N]   — Generate descriptions for first N products (0 = all)');
        console.log('  list      — List all products with status flags');
        console.log('  count     — Summary counts');
    }
  } catch (err) {
    log('error', 'Product generator failed', { error: err.message });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
