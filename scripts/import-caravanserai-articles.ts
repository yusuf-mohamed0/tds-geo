import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(': ');
    if (sep > 0) {
      meta[line.slice(0, sep).trim()] = line.slice(sep + 2).trim().replace(/^"|"$/g, '');
    }
  }
  return { meta, body: match[2].trim() };
}

async function main() {
  const clientResult = await pool.query('SELECT id FROM clients WHERE slug = $1', ['caravanserai']);
  if (clientResult.rows.length === 0) {
    console.error('Client not found');
    process.exit(1);
  }
  const clientId = clientResult.rows[0].id;

  const articlesDir = '/home/ubuntu/kivo/doc/clients/caravanserai/articles';
  const files = readdirSync(articlesDir).filter(f => f.endsWith('.md'));

  let imported = 0;
  let skipped = 0;

  for (const file of files) {
    const content = readFileSync(join(articlesDir, file), 'utf-8');
    const { meta, body } = parseFrontmatter(content);

    const title = meta.title || file.replace(/\.md$/, '').replace(/-/g, ' ');
    const slug = slugify(title);
    const wordCount = body.split(/\s+/).length;

    const { marked } = await import('marked');
    const contentHtml = await marked(body);

    try {
      await pool.query(
        `INSERT INTO articles (client_id, title, slug, content_md, content_html, meta_title, meta_description, word_count, status, pipeline_stage, source, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'complete', 'ai_generated', ARRAY['home-decor', 'egyptian-craftsmanship'])
         ON CONFLICT (slug) DO NOTHING`,
        [clientId, title, slug, body, contentHtml, meta.meta_title || title, meta.meta_description || '', wordCount]
      );
      console.log(`✓ Imported: ${title} (${wordCount} words)`);
      imported++;
    } catch (err: any) {
      if (err.code === '23505') {
        console.log(`~ Skipped (duplicate slug): ${title}`);
        skipped++;
      } else {
        console.error(`✗ Failed: ${title} — ${err.message}`);
      }
    }
  }

  await pool.end();
  console.log(`\nDone. ${imported} imported, ${skipped} skipped.`);
}

main().catch(err => { console.error(err); process.exit(1); });
