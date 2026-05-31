import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  host: 'localhost', port: 5432,
  user: 'postgres', password: 'postgres',
  database: 'ai_seo_automation',
});

const ARTICLE_ID = 'b10e1dc4-1a12-4235-89d9-d6f0ebd72751';
const FIXED_TITLE = "How to Maintain Outdoor Furniture in Egypt's Climate";

async function fix() {
  // Update DB
  await pool.query(
    'UPDATE articles SET title = $1 WHERE id = $2::uuid',
    [FIXED_TITLE, ARTICLE_ID]
  );
  console.log('✅ DB title fixed');

  // Verify
  const r = await pool.query(
    'SELECT title, slug FROM articles WHERE id = $1::uuid',
    [ARTICLE_ID]
  );
  console.log('  Title:', r.rows[0].title);

  // Fix JSON backup
  const fp = `/root/my-project/outputs/${ARTICLE_ID}.json`;
  const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  data.title = FIXED_TITLE;
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log('✅ JSON backup title fixed');

  await pool.end();
}

fix().catch(console.error);
