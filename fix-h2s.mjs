import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  host: 'localhost', port: 5432, user: 'postgres',
  password: 'postgres', database: 'ai_seo_automation',
});
const OUTPUT_DIR = 'outputs';

// Article 2: Replace first H2 to include exact keyword "rooftop furniture Cairo"
async function fixArticle2() {
  const id = '5e118a8d-7dda-43bb-b72e-a321fcf6c844';
  const res = await pool.query(`SELECT content_html FROM articles WHERE id = $1`, [id]);
  let html = res.rows[0].content_html;

  // Replace: <h2>What Makes Rooftop Furniture in Cairo So Challenging</h2>
  // With:    <h2>Choosing Rooftop Furniture Cairo — What Makes It So Challenging</h2>
  html = html.replace(
    '<h2>What Makes Rooftop Furniture in Cairo So Challenging</h2>',
    '<h2>Choosing Rooftop Furniture Cairo — What Makes It So Challenging</h2>'
  );

  const wc = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
  await pool.query(`UPDATE articles SET content_html = $1, word_count = $2, updated_at = NOW() WHERE id = $3`, [html, wc, id]);

  const fp = path.join(OUTPUT_DIR, `${id}.json`);
  if (fs.existsSync(fp)) {
    const b = JSON.parse(fs.readFileSync(fp, 'utf8'));
    b.content_html = html; b.word_count = wc; b.updated_at = new Date().toISOString();
    fs.writeFileSync(fp, JSON.stringify(b, null, 2));
  }

  // Verify
  const h2s = html.match(/<h2[^>]*>.*?<\/h2>/g) || [];
  const kwMatch = h2s.some(h2 => h2.toLowerCase().includes('rooftop furniture cairo'));
  console.log(`Article 2 - Keyword "rooftop furniture Cairo" in H2: ${kwMatch ? '✅' : '❌'}`);
  console.log(`  H2s: ${h2s.length} | Words: ${wc}`);
}

// Article 5: Replace first H2 to include exact keyword "arrange outdoor furniture shade"
async function fixArticle5() {
  const id = 'd9fe9490-f050-4fd3-a348-cbfb11acb7fc';
  const res = await pool.query(`SELECT content_html FROM articles WHERE id = $1`, [id]);
  let html = res.rows[0].content_html;

  // Replace: <h2>How to Arrange Outdoor Furniture for Shade — Understanding the Sun</h2>
  // With:    <h2>How to Arrange Outdoor Furniture for Shade — Understanding Sun and Shade</h2>
  // Actually, I need to include the exact keyword "arrange outdoor furniture shade"
  // Let me change the H2 to include it directly
  html = html.replace(
    '<h2>How to Arrange Outdoor Furniture for Shade — Understanding the Sun</h2>',
    '<h2>How to Arrange Outdoor Furniture for Shade — Sun Angles and Positioning</h2>'
  );

  // Hmm, that still doesn't have the exact keyword. Let me check what the exact keyword is: "arrange outdoor furniture shade"
  // I need the H2 to contain that exact string. Let me make a different H2 include it.
  // Let me change the last strategy H2 instead, or better yet, change the intro.
  // Actually, let me just add the keyword into the first H2 directly.
  
  // Undo: restore original html
  html = res.rows[0].content_html;
  
  // Change the first H2 to include the exact keyword
  html = html.replace(
    '<h2>How to Arrange Outdoor Furniture for Shade — Understanding the Sun</h2>',
    '<h2>How to Arrange Outdoor Furniture for Shade — Understanding Sun Angles</h2>'
  );
  
  // The keyword is "arrange outdoor furniture shade" - the H2 says "How to Arrange Outdoor Furniture for Shade"
  // The "for" and "How to" break the exact match. Let me change a different H2.
  // Let me change Strategy 3 H2 since it's about shade and could naturally include the keyword.
  html = html.replace(
    '<h2>Strategy 3: Create Micro-Climates with Plants and Screens</h2>',
    '<h2>Strategy 3: Arrange Outdoor Furniture for Shade with Plants and Screens</h2>'
  );
  
  // Now check: does "arrange outdoor furniture shade" appear in any H2?
  // "Arrange Outdoor Furniture for Shade with Plants and Screens" - still has "for" breaking the match.
  
  // I need to remove the "for". Let me try a different approach:
  // Change one H2 to: "How to Arrange Outdoor Furniture Shade with Plants" - but that's awkward.
  // Or make the H2: "Arranging Outdoor Furniture Shade with Plants" - close.
  
  // Actually, the most natural fix: change the Strategy 3 H2 to include "arrange outdoor furniture shade" without filler
  html = html.replace(
    '<h2>Strategy 3: Arrange Outdoor Furniture for Shade with Plants and Screens</h2>',
    '<h2>Strategy 3: Arrange Outdoor Furniture Shade — Plants and Screens</h2>'
  );
  
  // Now let me verify
  
  const wc = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
  await pool.query(`UPDATE articles SET content_html = $1, word_count = $2, updated_at = NOW() WHERE id = $3`, [html, wc, id]);

  const fp = path.join(OUTPUT_DIR, `${id}.json`);
  if (fs.existsSync(fp)) {
    const b = JSON.parse(fs.readFileSync(fp, 'utf8'));
    b.content_html = html; b.word_count = wc; b.updated_at = new Date().toISOString();
    fs.writeFileSync(fp, JSON.stringify(b, null, 2));
  }

  const h2s = html.match(/<h2[^>]*>.*?<\/h2>/g) || [];
  const kwMatch = h2s.some(h2 => h2.toLowerCase().includes('arrange outdoor furniture shade'));
  console.log(`Article 5 - Keyword "arrange outdoor furniture shade" in H2: ${kwMatch ? '✅' : '❌'}`);
  console.log(`  H2s: ${h2s.length} | Words: ${wc}`);
  h2s.forEach((h, i) => console.log(`  H2 #${i+1}: ${h}`));
}

async function main() {
  console.log('=== Fixing Remaining H2 Keywords ===\n');
  await fixArticle2();
  console.log();
  await fixArticle5();
  console.log('\n=== Done ===');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
