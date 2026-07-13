const { Pool } = require("pg");
const pool = new Pool({ connectionString: "postgresql://kozmocore:91acf414168a04e995fd6198f74758b8@127.0.0.1:5432/ai_seo_automation" });

const API_VERSION = "2025-07";
const SHOPIFY_TOKEN_CACHE = {};

async function getToken(slug) {
  if (SHOPIFY_TOKEN_CACHE[slug]) return SHOPIFY_TOKEN_CACHE[slug];
  const r = await pool.query("SELECT shopify_token, shopify_shop FROM clients WHERE slug=$1", [slug]);
  SHOPIFY_TOKEN_CACHE[slug] = r.rows[0] || null;
  return SHOPIFY_TOKEN_CACHE[slug];
}

function cleanHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function excerpt(html, max = 200) {
  const text = cleanHtml(html);
  if (text.length <= max) return text;
  return text.substring(0, max).replace(/\s+\S*$/, "") + "...";
}

function pageTitle(title, fallback) {
  const t = title || fallback || "";
  return t.substring(0, 70);
}

function metaDesc(html, existingDesc) {
  if (existingDesc && existingDesc.trim()) return existingDesc.trim().substring(0, 160);
  return excerpt(html, 150).substring(0, 160);
}

// Alamein extra content to make articles taller
const ALAMEIN_EXTRA = {
  0: `<h2>Benefits of Outdoor Play for Children</h2><p>Outdoor play is essential for children physical and mental development. It encourages creativity, improves motor skills, and promotes social interaction. With the right playground equipment, children can develop confidence and independence while having fun.</p><p>Studies show that children who play outdoors regularly have better concentration, stronger immune systems, and healthier sleep patterns. In Egypt climate, morning and late afternoon play times are ideal during summer months.</p><h2>Safety Tips for Egyptian Gardens</h2><p>When installing playground equipment, ensure the ground surface is soft. Sand, rubber mats, or grass work well. Regular maintenance checks for loose bolts, rust, or wear are important. Alamein equipment is powder-coated for weather resistance, but periodic checks ensure longevity.</p><p>Position equipment away from direct afternoon sun. Adding a shade structure or umbrella can make the play area comfortable year-round.</p><h2>Why Choose Alamein for Playground Equipment</h2><p>With over 30 years of experience, Alamein understands what Egyptian families need. Our equipment is designed for local climate conditions, tested for safety, and backed by our manufacturing warranty from our 5000 sqm factory in Shabramant, Cairo.</p>`,
  1: `<h2>Benefits of Outdoor Exercise</h2><p>Exercising outdoors offers unique advantages over indoor workouts. Natural light boosts vitamin D levels, fresh air improves lung function, and varied terrain challenges different muscle groups. Outdoor gyms also eliminate membership fees and commuting time.</p><p>For older adults, outdoor fitness equipment provides low-impact exercise options that improve mobility, balance, and cardiovascular health without the intimidation of a traditional gym.</p><h2>Designing an Outdoor Fitness Area</h2><p>When planning an outdoor gym, consider shade coverage, ground surface (rubber flooring or grass), and equipment spacing. A well-designed layout allows multiple users simultaneously while maintaining safety distances.</p><p>Alamein offers consultation services to help compounds, schools, and municipalities design optimal fitness layouts based on available space and target users.</p><h2>Maintenance Tips</h2><p>Outdoor fitness equipment requires minimal maintenance. Monthly checks for loose hardware, occasional cleaning, and annual lubrication of moving parts keep equipment safe and functional for years.</p>`,
  2: `<h2>Why Game Tables Are Making a Comeback</h2><p>In an age of digital entertainment, physical game tables are experiencing a resurgence. People crave face-to-face interaction, tactile experiences, and the joy of friendly competition. Billiards, foosball, and table tennis bring family and friends together in ways screens cannot replicate.</p><p>Egyptian cafes and clubs increasingly feature game tables as attractions. A billiard table draws customers and encourages longer visits. Foosball tables create lively atmospheres perfect for social gatherings.</p><h2>Choosing the Right Game Table</h2><p>Consider available space, intended users, and frequency of use. Home tables can be more compact, while commercial venues need commercial-grade durability. Alamein offers both residential and commercial lines, ensuring the right fit for every setting.</p><p>Accessories matter too: quality cues, balls, paddles, and covers extend the life of your game table and enhance the playing experience.</p><h2>Alamein Legacy in Game Tables</h2><p>As pioneers of billiard table manufacturing in Egypt, Alamein brings decades of expertise to every game table we produce. Our tables are crafted with precision, using premium materials sourced both locally and internationally.</p>`,
  3: `<h2>Why Outdoor Seating Matters for Hospitality</h2><p>Outdoor seating can increase a venue capacity by 30-50% during good weather. In Egypt mild winter and long summer evenings, al fresco dining is popular from October through May. Well-designed outdoor furniture makes this possible while maintaining comfort and style.</p><p>Beyond capacity, outdoor seating enhances the dining experience. Guests prefer fresh air, natural light, and the ambiance of a well-designed terrace. Restaurants with attractive outdoor spaces consistently receive higher ratings on review platforms.</p><h2>Materials That Last</h2><p>Egypt climate demands furniture that resists sun, heat, and occasional humidity. Alamein uses powder-coated aluminum frames that do not rust, UV-resistant synthetic wicker that does not fade, and marine-grade hardware that withstands coastal environments.</p><p>Our furniture is designed for easy cleaning and low maintenance. Cushions use quick-dry foam and water-resistant fabrics suitable for outdoor conditions.</p><h2>Custom Solutions for Your Venue</h2><p>Every venue is unique. Alamein offers custom configurations, branding options, and color choices to match your establishment identity. From intimate cafe terraces to large hotel pool decks, we deliver furniture that fits both the space and the brand.</p>`
};

