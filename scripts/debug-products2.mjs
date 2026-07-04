// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import 'dotenv/config';

const WP_KEY = 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1';
const HEADERS = { 'X-TDS-GEO-Key': WP_KEY, 'Content-Type': 'application/json' };

async function main() {
  // Use TDS Geo plugin with pagination
  let all = [];
  for (let offset = 0; ; offset += 50) {
    const res = await fetch(
      `https://boston-pharma.com/wp-json/tds-geo/v1/posts?post_type=product&limit=50&offset=${offset}`,
      { headers: HEADERS }
    );
    const d = await res.json();
    const items = d.data || [];
    if (items.length === 0) break;
    all.push(...items);
  }

  console.log(`Total products: ${all.length}`);
  const withDesc = all.filter(p => (p.content || '').length > 20).length;
  const withoutDesc = all.filter(p => (p.content || '').length < 20).length;
  const withExcerpt = all.filter(p => (p.excerpt || '').length > 10).length;
  const withoutExcerpt = all.filter(p => (p.excerpt || '').length < 10).length;

  console.log(`With description: ${withDesc}`);
  console.log(`Without description: ${withoutDesc}`);
  console.log(`With excerpt: ${withExcerpt}`);
  console.log(`Without excerpt: ${withoutExcerpt}`);

  // Check some specific products
  const sample = all.filter(p => (p.content || '').length > 20).slice(0, 3);
  console.log('\nSample updated products:');
  for (const p of sample) {
    console.log(`  ID: ${p.id} | ${(p.title || '').slice(0, 40)}`);
    console.log(`  Content: ${(p.content || '').slice(0, 80)}`);
    console.log(`  Excerpt: ${(p.excerpt || '').slice(0, 80)}`);
    console.log(`  Meta-T: ${(p.meta?.title || '').slice(0, 60)}`);
    console.log(`  Meta-D: ${(p.meta?.description || '').slice(0, 80)}`);
    console.log('');
  }

  // Check the failed product
  const failed = all.find(p => (p.title || '').includes('Brilliant hand gel'));
  if (failed) {
    console.log('Failed product (Brilliant hand gel):');
    console.log(`  Content length: ${(failed.content || '').length}`);
    console.log(`  Content: "${(failed.content || '').slice(0, 100)}"`);
  }
}

main();
