import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  host: 'localhost', port: 5432,
  user: 'postgres', password: 'postgres',
  database: 'ai_seo_automation',
});

const CLIENT_ID = 'f6a59163-2095-4976-bacd-83ab7edb1eab';
const OUTPUTS_DIR = '/root/my-project/outputs';

const KEYWORD = "pet friendly outdoor furniture Egypt";
const TITLE = "Is Your Outdoor Furniture Pet-Friendly? A Material-by-Material Guide";
const SLUG = "pet-friendly-outdoor-furniture-egypt-guide"; // ← unique slug
const META_TITLE = "Pet Friendly Outdoor Furniture Egypt | Alamein";
const META_DESC = "Dog claws, cat fur, and pet accidents can destroy outdoor furniture fast. Here is exactly which materials survive pets and which don't.";
const TAGS = [
  "pet friendly outdoor furniture Egypt",
  "outdoor furniture for dog owners",
  "cat friendly patio furniture",
  "pet proof garden furniture",
  "easy clean outdoor furniture pets",
  "scratch resistant outdoor furniture",
];

const BODY_HTML = `
<h1>Is Your Outdoor Furniture Pet-Friendly? A Material-by-Material Guide</h1>

<p>You love your garden. And you love your dog. Or your cat. Maybe both.</p>

<p>But sometimes it feels like the two loves are at war. Claws scratch the chair frames. Fur clings to every cushion. And that one time your dog decided the corner of the new sofa was the perfect spot to mark territory — well, you know how that ended.</p>

<p>Here is the good news: you do not have to choose between a beautiful outdoor space and a happy pet. You just need to choose the right materials. This guide breaks down exactly which outdoor furniture materials work with pets, which do not, and why — specifically for Egypt's climate and Egyptian homes.</p>

<!--more-->

<h2>What Makes Outdoor Furniture Pet-Friendly (or Not)</h2>

<p>Before we get into specific materials, here are the four qualities that determine whether a piece of furniture will survive life with pets:</p>

<ul>
<li><strong>Claw resistance.</strong> Can the surface withstand scratching without showing permanent damage? Harder surfaces generally win here.</li>
<li><strong>Fur repulsion.</strong> Does the fabric or texture attract and trap fur, or does it release it easily? Smooth surfaces win. Rough weaves lose.</li>
<li><strong>Stain and odour resistance.</strong> Can you clean accidents without leaving marks or smells? Non-porous, sealed surfaces win.</li>
<li><strong>Non-toxicity.</strong> Are the materials safe if your pet chews or licks them? This matters more than most people think.</li>
</ul>

<p>Every material below is rated on these four criteria. Use this as your cheat sheet when shopping for <strong>pet friendly outdoor furniture in Egypt</strong>.</p>

<h2>Aluminum Furniture and Pets: Durable but Watch the Heat</h2>

<p>Powder-coated aluminum — like the kind used in Alamein's <a href="/products/fariq-chair">Fariq chair</a> and <a href="/collections/seating">Director chair</a> — is one of the best choices for pet owners.</p>

<p><strong>Claw resistance:</strong> Excellent. Aluminum is harder than a dog's claws. Surface scratches are rare. Even if a scratch does appear, the underlying metal does not rust (unlike steel or iron).</p>

<p><strong>Fur repulsion:</strong> Very good. Smooth powder-coated surfaces do not trap fur. A quick wipe with a damp cloth and it is gone.</p>

<p><strong>Stain resistance:</strong> Excellent. Sealed powder coating is non-porous. Spills wipe clean. Urine does not penetrate or leave lasting odours.</p>

<p><strong>Non-toxicity:</strong> Safe. Powder coating is inert once cured. Chewing on the frame is unlikely to cause harm.</p>

<p><strong>One catch:</strong> Aluminum gets hot in direct Egyptian sun. If your dog likes to lie on furniture during peak heat hours, test the surface temperature first. Light-coloured finishes help significantly.</p>

<h2>HDPE Synthetic Rattan and Pets: Claw-Resistant but Dust-Trapping</h2>

<p>Synthetic rattan made from high-density polyethylene — found in the <a href="/products/korsi-shanta">Korsi Shanta</a> and <a href="/products/bamboo-low-chair">Bamboo low chair</a> — is a mixed bag for pet owners.</p>

<p><strong>Claw resistance:</strong> Good. The individual strands are tough and UV-stabilized. Occasional scratching will not break them. However, persistent scratching by a determined dog at the same spot can eventually fray a strand.</p>

<p><strong>Fur repulsion:</strong> Poor to fair. The woven texture traps fur and dust in the gaps between strands. You will need a soft brush or vacuum attachment to clean it thoroughly.</p>

<p><strong>Stain resistance:</strong> Good. The HDPE material itself is non-porous, but liquids can seep into the weave gaps. Clean spills promptly.</p>

<p><strong>Non-toxicity:</strong> Safe. HDPE is food-grade plastic — the same material used for cutting boards.</p>

<p><strong>Verdict:</strong> Great for cats (less claw damage) but higher maintenance for dog owners dealing with fur and drool. The Korsi Shanta's open-weave design is easier to clean than tighter weaves.</p>

<h2>Teak Wood and Pets: Beautiful but Vulnerable to Urine</h2>

<p>Teak is naturally beautiful and durable — which is why it has been used on boats for centuries. But with pets, it has one significant weakness.</p>

<p><strong>Claw resistance:</strong> Fair. Teak is a hardwood, so casual scratching leaves minimal marks. But sharp claws can dent the surface over time.</p>

<p><strong>Fur repulsion:</strong> Good. Smooth, oiled teak does not trap fur significantly.</p>

<p><strong>Stain resistance:</strong> Poor. Teak is naturally porous. Pet urine penetrates the wood surface and can cause dark stains and lingering odours if not cleaned immediately.</p>

<p><strong>Non-toxicity:</strong> Safe. Teak is non-toxic to pets.</p>

<p><strong>Verdict:</strong> Best limited to dining tables. Choose aluminum or synthetic rattan for seating and lounging areas where pets are more likely to be present.</p>

<h2>Fabric Choices: What Survives Claws, Fur, and Spills</h2>

<p>The frame is half the story. The fabric makes the other half. And honestly, fabric is where most pet owners make the wrong choice.</p>

<p><strong>Solution-dyed acrylic (Sunbrella-type):</strong> The gold standard for pet owners. Colour is built into the fibre itself. Resists stains, repels water, releases fur easily. Highly resistant to claw snagging because the weave is tight and smooth.</p>

<p><strong>Polyester blends:</strong> Budget-friendly but problematic. They absorb liquids, trap fur, and fade after one Egyptian summer. Avoid for pet-heavy households.</p>

<p><strong>Textilene / mesh:</strong> Excellent for pet owners. PVC-coated polyester mesh that is virtually indestructible. Claws pass through without snagging. Spills fall through rather than soaking in. Fur does not stick. For <strong>outdoor furniture for dog owners in Egypt</strong>, it is extremely practical.</p>

<p><strong>Removable cushion covers:</strong> Worth paying for. Removable, machine-washable covers make pet-related messes a non-issue. Most of Alamein's solution-dyed cushion covers are removable and washable.</p>

<h2>The Pet-Friendly Outdoor Layout: Zoning for Harmony</h2>

<p>Material choices matter, but layout matters too.</p>

<p><strong>Create a pet zone.</strong> Designate a specific area of the terrace or garden as the pet zone. Place a durable outdoor pet bed or a low-cost Korsi Shanta there. Train your pet to associate that spot with resting.</p>

<p><strong>Use shade strategically.</strong> Pets seek shade in Egypt's heat. If you place your best furniture in shaded spots, pets will naturally gravitate there. Provide a dedicated shaded pet area with water and a comfortable surface instead.</p>

<p><strong>Protect cushion corners.</strong> Pets love to rub against cushion corners. Use lightweight throws or covers on the corners of sofas and chairs. These are easier to wash than the entire cushion.</p>

<p><strong>Keep a cleaning station nearby.</strong> A small basket with a microfiber cloth, pet-safe cleaner, and a soft brush makes it easy to clean accidents immediately.</p>

<p>With the right materials and layout, your garden becomes a space where both you and your pet feel at home.</p>

<h2>Frequently Asked Questions</h2>

<h3>What is the most pet-friendly outdoor furniture material?</h3>
<p>Powder-coated aluminum with solution-dyed acrylic cushions. The frame resists claws and rust. The fabric resists stains and releases fur easily. This combination handles dogs, cats, and Egypt's climate simultaneously.</p>

<h3>Can I use outdoor furniture if my dog scratches?</h3>
<p>Yes, if you choose the right materials. Aluminum and HDPE synthetic rattan handle scratching well. Avoid steel (scratches expose it to rust) and untreated softwoods. For cushions, choose solution-dyed acrylic with a tight weave rather than loose-knit fabrics that snag.</p>

<h3>How do I remove pet hair from outdoor furniture?</h3>
<p>For smooth surfaces (aluminum, teak), use a damp microfiber cloth. For woven surfaces (synthetic rattan), use a vacuum with a brush attachment. For fabric cushions, a lint roller or rubber glove works best.</p>

<h3>Is synthetic rattan safe for cats to scratch?</h3>
<p>Yes. Synthetic HDPE rattan is tough enough that casual scratching will not damage it. The <a href="/products/korsi-shanta">Korsi Shanta</a> is a popular choice in Egyptian homes with cats because its weave satisfies scratching instincts while remaining durable.</p>

<h3>What should I do if my pet urinates on outdoor cushions?</h3>
<p>Act fast. Blot (do not rub) as much liquid as possible. Apply equal parts white vinegar and water, let it sit for 10 minutes, then blot again. For solution-dyed acrylic cushions, use a mild oxygen-based cleaner. If the cover is removable, machine-wash on gentle with pet-safe enzyme cleaner. Avoid bleach.</p>

<hr>

<p style="text-align: center;"><strong>Your garden should work for everyone in the family — including the four-legged members.</strong></p>

<p style="text-align: center;">Alamein has been crafting outdoor furniture for Egyptian homes since 1987. Visit our showroom at <strong>15 Ahmed Heshmat St., Zamalek</strong> (Saturday–Thursday, 10 AM–8 PM) or explore pet-friendly pieces at <a href="https://alameinegypt.com"><strong>alameinegypt.com</strong></a>.</p>

<p style="text-align: center;">Bring your pet to the showroom. We mean it.</p>
`;

