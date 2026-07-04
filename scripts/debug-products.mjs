import 'dotenv/config';

const WP_KEY = 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1';
const HEADERS = { 'X-TDS-GEO-Key': WP_KEY, 'Content-Type': 'application/json' };

async function main() {
  // Try WP native with status=any
  const res1 = await fetch('https://boston-pharma.com/wp-json/wp/v2/product?per_page=5&status=any', { headers: HEADERS });
  const d1 = await res1.json();
  console.log('WP /product (status=any):', Array.isArray(d1) ? d1.length + ' results' : JSON.stringify(d1).slice(0,200));

  // Try TDS Geo plugin /posts with post_type=product
  const res2 = await fetch('https://boston-pharma.com/wp-json/tds-geo/v1/posts?post_type=product&per_page=5', { headers: HEADERS });
  const d2 = await res2.json();
  const products = d2.data || [];
  console.log('TDS Geo /posts (post_type=product):', products.length + ' results');
  for (const p of products.slice(0, 3)) {
    console.log(`  ID: ${p.id} Status: ${p.status} Title: ${(p.title||'').slice(0,40)}`);
  }

  // Get total count
  const res3 = await fetch('https://boston-pharma.com/wp-json/tds-geo/v1/posts?post_type=product&per_page=500', { headers: HEADERS });
  const d3 = await res3.json();
  const allProducts = d3.data || [];
  const withDesc = allProducts.filter(p => (p.content||'').length > 20).length;
  const withoutDesc = allProducts.filter(p => (p.content||'').length < 20).length;
  console.log(`\nTotal products: ${allProducts.length}`);
  console.log(`With description: ${withDesc}`);
  console.log(`Without description: ${withoutDesc}`);
  console.log(`Statuses: ${[...new Set(allProducts.map(p => p.status))].join(', ')}`);
}

main();
