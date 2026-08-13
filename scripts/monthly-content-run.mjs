// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Monthly Content Generation Runner
// Runs inside the tds-geo-api-1 container (cwd /app so ESM bare
// specifiers resolve against /app/node_modules).
//
// Flow per active client:
//   1. Read the committed topics manifest (backend/scripts/monthly-topics.json)
//      and select the entry for monthOffset = monthIndex % 12.
//   2. For each of the 4 topics, generate content via the app's own
//      POST /api/articles/generate endpoint with an internal admin JWT,
//      always publish:false (article is stored as a draft only).
//   3. Enforce the public-body guard: if the generated body contains any
//      internal draft marker, log and skip the article.
//   4. Upload the clean body as a hidden draft to the client's active
//      CMS connection from cms_connections:
//        - Shopify:  POST /admin/api/<ver>/blogs/<blogId>/articles.json
//                    with published:false, published_at:null
//        - WordPress:POST /wp-json/kivo/v1/posts with status draft,
//                    header X-Kivo-Key
//   5. Re-fetch each created article and assert it is hidden
//      (Shopify published_at === null; WordPress status === 'draft').
//
// Modes:
//   --dry-run   Resolve credentials + verify connectivity (GET only),
//               print the plan, write nothing.
//   --verify    Re-fetch the articles recorded in the run-state file and
//               assert they are still hidden.
// ══════════════════════════════════════════════════════════════════

import pg from 'pg';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import https from 'https';
import jwt from 'jsonwebtoken';

const { Pool } = pg;

const POOL = new Pool({ connectionString: process.env.DATABASE_URL });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || '';
const TOPICS_PATH =
  process.env.MONTHLY_TOPICS_PATH || './backend/scripts/monthly-topics.json';
const STATE_PATH = process.env.MONTHLY_STATE_PATH || '/tmp/monthly-run-state.json';

const ACTIVE_CLIENTS = [
  'alamein-2022',
  'boston-pharma',
  'caravanserai',
  'flaunt-cosmetics-global',
];

// Shopify blog IDs (from doc/clients/ACTIVE-CLIENTS-MONTHLY-CONTENT-PLAN.md).
const BLOG_IDS = {
  'alamein-2022': '79774056505',
  caravanserai: '78074216615',
  'flaunt-cosmetics-global': '116005503268',
};

// Internal draft markers — mirrors backend/services/content/publicArticleGuard.ts.
// Any of these appearing in a generated body blocks the CMS upload.
const INTERNAL_MARKERS = [
  'GEO/AEO Answer Capsule',
  'Meta Draft',
  'FAQ Opportunities',
  'Publishing Checklist',
  'Do not publish',
  'connector repair',
  'token is repaired',
  'Shopify token',
  'WordPress write credentials',
  'CMS Publisher',
  'QA Operator',
  'Senior SEO Strategist',
  'Editorial Director',
  'Content Researcher',
  'EEAT Consultant',
  'GEO/AEO Specialist',
  'Compliance Reviewer',
];

// ─── Helpers ──────────────────────────────────────────────────────

function log(level, msg, data = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data }));
}

