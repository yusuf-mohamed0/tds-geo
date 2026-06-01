import pg from 'pg';
import { BlogPipelineOrchestrator } from './backend/orchestrators/blogPipeline.ts';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_seo_automation'
});

const ALAMEIN_CLIENT_ID = 'f6a59163-2095-4976-bacd-83ab7edb1eab';
const KEYWORD = 'best outdoor furniture for Egyptian villas';

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   ALAMEIN OUTDOOR FURNITURE — CONTENT PIPELINE      ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

console.log('Brand:', 'Alamein Outdoor Furniture (est. 1987)');
console.log('Niche:', 'Egyptian outdoor furniture manufacturer & retailer');
console.log('Keyword:', KEYWORD);
console.log('Tone:', "Aspirational, warm, sophisticated - lifestyle oriented\n");

const orchestrator = new BlogPipelineOrchestrator(pool);

const result = await orchestrator.runFullPipeline(
  ALAMEIN_CLIENT_ID,
  KEYWORD,
  {
    tone: `Aspirational, warm, and sophisticated — positioned as a premium lifestyle brand for outdoor living. Writing should evoke feeling: comfort, nature, connection, intentional living. Tone is accessible but elevated. Use descriptive, sensory language. Frame products as tools for creating moments and memories.`,
    minWords: 1500,
    maxWords: 2500,
    bypassDedup: true,
    publish: false
  }
);

console.log(`\n${'═'.repeat(54)}`);
console.log('FINAL RESULT');
console.log(`${'═'.repeat(54)}\n`);

if (result.success) {
  console.log(`✅ Pipeline Complete`);
  console.log(`   Title:       ${result.title}`);
  console.log(`   Article ID:  ${result.articleId}`);
  console.log(`   Word Count:  ${result.wordCount}`);
  console.log(`   SEO Score:   ${result.seoScore}/100`);
  console.log(`   Duration:    ${result.duration}`);
  console.log(`   API URL:     /api/articles/${result.articleId}`);
  console.log(`   Access:      http://localhost:3000/api/articles/${result.articleId}`);
} else {
  console.log(`❌ Pipeline Failed`);
  console.log(`   Error: ${result.error}`);
}

console.log(`\n${'═'.repeat(54)}`);
console.log('STAGE RESULTS');
console.log(`${'═'.repeat(54)}\n`);

for (const stage of result.stages) {
  const icon = stage.success ? '✅' : '❌';
  console.log(`  ${icon} ${stage.stageName.padEnd(25)} ${stage.durationMs}ms`);
  if (stage.error) console.log(`     Error: ${stage.error}`);
}

console.log(`\n${'═'.repeat(54)}`);
console.log('BRAND CONTEXT APPLIED');
console.log(`${'═'.repeat(54)}\n`);
console.log(`  Target Audience: Egyptian homeowners, villa owners, hospitality`);
console.log(`  Service Area:    Egypt (North Coast, Red Sea, Cairo)`);
console.log(`  CTA Template:    Explore collection & book showroom appointment`);
console.log(`  Voice:           Aspirational, warm, sophisticated\n`);

console.log(`${'═'.repeat(54)}`);
console.log('NEXT STEPS');
console.log(`${'═'.repeat(54)}\n`);
console.log(`  1. Review article at /api/articles/${result.articleId}`);
console.log(`  2. Configure Shopify API keys in .env for publishing`);
console.log(`  3. Set OPENAI_API_KEY for premium content generation`);
console.log(`  4. Run with publish: true to push to alameinegypt.myshopify.com\n`);

await pool.end();
console.log('Done.');
