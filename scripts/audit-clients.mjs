#!/usr/bin/env node
import { config } from 'dotenv';
import { Pool } from 'pg';

config();

const MIN_WORDS = Number(process.env.CLIENT_AUDIT_MIN_WORDS || 1200);
const MIN_QUALITY = Number(process.env.CLIENT_AUDIT_MIN_QUALITY || 65);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required for client audit.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const errors = [];
const warnings = [];

main().catch(async (err) => {
  console.error(`Client audit failed: ${formatError(err)}`);
  process.exit(1);
});

async function main() {
  try {
    const clients = await queryClients();
    const summaries = await queryArticleSummaries();
    const connections = await queryConnections();

    console.log('Client operational audit');
    console.log(`  Clients in DB: ${clients.length}`);
    console.log(`  Active clients: ${clients.filter((client) => client.is_active).length}`);
    console.log(`  Minimum content standard: ${MIN_WORDS} words, quality ${MIN_QUALITY}/100`);

    for (const client of clients) {
      const summary = summaries.get(client.slug) || emptySummary();
      const clientConnections = connections.filter((connection) => connection.slug === client.slug);
      console.log(`\n${client.is_active ? 'ACTIVE' : 'INACTIVE'} ${client.slug} - ${client.name}`);
      console.log(`  Articles: ${summary.total_articles}; unsafe pending: ${summary.unsafe_pending}; scheduled unpublished: ${summary.scheduled_unpublished}`);
      console.log(`  Connections: ${clientConnections.map((connection) => `${connection.provider}:${connection.endpoint_url}`).join(', ') || 'none'}`);

      if (!client.is_active) continue;

      if (summary.unsafe_pending > 0) {
        errors.push(`${client.slug}: ${summary.unsafe_pending} unsafe pending article(s)`);
      }
      if (summary.scheduled_unpublished > 0) {
        warnings.push(`${client.slug}: ${summary.scheduled_unpublished} unpublished scheduled article(s)`);
      }
      if (summary.total_articles === 0) {
        warnings.push(`${client.slug}: no articles in local DB`);
      }
      if (client.billing_status === 'cancelled') {
        warnings.push(`${client.slug}: billing status is cancelled while client is active`);
      }

      const realShopify = client.shopify_shop?.endsWith('.myshopify.com');
      if (realShopify) await auditShopify(client);

      for (const connection of clientConnections) {
        if (connection.provider === 'wordpress') await auditWordPress(connection);
      }
    }

    printFindings('ERROR', errors);
    printFindings('WARN', warnings);
    if (errors.length > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

async function queryClients() {
  const { rows } = await pool.query(`
    SELECT id, slug, name, is_active, shopify_shop, shopify_token, shopify_api_version, billing_status, shopify_token_expires_at
    FROM clients
    ORDER BY is_active DESC, slug
  `);
  return rows;
}

async function queryArticleSummaries() {
  const { rows } = await pool.query(`
    SELECT c.slug,
      COUNT(a.id)::int AS total_articles,
      COUNT(a.id) FILTER (
        WHERE a.published_at IS NULL
          AND a.status IN ('approved','generated','draft')
          AND (COALESCE(a.word_count, 0) < $1 OR COALESCE(a.quality_score, 0) < $2)
      )::int AS unsafe_pending,
      COUNT(a.id) FILTER (WHERE a.scheduled_at IS NOT NULL AND a.published_at IS NULL)::int AS scheduled_unpublished
    FROM clients c
    LEFT JOIN articles a ON a.client_id = c.id
    GROUP BY c.slug
  `, [MIN_WORDS, MIN_QUALITY]);
  return new Map(rows.map((row) => [row.slug, row]));
}

async function queryConnections() {
  const { rows } = await pool.query(`
    SELECT c.slug, cc.provider, cc.endpoint_url, cc.is_active, cc.capabilities
    FROM cms_connections cc
    JOIN clients c ON c.id = cc.client_id
    WHERE cc.is_active = true
    ORDER BY c.slug, cc.provider
  `);
  return rows;
}

async function auditShopify(client) {
  if (!client.shopify_token) {
    errors.push(`${client.slug}: Shopify token missing`);
    return;
  }
  const apiVersion = client.shopify_api_version || '2025-07';
  const base = `https://${client.shopify_shop}/admin/api/${apiVersion}`;
  const headers = { 'X-Shopify-Access-Token': client.shopify_token };
  let shop;
  try {
    shop = await fetch(`${base}/shop.json`, { headers, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    errors.push(`${client.slug}: Shopify shop.json request failed (${err.message})`);
    return;
  }
  if (!shop.ok) {
    errors.push(`${client.slug}: Shopify shop.json failed HTTP ${shop.status}`);
    return;
  }
  let blogs;
  try {
    blogs = await fetch(`${base}/blogs.json`, { headers, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    errors.push(`${client.slug}: Shopify blogs.json request failed (${err.message})`);
    return;
  }
  if (!blogs.ok) {
    errors.push(`${client.slug}: Shopify blogs.json failed HTTP ${blogs.status}`);
    return;
  }
  const body = await blogs.json();
  if ((body.blogs || []).length === 0) errors.push(`${client.slug}: Shopify has no blogs available`);
}

async function auditWordPress(connection) {
  const base = connection.endpoint_url.replace(/\/$/, '');
  let response;
  try {
    response = await fetch(`${base}/wp-json/wp/v2/posts?per_page=1&_fields=id,status,link,title`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    errors.push(`${connection.slug}: WordPress REST request failed (${err.message})`);
    return;
  }
  if (!response.ok) {
    errors.push(`${connection.slug}: WordPress REST failed HTTP ${response.status}`);
  }
}

function emptySummary() {
  return { total_articles: 0, unsafe_pending: 0, scheduled_unpublished: 0 };
}

function printFindings(label, findings) {
  console.log(`\n${label}: ${findings.length}`);
  for (const finding of findings) console.log(`  - ${finding}`);
}

function formatError(err) {
  if (err instanceof AggregateError) {
    return err.errors.map(formatError).join('; ');
  }
  if (err && typeof err === 'object') {
    const code = 'code' in err ? `${err.code}: ` : '';
    const message = 'message' in err && err.message ? err.message : String(err);
    return `${code}${message}`;
  }
  return String(err);
}
