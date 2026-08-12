import pg from 'pg';

const clientId = '7034f84d-25db-48ce-9577-c4f8b959e202';
const apiKey = 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1';
const endpointUrl = 'https://boston-pharma.com';

async function wpFetch(path, params = {}) {
  const baseUrl = `${endpointUrl.replace(/\/+$/, '')}/wp-json/kivo/v1`;
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { 'X-Kivo-Key': apiKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.json();
}

async function main() {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'ai_seo_automation',
    user: 'postgres',
    password: 'postgres',
  });

  // Get client info and CMS connection
  const client = (await pool.query('SELECT id, name, slug FROM clients WHERE id = $1', [clientId])).rows[0];
  if (!client) { console.log('Client not found'); return; }
  console.log(`Syncing for: ${client.name} (${client.slug})`);

  const conn = (await pool.query(
    `SELECT id, config, endpoint_url FROM cms_connections WHERE client_id = $1 AND provider = 'wordpress' AND is_active = true LIMIT 1`,
    [clientId]
  )).rows[0];
  if (!conn) { console.log('No WordPress connection found'); return; }
  console.log(`Connection: ${conn.id}`);

  let page = 1;
  let synced = 0, updated = 0, skipped = 0, errors = [];
  const perPage = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const body = await wpFetch('/posts', { limit: perPage, page });
      const posts = body.data || body.posts || body || [];
      const total = body.total || posts.length;
      console.log(`Page ${page}: ${posts.length} items (total: ${total})`);

      for (const post of posts) {
        if (post.type && post.type !== 'post') { skipped++; continue; }

        const wpStatus = post.status === 'publish' ? 'published' : 'draft';
        const slug = post.slug || `wp-post-${post.id}`;
        const metaTitle = post.meta?.title || post.meta_title || '';
        const metaDescription = post.meta?.description || post.meta_description || '';
        const tags = (post.tags || []).map(t => typeof t === 'string' ? t : t.name || t.slug || '');
        const publishedAt = post.publish_date || post.created_at || null;

        const existing = (await pool.query(
          `SELECT a.id FROM articles a
           LEFT JOIN publishing_history ph ON ph.article_id = a.id AND ph.provider = 'wordpress'
           WHERE (ph.external_id = $1 OR a.slug = $2) AND a.client_id = $3
           LIMIT 1`,
          [String(post.id), slug, clientId]
        )).rows;

        if (existing.length > 0) {
          await pool.query(
            publishedAt
              ? `UPDATE articles SET title=$1, content_html=$2, meta_title=$3, meta_description=$4, tags=$5, status=$6, source='wordpress_sync', published_at=$7, updated_at=NOW() WHERE id=$8`
              : `UPDATE articles SET title=$1, content_html=$2, meta_title=$3, meta_description=$4, tags=$5, status=$6, source='wordpress_sync', updated_at=NOW() WHERE id=$7`,
            publishedAt
              ? [post.title, post.content, metaTitle, metaDescription, tags, wpStatus, publishedAt, existing[0].id]
              : [post.title, post.content, metaTitle, metaDescription, tags, wpStatus, existing[0].id]
          );
          updated++;
        } else {
          const ins = (await pool.query(
            `INSERT INTO articles (client_id, title, slug, content_html, content_md, meta_title, meta_description, tags, status, source, published_at, word_count)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'wordpress_sync',$10,0) RETURNING id`,
            [clientId, post.title, slug, post.content, post.content || '', metaTitle, metaDescription, tags, wpStatus, publishedAt || null]
          )).rows[0];

          await pool.query(
            `INSERT INTO publishing_history (article_id, client_id, cms_connection_id, provider, external_id, external_url, status)
             VALUES ($1,$2,$3,'wordpress',$4,$5,'published') ON CONFLICT DO NOTHING`,
            [ins.id, clientId, conn.id, String(post.id), post.permalink || '']
          );
          synced++;
        }
      }

      hasMore = page * perPage < total;
      page++;
    } catch (err) {
      errors.push(`Page ${page}: ${err.message}`);
      hasMore = false;
    }
  }

  await pool.query('UPDATE cms_connections SET last_sync_at = NOW() WHERE id = $1', [conn.id]);

  console.log('\nSync complete:');
  console.log(JSON.stringify({ synced, updated, skipped, errors }, null, 2));
  await pool.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