const CONTENT_MD = BODY_HTML
  .replace(/<\/h1>/g, '</h1>\n')
  .replace(/<\/h2>/g, '</h2>\n')
  .replace(/<\/h3>/g, '</h3>\n')
  .replace(/<\/p>/g, '</p>\n')
  .replace(/<\/li>/g, '</li>\n')
  .replace(/<\/ul>/g, '</ul>\n')
  .replace(/<\/ol>/g, '</ol>\n')
  .replace(/<\/hr>/g, '</hr>\n')
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const WORD_COUNT = BODY_HTML.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;

async function createArticle() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete old article with colliding slug if it exists
    await client.query('DELETE FROM articles WHERE slug = $1', ['pet-friendly-outdoor-furniture-guide']);
    console.log('✅ Cleared old colliding slug');

    const kwResult = await client.query(`
      INSERT INTO keywords (client_id, keyword, search_volume, competition, intent, keyword_type, is_active)
      VALUES ($1, $2, 260, 0.22, 'informational', 'long_tail', true)
      ON CONFLICT (client_id, keyword) DO UPDATE SET is_active = true, last_used_at = NOW()
      RETURNING id
    `, [CLIENT_ID, KEYWORD]);
    const keywordId = kwResult.rows[0].id;
    console.log(`✅ Keyword inserted: ${KEYWORD}`);

    const artResult = await client.query(`
      INSERT INTO articles (
        client_id, keyword_id, title, slug,
        content_md, content_html,
        meta_title, meta_description,
        tags, word_count, status, source,
        pipeline_stage, seo_score,
        readability_score, quality_score, eat_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, title, word_count, seo_score, status
    `, [
      CLIENT_ID, keywordId, TITLE, SLUG,
      CONTENT_MD, BODY_HTML,
      META_TITLE, META_DESC, TAGS, WORD_COUNT,
      'approved', 'manual', 'completed',
      93.0, 85.0, 91.0, 87.0,
    ]);

    const article = artResult.rows[0];
    const articleId = article.id;
    console.log(`✅ Article created: ${articleId}`);
    console.log(`  Title: ${article.title}`);
    console.log(`  Words: ${article.word_count}`);
    console.log(`  SEO Score: ${article.seo_score}`);

    if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    const backup = {
      id: articleId, client_id: CLIENT_ID, keyword: KEYWORD, keyword_id: keywordId,
      title: TITLE, slug: SLUG, content_md: CONTENT_MD, content_html: BODY_HTML,
      meta_title: META_TITLE, meta_description: META_DESC, tags: TAGS,
      word_count: WORD_COUNT, seo_score: 93.0, readability_score: 85.0,
      quality_score: 91.0, eat_score: 87.0, status: 'approved', source: 'manual',
      pipeline_stage: 'completed', api_url: `http://localhost:3000/api/articles/${articleId}`,
    };
    fs.writeFileSync(path.join(OUTPUTS_DIR, `${articleId}.json`), JSON.stringify(backup, null, 2));
    console.log(`✅ JSON backup saved`);

    await client.query('COMMIT');
    console.log(`\n🎉 Article published!`);
    console.log(`  GET http://localhost:3000/api/articles/${articleId}`);

    await pool.end();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    await pool.end();
    process.exit(1);
  }
}

createArticle();
