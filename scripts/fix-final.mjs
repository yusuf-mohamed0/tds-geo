// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  host: 'localhost', port: 5432, user: 'postgres',
  password: 'postgres', database: 'ai_seo_automation',
});
const OUTPUT_DIR = 'outputs';

// Article 3: Add /products/ link + fix H1 + fix intro
async function fixArticle3() {
  const id = '0f896332-7fae-4c70-8b61-64cef8f86a7d';
  const res = await pool.query(`SELECT content_html FROM articles WHERE id = $1`, [id]);
  let html = res.rows[0].content_html;

  // 1. Add /products/ link in the assembly mistakes section
  html = html.replace(
    '<p>This is the #1 mistake. Outdoor furniture frames — especially aluminium and rattan — need screws snug, not torqued down. Over-tightening strips threads in soft aluminium and can crack rattan weaving.</p>',
    '<p>This is the #1 mistake. Outdoor furniture frames — especially aluminium and rattan — need screws snug, not torqued down. Over-tightening strips threads in soft aluminium and can crack rattan weaving. Quality pieces like <a href="/products/fariq-chair">Alamein\'s Fariq chair</a> use reinforced joints that are forgiving, but even the best frames suffer from over-tightened hardware.</p>'
  );

  // 2. Fix H1 to include "tips"
  html = html.replace(
    '<h1>What Nobody Tells You About Outdoor Furniture Assembly Before Delivery</h1>',
    '<h1>Outdoor Furniture Assembly Tips Nobody Tells You Before Delivery</h1>'
  );

  // 3. Fix intro to include exact keyword
  html = html.replace(
    'This guide covers <strong>outdoor furniture assembly tips</strong> that nobody tells you beforehand',
    'This guide covers essential <strong>outdoor furniture assembly tips</strong> that nobody tells you beforehand — practical <strong>outdoor furniture assembly tips</strong> for Egyptian homes'
  );

  await saveArticle(id, html);
}

// Article 4: Add /products/ link + ensure H1 has exact keyword
async function fixArticle4() {
  const id = '33f69f83-a854-40cb-9df6-3c359ded054f';
  const res = await pool.query(`SELECT content_html FROM articles WHERE id = $1`, [id]);
  let html = res.rows[0].content_html;

  // 1. Add /products/ link in March-April section (teak oil mention)
  html = html.replace(
    '<li>Apply protectant: Spray HDPE rattan with UV protectant. Treat teak with teak oil. Wax powder-coated aluminium.</li>',
    '<li>Apply protectant: Spray HDPE rattan with UV protectant. Treat teak with teak oil — <a href="/products/bamboo-low-chair">teak-framed pieces like the Bamboo low chair</a> benefit from annual oiling. Wax powder-coated aluminium.</li>'
  );

  // 2. H1 already has "outdoor furniture care calendar" ✅
  // 3. Intro already has it ✅

  await saveArticle(id, html);
}

// Article 1: Fix H1 to include "storage"
async function fixArticle1() {
  const id = '3f001b87-dea4-4604-a944-a08a1f0ea79a';
  const res = await pool.query(`SELECT content_html FROM articles WHERE id = $1`, [id]);
  let html = res.rows[0].content_html;

  // Fix H1 to include "storage" keyword more directly
  html = html.replace(
    '<h1>Where to Store Outdoor Cushions in an Egyptian Apartment</h1>',
    '<h1>Outdoor Cushion Storage in Egypt: Where to Store Them in an Apartment</h1>'
  );

  // Fix intro to include exact keyword
  html = html.replace(
    'Egyptian apartments rarely have dedicated <strong>outdoor cushion storage</strong> space. This guide offers real solutions for real Egyptian homes.',
    'Egyptian apartments rarely have dedicated <strong>outdoor cushion storage</strong> space. This guide offers real <strong>outdoor cushion storage Egypt</strong> solutions for real Egyptian homes.'
  );

  await saveArticle(id, html);
}

// Article 2: Fix H1 to include "rooftop furniture Cairo"
async function fixArticle2() {
  const id = '5e118a8d-7dda-43bb-b72e-a321fcf6c844';
  const res = await pool.query(`SELECT content_html FROM articles WHERE id = $1`, [id]);
  let html = res.rows[0].content_html;

  // Fix H1
  html = html.replace(
    '<h1>Can Outdoor Furniture Survive on a Cairo Rooftop?</h1>',
    '<h1>Rooftop Furniture Cairo: Can Outdoor Furniture Survive on a Cairo Rooftop?</h1>'
  );

  // Fix intro to include exact keyword
  html = html.replace(
    'So — can <strong>rooftop furniture in Cairo</strong> actually survive?',
    'So — can <strong>rooftop furniture Cairo</strong> actually survive?'
  );

  await saveArticle(id, html);
}

// Article 5: Fix H1 to include "arrange outdoor furniture shade"
async function fixArticle5() {
  const id = 'd9fe9490-f050-4fd3-a348-cbfb11acb7fc';
  const res = await pool.query(`SELECT content_html FROM articles WHERE id = $1`, [id]);
  let html = res.rows[0].content_html;

  // Fix H1
  html = html.replace(
    '<h1>How to Arrange Outdoor Furniture for Maximum Shade on an Egyptian Terrace</h1>',
    '<h1>How to Arrange Outdoor Furniture for Shade on an Egyptian Terrace</h1>'
  );

  // Fix intro to include exact keyword
  html = html.replace(
    'Learning to <strong>arrange outdoor furniture for shade</strong> is not complicated',
    'Learning how to <strong>arrange outdoor furniture for shade</strong> — and specifically how to <strong>arrange outdoor furniture shade</strong> effectively — is not complicated'
  );

  await saveArticle(id, html);
}

async function saveArticle(id, html) {
  const wc = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
  await pool.query(`UPDATE articles SET content_html = $1, word_count = $2, updated_at = NOW() WHERE id = $3`, [html, wc, id]);

  const fp = path.join(OUTPUT_DIR, `${id}.json`);
  if (fs.existsSync(fp)) {
    const b = JSON.parse(fs.readFileSync(fp, 'utf8'));
    b.content_html = html; b.word_count = wc; b.updated_at = new Date().toISOString();
    fs.writeFileSync(fp, JSON.stringify(b, null, 2));
  }

  const h1s = html.match(/<h1[^>]*>.*?<\/h1>/g) || [];
  const h2s = html.match(/<h2[^>]*>.*?<\/h2>/g) || [];
  console.log(`${id.slice(0,8)}: H1="${h1s[0]?.replace(/<[^>]*>/g,'')}"`);
  console.log(`  H2s: ${h2s.length} | Words: ${wc}`);
  const hasProd = /\/products\//.test(html);
  const hasColl = /\/collections\//.test(html);
  const hasBlog = /\/blogs\/posts\//.test(html);
  console.log(`  Links: /products/=${hasProd} /collections/=${hasColl} /blogs/=${hasBlog}`);
  console.log();
}

async function main() {
  console.log('=== Final Fixes ===\n');
  await fixArticle3();
  await fixArticle4();
  await fixArticle1();
  await fixArticle2();
  await fixArticle5();
  console.log('=== All Final Fixes Applied ===');
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