function truncate(value, max) {
  const chars = Array.from(String(value || '').trim());
  if (chars.length <= max) return chars.join('');
  return chars.slice(0, max - 1).join('').trimEnd() + '…';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function text(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateToken() {
  return jwt.sign(
    { sub: '00000000-0000-0000-0000-000000000000', role: 'admin', system: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// ─── HTTP helpers ─────────────────────────────────────────────────

function httpsJsonRequest(url, method, headers, payload, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const req = https.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...headers,
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { /* keep null */ }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
        else reject(new Error(JSON.stringify({ status: res.statusCode, body: json || data.slice(0, 300) })));
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function shopifyRequest(shop, version, token, method, path, payload) {
  return httpsJsonRequest(
    `https://${shop}/admin/api/${version}${path}`,
    method,
    { 'X-Shopify-Access-Token': token },
    payload
  );
}

function wordpressRequest(endpointUrl, apiKey, method, path, payload) {
  const base = String(endpointUrl || '').replace(/\/+$/, '') + '/wp-json/kivo/v1';
  return httpsJsonRequest(`${base}${path}`, method, { 'X-Kivo-Key': apiKey }, payload);
}

// ─── Guard ────────────────────────────────────────────────────────

function findInternalMarkers(contentMd, contentHtml) {
  const combined = `${text(contentHtml)} ${contentMd || ''}`.toLowerCase();
  return INTERNAL_MARKERS.filter((marker) => combined.includes(marker.toLowerCase()));
}

// ─── DB: client + active CMS connections ──────────────────────────

async function getClientConnections(slug) {
  const r = await POOL.query(
    `SELECT c.id, c.slug, c.name, c.shopify_shop, c.shopify_api_version,
            cc.provider, cc.config, cc.endpoint_url
     FROM clients c
     LEFT JOIN cms_connections cc ON cc.client_id = c.id AND cc.is_active = true
     WHERE c.slug = $1 AND c.is_active = true`,
    [slug]
  );
  if (r.rows.length === 0) return null;
  const first = r.rows[0];
  const connections = r.rows
    .filter((row) => row.provider)
    .map((row) => ({
      provider: row.provider,
      config: row.config || {},
      endpoint_url: row.endpoint_url,
      shopify_shop: row.shopify_shop,
      shopify_api_version: row.shopify_api_version,
    }));
  return { clientId: first.id, slug: first.slug, name: first.name, connections };
}

function resolveShopify(conn) {
  const config = conn.config || {};
  return {
    shop: config.shop || conn.shopify_shop,
    version: config.apiVersion || conn.shopify_api_version || '2025-07',
    token: config.accessToken,
  };
}

function resolveWordPress(conn) {
  const config = conn.config || {};
  return {
    endpointUrl: config.endpointUrl || config.baseUrl || conn.endpoint_url,
    apiKey: config.apiKey || config.accessToken,
  };
}

// ─── Generation (via the app's own generate endpoint) ─────────────

async function generateArticle(clientId, keyword) {
  const res = await fetch(`${BASE_URL}/api/articles/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${generateToken()}`,
    },
    body: JSON.stringify({ keyword, clientId, publish: false }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  if (!body || !body.id) throw new Error('generate endpoint returned no article');
  return body;
}

// ─── Hidden draft creation + verification ─────────────────────────

async function createShopifyHiddenDraft(sc, blogId, article) {
  const payload = {
    article: {
      title: article.title,
      body_html: article.content_html,
      tags: (article.tags || []).join(', '),
      author: 'Traffic Digital Solutions',
      published: false,
      published_at: null,
      summary_html: truncate(text(article.content_html), 200),
      metafields_global_title_tag: truncate(article.meta_title || article.title, 70),
      metafields_global_description_tag: truncate(article.meta_description || text(article.content_html), 160),
    },
  };
  const data = await shopifyRequest(sc.shop, sc.version, sc.token, 'POST', `/blogs/${blogId}/articles.json`, payload);
  return data.article;
}

async function verifyShopifyHidden(sc, blogId, id) {
  const data = await shopifyRequest(sc.shop, sc.version, sc.token, 'GET', `/blogs/${blogId}/articles/${id}.json`);
  const a = data.article;
  if (a.published_at) throw new Error(`article ${id} not hidden: published_at=${a.published_at}`);
  return {
    id: a.id,
    title: a.title,
    handle: a.handle,
    published_at: a.published_at,
    has_image: Boolean(a.image),
  };
}

async function createWordPressDraft(wc, article) {
  const payload = {
    title: article.title,
    content_html: article.content_html,
    status: 'draft',
    slug: article.slug,
    tags: article.tags || [],
    meta_title: truncate(article.meta_title || article.title, 70),
    meta_description: truncate(article.meta_description || text(article.content_html), 160),
    excerpt: truncate(text(article.content_html), 200),
  };
  const data = await wordpressRequest(wc.endpointUrl, wc.apiKey, 'POST', '/posts', payload);
  const post = data.post || data;
  if (!post.post_id && !post.id) throw new Error('wordpress create returned no post id');
  return post;
}

async function verifyWordPressDraft(wc, id) {
  const data = await wordpressRequest(wc.endpointUrl, wc.apiKey, 'GET', `/posts/${id}`);
  const post = data.post || data;
  const status = post.status || 'draft';
  if (status !== 'draft') throw new Error(`post ${id} status is ${status}, expected draft`);
  return {
    id: post.post_id || post.id,
    title: post.title,
    handle: post.slug || post.handle || String(post.post_id || post.id),
    published_at: null,
    status,
    has_image: Boolean(post.featured_image_url),
  };
}

// ─── Modes ────────────────────────────────────────────────────────

async function runDryRun(entries, monthLabel, monthOffset) {
  const planned = [];
  for (const entry of entries) {
    const client = await getClientConnections(entry.clientSlug);
    const connections = [];
    if (client) {
      for (const conn of client.connections) {
        if (conn.provider === 'shopify') {
          const sc = resolveShopify(conn);
          if (!sc.shop || !sc.token) {
            connections.push({ provider: 'shopify', shop: sc.shop || null, verified: false, reason: 'missing shop or token' });
            continue;
          }
          let verified = false;
          try {
            await shopifyRequest(sc.shop, sc.version, sc.token, 'GET', '/shop.json');
            verified = true;
          } catch (err) {
            log('warn', 'shopify credential check failed (dry-run)', { slug: entry.clientSlug, shop: sc.shop, reason: err.message });
          }
          connections.push({ provider: 'shopify', shop: sc.shop, blogId: BLOG_IDS[entry.clientSlug] || null, verified });
        } else if (conn.provider === 'wordpress') {
          const wc = resolveWordPress(conn);
          let verified = false;
          if (!wc.endpointUrl || !wc.apiKey) {
            connections.push({ provider: 'wordpress', endpoint: wc.endpointUrl || null, verified: false, reason: 'missing endpoint or key' });
            continue;
          }
          try {
            await wordpressRequest(wc.endpointUrl, wc.apiKey, 'GET', '/status');
            verified = true;
          } catch (err) {
            log('warn', 'wordpress credential check failed (dry-run)', { slug: entry.clientSlug, reason: err.message });
          }
          connections.push({ provider: 'wordpress', endpoint: wc.endpointUrl, verified });
        }
      }
    }
    planned.push({
      slug: entry.clientSlug,
      clientFound: Boolean(client),
      topics: entry.topics.map((t) => ({ keyword: t.keyword, titleTemplate: t.titleTemplate })),
      connections,
    });
  }
  const summary = { ok: true, dry_run: true, month: monthLabel, monthOffset, planned };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function runMonthly(entries, monthLabel, monthOffset) {
  const perClient = [];
  for (const entry of entries) {
    const client = await getClientConnections(entry.clientSlug);
    if (!client || client.connections.length === 0) {
      log('warn', 'no active client/connection', { slug: entry.clientSlug });
      perClient.push({ slug: entry.clientSlug, count: 0, skipped: 1, reason: 'no_active_connection', articles: [] });
      continue;
    }
    log('info', 'processing client', { slug: entry.clientSlug, topics: entry.topics.length, connections: client.connections.map((c) => c.provider) });
    const articles = [];
    let skipped = 0;

    for (const topic of entry.topics) {
      let article;
      try {
        article = await generateArticle(client.clientId, topic.keyword);
      } catch (err) {
        skipped++;
        log('warn', 'generation failed', { slug: entry.clientSlug, keyword: topic.keyword, reason: err.message });
        await sleep(7500);
        continue;
      }

      // Keep the app's /api/articles/generate rate limit (max 10/min per IP)
      // from throttling the 16 monthly generations.
      await sleep(7500);

      const markers = findInternalMarkers(article.content_md, article.content_html);
      if (markers.length > 0) {
        skipped++;
        log('warn', 'internal marker guard blocked upload', {
          slug: entry.clientSlug,
          keyword: topic.keyword,
          title: article.title,
          markers,
        });
        continue;
      }

      for (const conn of client.connections) {
        if (conn.provider === 'shopify') {
          const sc = resolveShopify(conn);
          const blogId = BLOG_IDS[entry.clientSlug] || configBlogId(conn);
          if (!sc.shop || !sc.token || !blogId) {
            skipped++;
            log('error', 'shopify draft upload skipped', { slug: entry.clientSlug, keyword: topic.keyword, reason: 'missing shop, token or blogId' });
            continue;
          }
          try {
            const created = await createShopifyHiddenDraft(sc, blogId, article);
            const verified = await verifyShopifyHidden(sc, blogId, created.id);
            log('info', 'created hidden shopify draft', { slug: entry.clientSlug, keyword: topic.keyword, shop: sc.shop, blogId, id: created.id });
            articles.push({ ...verified, keyword: topic.keyword });
          } catch (err) {
            skipped++;
            log('error', 'shopify draft upload failed', { slug: entry.clientSlug, keyword: topic.keyword, reason: err.message });
          }
        } else if (conn.provider === 'wordpress') {
          const wc = resolveWordPress(conn);
          if (!wc.endpointUrl || !wc.apiKey) {
            skipped++;
            log('error', 'wordpress draft upload skipped', { slug: entry.clientSlug, keyword: topic.keyword, reason: 'missing endpoint or key' });
            continue;
          }
          try {
            const created = await createWordPressDraft(wc, article);
            const id = created.post_id || created.id;
            const verified = await verifyWordPressDraft(wc, id);
            log('info', 'created wordpress draft', { slug: entry.clientSlug, keyword: topic.keyword, id });
            articles.push({ ...verified, keyword: topic.keyword });
          } catch (err) {
            skipped++;
            log('error', 'wordpress draft upload failed', { slug: entry.clientSlug, keyword: topic.keyword, reason: err.message });
          }
        } else {
          skipped++;
          log('warn', 'unsupported provider', { slug: entry.clientSlug, keyword: topic.keyword, provider: conn.provider });
        }
      }
    }

    perClient.push({ slug: entry.clientSlug, count: articles.length, skipped, articles });
  }

  const summary = { ok: true, month: monthLabel, monthOffset, per_client: perClient };
  writeFileSync(STATE_PATH, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(JSON.stringify(summary));
  return summary;
}

function configBlogId(conn) {
  const config = conn.config || {};
  return config.blogId || config.blog_id || null;
}

async function runVerify(monthLabel) {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`run-state file not found at ${STATE_PATH} — run the generation step first`);
  }
  const state = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  const perClient = [];
  for (const pc of state.per_client || []) {
    const client = await getClientConnections(pc.slug);
    const verifiedArticles = [];
    for (const a of pc.articles || []) {
      let verified = null;
      if (client) {
        for (const conn of client.connections) {
          try {
            if (conn.provider === 'shopify') {
              const sc = resolveShopify(conn);
              const blogId = BLOG_IDS[pc.slug] || configBlogId(conn);
              verified = await verifyShopifyHidden(sc, blogId, a.id);
              break;
            }
            if (conn.provider === 'wordpress') {
              const wc = resolveWordPress(conn);
              verified = await verifyWordPressDraft(wc, a.id);
              break;
            }
          } catch (err) {
            verified = { id: a.id, error: err.message };
            break;
          }
        }
      } else {
        verified = { id: a.id, error: 'client not found for verification' };
      }
      verifiedArticles.push(verified);
    }
    perClient.push({ slug: pc.slug, count: verifiedArticles.length, articles: verifiedArticles });
  }
  const summary = { ok: true, month: monthLabel, verified: true, per_client: perClient };
  console.log(JSON.stringify(summary));
  const failed = perClient.flatMap((pc) => pc.articles).filter((a) => a && a.error);
  if (failed.length > 0) {
    throw new Error(
      `verification failed for ${failed.length} article(s): ${failed
        .map((a) => `${a.id} (${a.error})`)
        .join('; ')}`
    );
  }
  return summary;
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');

  const now = new Date();
  const monthLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const monthOffset = monthIndex % 12;

  const manifest = JSON.parse(readFileSync(TOPICS_PATH, 'utf-8'));
  const entries = (manifest.entries || []).filter(
    (e) => ACTIVE_CLIENTS.includes(e.clientSlug) && e.monthOffset === monthOffset
  );
  if (entries.length === 0) {
    throw new Error(`no manifest entries for monthOffset ${monthOffset}`);
  }

  let result;
  if (verify) result = await runVerify(monthLabel);
  else if (dryRun) result = await runDryRun(entries, monthLabel, monthOffset);
  else result = await runMonthly(entries, monthLabel, monthOffset);
  return result;
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  })
  .finally(async () => {
    try { await POOL.end(); } catch { /* ignore */ }
  });