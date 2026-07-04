// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const pool = new pg.Pool({
  host: 'localhost', port: 5432,
  user: 'postgres', password: 'postgres',
  database: 'ai_seo_automation',
});

const ARTICLE_ID = 'b10e1dc4-1a12-4235-89d9-d6f0ebd72751';
const BACKUP_PATH = join('/root/my-project/outputs', `${ARTICLE_ID}.json`);

async function fix() {
  // Read current HTML from JSON backup
  const backup = JSON.parse(readFileSync(BACKUP_PATH, 'utf-8'));
  let html = backup.content_html;

  // ─── Fix 1: Put primary keyword in an H2 heading ──────────
  // Change "Understanding Egypt's Climate Threats to Outdoor Furniture"
  // to include the primary keyword
  html = html.replace(
    '<h2>Understanding Egypt\'s Climate Threats to Outdoor Furniture</h2>',
    '<h2>How to Maintain Outdoor Furniture in Egypt\'s Climate — Understanding the Threats</h2>'
  );

  // ─── Fix 2: Add a /blog/ internal link ────────────────────
  // Add it naturally in the Seasonal section after "UV protectant to umbrella fabrics"
  html = html.replace(
    '<li>Apply UV protectant to umbrella fabrics</li>',
    '<li>Apply UV protectant to umbrella fabrics — <a href="/blogs/posts/outdoor-furniture-trend-of-summer-2025">check the latest care recommendations</a></li>'
  );

  // ─── Fix 3: Uncomment the Butterfly table reference ───────
  html = html.replace(
    '<!-- If you own a <a href="/collections/seating">Butterfly table</a>, the folding mechanism benefits from a light silicone spray once a month. -->',
    'If you own a <a href="/collections/seating">Butterfly table</a>, the folding mechanism benefits from a light silicone spray once a month.'
  );

  // ─── Update all records ───────────────────────────────────
  // Update markdown version (strip HTML tags)
  const md = html
    .replace(/<\/h1>/g, '</h1>\n')
    .replace(/<\/h2>/g, '</h2>\n')
    .replace(/<\/h3>/g, '</h3>\n')
    .replace(/<\/p>/g, '</p>\n')
    .replace(/<\/li>/g, '</li>\n')
    .replace(/<\/ul>/g, '</ul>\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const wordCount = html.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;

  // DB update
  const result = await pool.query(`
    UPDATE articles
    SET content_html = $1,
        content_md = $2,
        word_count = $3
    WHERE id = $4::uuid
    RETURNING id, title, word_count
  `, [html, md, wordCount, ARTICLE_ID]);

  // JSON backup update
  backup.content_html = html;
  backup.content_md = md;
  backup.word_count = wordCount;
  writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));

  console.log(`✅ Article updated: ${result.rows[0].word_count} words`);
  console.log(`✅ JSON backup updated`);

  // Verify fixes
  const h2Match = html.match(/<h2[^>]*>.*?climate.*?<\/h2>/i);
  console.log(`\n📋 Fix verification:`);
  console.log(`  1. Primary keyword in H2: ${h2Match ? '✅' : '❌'} "${h2Match ? h2Match[0].replace(/<[^>]+>/g,'') : 'not found'}"`);
  console.log(`  2. /blog/ link present: ${html.includes('/blogs/posts/') ? '✅' : '❌'}`);
  console.log(`  3. Butterfly table uncommented: ${html.includes('If you own a <a href="/collections/seating">Butterfly table</a>') ? '✅' : '❌'}`);
  console.log(`  4. Old commented version removed: ${html.includes('<!-- If you own a') ? '❌ still present' : '✅ removed'}`);

  await pool.end();
}

fix().catch(console.error);
