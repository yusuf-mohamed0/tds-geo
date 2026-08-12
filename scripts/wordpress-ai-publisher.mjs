#!/usr/bin/env node
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

/**
 * ════════════════════════════════════════════════════════════════
 * Kivo Geo - WordPress Article Publisher
 * ════════════════════════════════════════════════════════════════
 *
 * A standalone script that generates SEO-optimized articles using
 * OpenAI and publishes them to your WordPress site via the Kivo Geo
 * WP Plugin REST API.
 *
 * No external SDK dependencies — uses raw fetch() calls throughout.
 *
 * Usage:
 *   # Generate and publish one article
 *   node scripts/wordpress-ai-publisher.mjs --keyword "SEO tips for small business"
 *
 *   # Generate and save as draft (don't auto-publish)
 *   node scripts/wordpress-ai-publisher.mjs --keyword "content marketing" --status draft
 *
 *   # Batch publish from a file (one keyword per line)
 *   node scripts/wordpress-ai-publisher.mjs --batch keywords.txt
 *
 *   # Check connection
 *   node scripts/wordpress-ai-publisher.mjs --test
 *
 *   # Pick a random topic (for cron automation)
 *   node scripts/wordpress-ai-publisher.mjs --pick-topic
 *
 *   # List available categories
 *   node scripts/wordpress-ai-publisher.mjs --list-categories
 *
 * Environment Variables (.env):
 *   OPENAI_API_KEY                  Required: Your OpenAI API key
 *   KIVO_WORDPRESS_URL          Required: Your WordPress site URL
 *   KIVO_WORDPRESS_API_KEY      Required: Your Kivo Geo API key
 *   OPENAI_MODEL                    Optional: Model name (default: gpt-4o)
 *   CONTENT_MIN_WORDS               Optional: Min word count (default: 800)
 *   CONTENT_MAX_WORDS               Optional: Max word count (default: 1500)
 *   CONTENT_TONE                    Optional: Writing tone (default: informative)
 *   KIVO_DEFAULT_AUTHOR_ID      Optional: WP author ID (default: 1)
 *
 * ════════════════════════════════════════════════════════════════
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ──────────────────────────────────────────────
const CFG = {
  wpUrl: process.env.KIVO_WORDPRESS_URL || '',
  wpApiKey: process.env.KIVO_WORDPRESS_API_KEY || '',
  apiNs: 'kivo/v1',
  openaiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10),
  minWords: parseInt(process.env.CONTENT_MIN_WORDS || '800', 10),
  maxWords: parseInt(process.env.CONTENT_MAX_WORDS || '1500', 10),
  tone: process.env.CONTENT_TONE || 'informative',
  authorId: parseInt(process.env.KIVO_DEFAULT_AUTHOR_ID || '1', 10),
};

// ─── Validation ─────────────────────────────────────────────────
function validate() {
  const missing = [];
  if (!CFG.openaiKey) missing.push('OPENAI_API_KEY');
  if (!CFG.wpUrl) missing.push('KIVO_WORDPRESS_URL');
  if (!CFG.wpApiKey) missing.push('KIVO_WORDPRESS_API_KEY');
  return missing;
}

// ─── OpenAI API (raw HTTP) ──────────────────────────────────────
async function openaiChat(system, user) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CFG.openaiKey}`,
    },
    body: JSON.stringify({
      model: CFG.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: CFG.maxTokens,
      temperature: CFG.temperature,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI API error (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response');

  return {
    content: JSON.parse(content),
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
  };
}

// ─── WordPress API (Kivo Geo Plugin) ────────────────────────────
async function wp(method, endpoint, body = null) {
  const base = CFG.wpUrl.replace(/\/wp-json.*$/, '').replace(/\/$/, '');
  const url = `${base}/wp-json/${CFG.apiNs}${endpoint}`;

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Kivo-Key': CFG.wpApiKey,
    },
    signal: AbortSignal.timeout(60000),
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const msg = data?.message || data?.data?.message || `HTTP ${response.status}`;
    throw new Error(`WP API error (${endpoint}): ${msg}`);
  }
  return data;
}

// ─── Industry Detection ─────────────────────────────────────────
function industry(keyword) {
  const k = keyword.toLowerCase();
  if (k.includes('seo') || k.includes('market') || k.includes('social media') || k.includes('brand') || k.includes('content')) return 'marketing';
  if (k.includes('account') || k.includes('tax') || k.includes('financ') || k.includes('bookkeep')) return 'accounting';
  if (k.includes('insur')) return 'insurance';
  if (k.includes('real estate') || k.includes('property') || k.includes('mortgage') || k.includes('apartment') || k.includes('villa')) return 'realestate';
  if (k.includes('health') || k.includes('medic') || k.includes('doctor') || k.includes('clinic') || k.includes('dental')) return 'healthcare';
  if (k.includes('law') || k.includes('legal') || k.includes('attorney') || k.includes('lawyer')) return 'legal';
  if (k.includes('ecom') || k.includes('shop') || k.includes('product') || k.includes('store')) return 'ecommerce';
  if (k.includes('restaurant') || k.includes('food') || k.includes('cafe') || k.includes('cater')) return 'food';
  if (k.includes('travel') || k.includes('tour') || k.includes('hotel')) return 'travel';
  if (k.includes('tech') || k.includes('software') || k.includes('app') || k.includes('saas')) return 'tech';
  return 'general';
}

// ─── Generate Article via OpenAI ────────────────────────────────
async function generate(keyword) {
  console.log(`\n🤖 Generating article for: "${keyword}"`);
  console.log(`   Model: ${CFG.model} | Tone: ${CFG.tone} | ${CFG.minWords}-${CFG.maxWords} words`);

  const ind = industry(keyword);
  const agentId = randomUUID();

  const system = `You are a senior SEO content writer. Follow Google's E-E-A-T guidelines.

CONTENT:
- Tone: ${CFG.tone}, professional, trustworthy
- Length: ${CFG.minWords}-${CFG.maxWords} words
- Structure: Introduction, 4-6 H2 sections with H3 subsections, FAQ (3-5 Q&A), Conclusion with CTA
- Use <h2> for main sections, <h3> for subsections, <p>, <ul>/<li> for lists, <strong> for emphasis
- Output clean HTML only

SEO:
- Include "${keyword}" naturally in first 100 words
- Semantic keyword variations throughout
- metaTitle max 60 chars
- metaDescription max 160 chars
- 3-5 relevant tags

RESPOND ONLY with this JSON (no markdown, no code blocks):
{
  "title": "Compelling title",
  "metaTitle": "SEO meta title ≤60 chars",
  "metaDescription": "SEO meta description ≤160 chars",
  "tags": ["tag1", "tag2", "tag3"],
  "content": "Full article as clean HTML. FAQ section as <h2>Frequently Asked Questions</h2> then <h3>Q?</h3><p>A...</p> for each. End with conclusion + CTA.",
  "slug": "url-friendly-slug"
}`;

  const { content: result, tokensIn, tokensOut } = await openaiChat(
    system,
    `Write an SEO-optimized article about: "${keyword}" for the ${ind} industry.`
  );

  if (!result.title || !result.content) {
    throw new Error('OpenAI response missing required fields');
  }

  const slug = result.slug || result.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const wordCount = result.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;

  console.log(`   ✅ Generated: "${result.title}"`);
  console.log(`      Words: ${wordCount} | Tokens: ${tokensIn}→${tokensOut}`);

  return {
    title: result.title,
    content_html: result.content,
    slug,
    meta_title: (result.metaTitle || result.title).slice(0, 60),
    meta_description: (result.metaDescription || '').slice(0, 160),
    tags: result.tags || [keyword, ind],
    focus_keyword: keyword,
    agent_article_id: agentId,
    word_count: wordCount,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  };
}

// ─── Publish to WordPress ──────────────────────────────────────
async function publish(article, options = {}) {
  const status = options.status || 'draft';
  const autoPub = options.autoPublish ?? (status === 'publish');

  console.log(`\n📤 Publishing: "${article.title}" → ${status}`);
  if (autoPub && status === 'draft') console.log(`   (will auto-publish if quality >= 95)`);

  const result = await wp('POST', '/posts', {
    title: article.title,
    content_html: article.content_html,
    slug: article.slug,
    status,
    tags: article.tags,
    meta_title: article.meta_title,
    meta_description: article.meta_description,
    focus_keyword: article.focus_keyword,
    author_id: CFG.authorId,
    agent_article_id: article.agent_article_id,
    auto_publish: autoPub,
    ...(options.category ? { categories: [options.category] } : {}),
  });

  const postId = result.data?.post_id;
  const postUrl = result.data?.post_url;
  const quality = result.quality;

  console.log(`   ✅ Published! Post ID: ${postId}`);
  if (result.quality) {
    console.log(`   Quality: ${result.quality.score}/100 | SEO: ${result.quality.seo_score || 'N/A'}`);
  }

  return { postId, postUrl, quality, agent_article_id: article.agent_article_id };
}

// ─── Connection Test ───────────────────────────────────────────
async function testConnection() {
  console.log('\n🔌 Testing WordPress connection...\n');
  const result = await wp('GET', '/status');
  if (result.success) {
    const d = result.data;
    console.log(`   ✅ Connected!\n`);
    console.log(`   Site:      ${d.site_name}`);
    console.log(`   URL:       ${d.site_url}`);
    console.log(`   Plugin:    v${d.version}`);
    console.log(`   WordPress: ${d.wp_version}`);
    console.log(`   PHP:       ${d.php_version}`);
    console.log(`   Queue:     ${d.queue_pending} pending`);
    console.log(`   Keys:      ${d.active_keys} active`);
    return true;
  }
  console.log('   ❌ Unexpected response');
  return false;
}

// ─── List Categories ────────────────────────────────────────────
async function listCategories() {
  const result = await wp('GET', '/categories');
  if (result.success && result.data) return result.data;
  return [];
}

// ─── List Tags ─────────────────────────────────────────────────
async function listTags() {
  const result = await wp('GET', '/tags');
  if (result.success && result.data) return result.data;
  return [];
}

// ─── Random Topic Picker ────────────────────────────────────────
const TOPICS = [
  'SEO tips for small business websites',
  'How to improve website loading speed',
  'Content marketing strategies for 2026',
  'Social media marketing best practices',
  'Local SEO strategies for service businesses',
  'Email marketing tips for beginners',
  'How to build a strong brand identity',
  'Digital marketing trends to watch',
  'Website security best practices',
  'How to write compelling blog posts',
  'Customer service tips for growing businesses',
  'Mobile optimization strategies for websites',
  'Affordable marketing ideas for startups',
  'How to use data analytics for business growth',
  'Building customer trust through transparency',
  'Networking tips for small business owners',
  'How to create a successful online presence',
  'Innovative customer engagement strategies',
  'Effective time management for entrepreneurs',
  'How to leverage user-generated content',
  'Why every business needs a blog',
  'How to choose the right domain name',
  'WordPress maintenance tips for beginners',
  'How to create a content calendar',
  'Guide to Google My Business optimization',
];

function pickTopic() {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}

// ─── Setup Cron ────────────────────────────────────────────────
function setupCron() {
  const scriptPath = path.resolve(fileURLToPath(import.meta.url));
  const logFile = '/var/log/kivo-publisher.log';
  const cronLine = `0 8 * * * cd ${path.dirname(path.dirname(scriptPath))} && node ${scriptPath} --keyword "$(node ${scriptPath} --pick-topic)" >> ${logFile} 2>&1\n`;

  console.log(`\n📋 Add this to your crontab (crontab -e):\n`);
  console.log(`   ${cronLine}`);
  console.log(`   Or run this command to add it automatically:\n`);
  console.log(`   (crontab -l 2>/dev/null | grep -q 'wordpress-ai-publisher' || (crontab -l 2>/dev/null; echo "${cronLine}") | crontab -)\n`);
}

// ─── Save Backup ───────────────────────────────────────────────
function saveBackup(article, publishResult) {
  const dir = path.join(__dirname, '..', 'outputs', 'kivo');
  fs.mkdirSync(dir, { recursive: true });

  const backup = {
    ...article,
    post_id: publishResult.postId,
    post_url: publishResult.postUrl,
    quality: publishResult.quality,
    published_at: new Date().toISOString(),
  };

  const filePath = path.join(dir, `${Date.now()}-${article.slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
  return filePath;
}

// ─── Process Single Keyword ────────────────────────────────────
async function processKeyword(keyword, options) {
  const article = await generate(keyword);
  const pubResult = await publish(article, options);
  const backupPath = saveBackup(article, pubResult);
  console.log(`   Backup: ${backupPath}`);
  return { article, pubResult };
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const opts = { status: 'draft', autoPublish: false };
  let keyword = '', batchFile = '', flagPick = false, flagCat = false, flagTags = false, flagTest = false, flagCron = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--keyword': keyword = args[++i] || ''; break;
      case '--batch': batchFile = args[++i] || ''; break;
      case '--status': opts.status = args[++i] || 'draft'; break;
      case '--publish': opts.status = 'publish'; opts.autoPublish = true; break;
      case '--category': opts.category = args[++i] || ''; break;
      case '--pick-topic': flagPick = true; break;
      case '--list-categories': flagCat = true; break;
      case '--list-tags': flagTags = true; break;
      case '--test': flagTest = true; break;
      case '--setup-cron': flagCron = true; break;
      case '--help': case '-h': return help();
    }
  }

  // Validate config
  const missing = validate();
  if (missing.length > 0) {
    console.error('\n❌ Missing environment variables:');
    missing.forEach(v => console.error(`   • ${v}`));
    console.error('\n   Make sure .env exists with these values. Copy .env.example to get started.\n');
    process.exit(1);
  }

  if (flagPick) { console.log(pickTopic()); return; }
  if (flagCron) { setupCron(); return; }

  if (flagTest) {
    const ok = await testConnection();
    process.exit(ok ? 0 : 1);
  }

  if (flagCat) {
    console.log('\n📂 WordPress Categories:\n');
    const cats = await listCategories();
    if (!cats.length) console.log('   (none found)');
    else cats.forEach(c => console.log(`   [${c.id}] ${c.name} (${c.count} posts)`));
    return;
  }

  if (flagTags) {
    console.log('\n🏷️  WordPress Tags:\n');
    const tags = await listTags();
    if (!tags.length) console.log('   (none found)');
    else tags.forEach(t => console.log(`   [${t.id}] ${t.name} (${t.count} posts)`));
    return;
  }

  // Batch mode
  if (batchFile) {
    const fp = path.resolve(batchFile);
    if (!fs.existsSync(fp)) { console.error(`\n❌ File not found: ${batchFile}`); process.exit(1); }

    const keywords = fs.readFileSync(fp, 'utf-8')
      .split('\n').map(k => k.trim()).filter(k => k && !k.startsWith('#'));

    if (!keywords.length) { console.error('\n❌ No keywords in batch file'); process.exit(1); }

    console.log(`\n📋 Processing ${keywords.length} keywords...`);
    let ok = 0, fail = 0;
    for (let i = 0; i < keywords.length; i++) {
      console.log(`\n${'═'.repeat(56)}\n📌 [${i + 1}/${keywords.length}] ${keywords[i]}\n${'═'.repeat(56)}`);
      try {
        await processKeyword(keywords[i], opts);
        ok++;
      } catch (e) {
        console.error(`   ❌ ${e.message}`);
        fail++;
      }
    }
    console.log(`\n${'═'.repeat(56)}\n📊 Complete: ${ok} ok, ${fail} failed`);
    return;
  }

  // Single keyword
  if (keyword) {
    try {
      const { article, pubResult } = await processKeyword(keyword, opts);
      console.log(`\n✅ Done!`);
      if (pubResult.postUrl) console.log(`   ${pubResult.postUrl}`);
      return;
    } catch (e) {
      console.error(`\n❌ ${e.message}`);
      process.exit(1);
    }
  }

  help();
}

function help() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Kivo Geo - WordPress Article Publisher                       ║
║  Generate SEO articles with AI and publish to WordPress       ║
╚═══════════════════════════════════════════════════════════════╝

USAGE:
  node scripts/wordpress-ai-publisher.mjs [options]

OPTIONS:
  --keyword <text>       Generate and publish one article
  --batch <file>         Process keywords from a file (one per line)
  --status <draft|publish>  Post status (default: draft)
  --publish              Generate and auto-publish immediately
  --category <name>      Assign a WordPress category
  --pick-topic           Print a random topic suggestion
  --list-categories      List WordPress categories
  --list-tags            List WordPress tags
  --test                 Test WordPress connection
  --setup-cron           Print crontab instructions
  --help, -h             Show this help

EXAMPLES:
  # Publish one article as draft
  node scripts/wordpress-ai-publisher.mjs --keyword "SEO tips for small business"

  # Auto-publish (skips draft, publishes directly)
  node scripts/wordpress-ai-publisher.mjs --publish --keyword "digital marketing trends"

  # Test connection
  node scripts/wordpress-ai-publisher.mjs --test

  # Automated daily publish (add to crontab -e):
  node scripts/wordpress-ai-publisher.mjs --setup-cron
`);
}

main().catch(e => { console.error(`\n💥 ${e.message}`); process.exit(1); });
