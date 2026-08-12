const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Usage: DATABASE_URL=postgresql://user:pass@host:5432/db node alamein-seed.cjs");
  process.exit(1);
}
const BLOG_ID = 79774056505;
const SHOP = "alamein-2022.myshopify.com";
const API_VERSION = "2025-07";
async function shopify(path, opts = {}) {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}${path}`, { ...opts, headers: { "X-Shopify-Access-Token": opts.token, "Content-Type": "application/json" } });
  const txt = await res.text();
  let d = {};
  try { d = txt ? JSON.parse(txt) : {}; } catch { d = { raw: txt }; }
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(d)}`);
  return d;
}
const articles = [
  { title: "Why Every Egyptian Garden Needs a Kids Play Area: A Guide to Choosing Playground Equipment",
    content: "<p>Creating a space where children can play safely outdoors is a priority for many Egyptian families. From swing sets to jungle gyms, the right playground equipment transforms a garden.</p><p>Alamein has been designing playground equipment since the early 1990s. Our range includes playhouses for gardens and jungle gyms for schools and parks.</p><h2>What to Consider When Choosing Playground Equipment</h2><p>Space is the first consideration. A small garden suits a compact swing set, while larger spaces can accommodate multi-activity jungle gyms.</p><p>Safety is paramount. All Alamein playground equipment has rounded edges, sturdy construction, and non-toxic materials for the Egyptian climate.</p><h2>Popular Playground Options from Alamein</h2><p>Our jungle gyms feature multiple play stations. Swing sets come in various sizes. Playhouses spark imaginative play. We offer commercial-grade equipment for schools and public spaces.</p>",
    tags: ["playground equipment","kids outdoor play","jungle gym Egypt","swing sets","children play area"] },
  { title: "Bring the Gym Outdoors: How Outdoor Fitness Equipment Is Changing the Way Egyptians Stay Active",
    content: "<p>Outdoor fitness equipment is transforming how Egyptians exercise. More people discover the benefits of working out in fresh air.</p><p>Alamein outdoor fitness range includes pull-up bars, parallel bars, leg press machines, chest press stations, and multi-function workout stations for parks, compounds, schools, and hotels.</p><h2>Why Choose Outdoor Fitness Equipment?</h2><p>Outdoor gyms are accessible free, 24/7. They encourage community engagement. Studies show outdoor exercise boosts mood.</p><p>For residential compounds, an outdoor fitness area adds value. Hotels can offer al fresco workout spaces.</p><h2>Alamein Outdoor Fitness Range</h2><p>Our equipment is galvanized steel with UV-resistant coating for Egypt climate. Each piece has ergonomic grips and clear instructions.</p><p>We offer packages from compact 3-station to comprehensive 10-station outdoor gyms.</p>",
    tags: ["outdoor fitness equipment","outdoor gym Egypt","public park gym","fitness equipment","open air gym"] },
  { title: "From Billiards to Foosball: The Art of Game Tables in Egyptian Homes and Gatherings",
    content: "<p>Game tables bring people together. Billiards, foosball, or table tennis transforms a home or commercial space into entertainment hub.</p><p>Alamein history with game tables goes back decades. Founder Hamid Sabry pioneered billiard table manufacturing in Egypt.</p><h2>Types of Game Tables from Alamein</h2><p>Our billiard tables come in sizes from compact 6-foot for home rooms to full-size 9-foot for clubs. Each has premium slate beds and professional cloth.</p><p>Foosball tables offer fast-paced fun. Table tennis is available indoor and outdoor. Multi-game tables combine billiards, table tennis, and air hockey.</p><h2>Where to Place a Game Table</h2><p>Dedicated game rooms are ideal, but tables also work in living rooms, rooftops, and garden rooms. Clubhouse lounges and cafes benefit from a quality game table.</p>",
    tags: ["billiard table Egypt","foosball table","game tables","table tennis","home entertainment"] },
  { title: "Designing Outdoor Spaces for Restaurants and Cafes: Why Commercial Furniture Matters",
    content: "<p>For restaurants and cafes in Egypt, outdoor seating is key to guest experience. The right commercial outdoor furniture transforms a terrace into a destination.</p><p>Alamein manufactures commercial-grade outdoor furniture for hospitality: durable, stackable, easy maintenance, aesthetic.</p><h2>What Makes Furniture Commercial-Grade?</h2><p>Commercial outdoor furniture withstands constant use, weather, and cleaning. Alamein uses reinforced aluminum, commercial-grade synthetic wicker, and marine-grade stainless steel.</p><p>Stackability lets venues reconfigure spaces quickly.</p><h2>Collections for Hospitality</h2><p>The Dahab collection offers clean lines for modern cafes. The Wadi collection adds elegance to rooftop restaurants. The Delta collection suits upscale venues.</p><p>All collections available in dining sets, lounge groupings, and bar-height tables.</p>",
    tags: ["commercial outdoor furniture","restaurant furniture Egypt","cafe outdoor seating","hospitality furniture","stackable chairs"] }
];
(async () => {
  const r = await pool.query("SELECT id, shopify_token FROM clients WHERE slug=$1", ["alamein-2022"]);
  const c = r.rows[0];
  if (!c) { console.log("NO_CLIENT"); return; }
  const start = Date.UTC(2026, 6, 16, 10, 0, 0);
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const dt = new Date(start + i * 7 * 86400000);
    const x = await shopify(`/blogs/${BLOG_ID}/articles.json`, {
      method: "POST", token: c.shopify_token,
      body: JSON.stringify({ article: { title: a.title, body_html: a.content, tags: a.tags.join(", "), author: "Kivo Geo", published: false, published_at: null } })
    });
    const sa = x.article;
    console.log(`#${i+1} Shopify id=${sa.id} ${a.title.substring(0,50)}`);
    const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const tr = await pool.query(
      "INSERT INTO articles (client_id,title,slug,content_html,content_md,tags,status,source,word_count,scheduled_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
      [c.id, a.title, slug, a.content, a.content, a.tags, "approved", "generated", a.content.split(" ").length, dt]
    );
    if (tr.rows[0]) {
      await pool.query(
        "INSERT INTO publishing_history (article_id,client_id,shopify_article_id,shopify_blog_id,published_url,status,published_at) VALUES ($1,$2,$3,$4,$5,$6,NULL)",
        [tr.rows[0].id, c.id, sa.id, BLOG_ID, `https://${SHOP}/blogs/posts/${sa.handle}`, "pending"]
      );
      console.log(`  scheduled ${dt.toISOString()}`);
    }
  }
  console.log("DONE");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