async function updateShopifyArticle(slug, blogId, articleId, data) {
  const client = await getToken(slug);
  if (!client || !client.shopify_token) throw new Error(`No token for ${slug}`);
  const shop = client.shopify_shop;
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/blogs/${blogId}/articles/${articleId}.json`, {
    method: "PUT",
    headers: { "X-Shopify-Access-Token": client.shopify_token, "Content-Type": "application/json" },
    body: JSON.stringify({ article: data })
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.substring(0,200)}`);
  return JSON.parse(txt);
}

(async () => {
  // === ALAMEIN ===
  console.log("=== Updating Alamein ===");
  const alameinArticles = await pool.query(`
    SELECT a.id, a.title, a.content_html, a.scheduled_at, ph.shopify_article_id
    FROM articles a
    JOIN clients c ON c.id = a.client_id
    JOIN publishing_history ph ON ph.article_id = a.id AND ph.shopify_article_id IS NOT NULL
    WHERE c.slug = 'alamein-2022'
    ORDER BY a.scheduled_at ASC
  `);

  for (let i = 0; i < alameinArticles.rows.length; i++) {
    const a = alameinArticles.rows[i];
    const extra = ALAMEIN_EXTRA[i] || "";
    const fullHtml = a.content_html + extra;

    const result = await updateShopifyArticle("alamein-2022", 79774056505, a.shopify_article_id, {
      id: a.shopify_article_id,
      body_html: fullHtml,
      summary_html: excerpt(fullHtml, 200),
      metafields_global_title_tag: pageTitle(a.title).substring(0, 70),
      metafields_global_description_tag: metaDesc(fullHtml),
    });
    const updatedId = result.article?.id;
    console.log(`  Alamein #${i+1} (${(a.title || "").substring(0,50)}...): updated id=${updatedId}`);

    // Update content in TDS DB too
    await pool.query("UPDATE articles SET content_html=$1, updated_at=NOW() WHERE id=$2", [fullHtml, a.id]);
  }

  // === CARAVANSERAI ===
  console.log("=== Updating Caravanserai ===");
  const caravanseraiArticles = await pool.query(`
    SELECT a.id, a.title, a.content_html, a.scheduled_at, a.meta_title, a.meta_description, ph.shopify_article_id
    FROM articles a
    JOIN clients c ON c.id = a.client_id
    JOIN publishing_history ph ON ph.article_id = a.id AND ph.shopify_article_id IS NOT NULL
    WHERE c.slug = 'caravanserai'
    ORDER BY a.scheduled_at ASC
  `);

  for (const a of caravanseraiArticles.rows) {
    const result = await updateShopifyArticle("caravanserai", 78074216615, a.shopify_article_id, {
      id: a.shopify_article_id,
      summary_html: excerpt(a.content_html, 200),
      metafields_global_title_tag: pageTitle(a.meta_title || a.title).substring(0, 70),
      metafields_global_description_tag: metaDesc(a.content_html, a.meta_description),
    });
    console.log(`  Caravanserai (${(a.title || "").substring(0,50)}...): updated id=${result.article?.id}`);
  }

  console.log("DONE");
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
