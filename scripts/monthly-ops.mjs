// ══════════════════════════════════════════════════════════════════
// TDS Geo — Monthly Operations System
// Automated content generation, publishing, improvement, maintenance
// ══════════════════════════════════════════════════════════════════

import pg from 'pg';
import { createHash, randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import jwt from 'jsonwebtoken';

const { Pool } = pg;

// ─── Config ─────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || '';

// Generate an internal auth token for API calls
function generateToken() {
  return jwt.sign(
    { sub: '00000000-0000-0000-0000-000000000000', role: 'admin', system: true },
    JWT_SECRET,
    { expiresIn: '1h', jwtid: randomUUID() }
  );
}

// Days of the month (1-indexed)
const DAY = new Date().getDate();
const DAY_OF_WEEK = new Date().getDay(); // 0=Sun, 1=Mon...
const HOUR = new Date().getHours();
const TODAY = new Date().toISOString().split('T')[0];

// ─── Content Plans ──────────────────────────────────────────────

const CONTENT_PLAN = {
  'boston-pharma': {
    clientName: 'Boston Pharmaceutical Industries',
    siteType: 'wordpress',
    approvalMode: 'auto',
    publishDirect: true,
    weeklyTopics: {
      1: [ // Week 1: Regulatory & Compliance
        { day: 1, topic: 'Understanding GMP Certification: What Egyptian Pharmaceutical Manufacturers Need to Know', pillar: 'regulatory' },
        { day: 2, topic: 'The Role of the Egyptian Drug Authority in Ensuring Medicine Quality', pillar: 'regulatory' },
        { day: 3, topic: 'How Regulatory Compliance Drives Pharmaceutical Export Success in MENA', pillar: 'regulatory' },
        { day: 4, topic: 'Quality Control Testing Protocols in Modern Pharmaceutical Manufacturing', pillar: 'regulatory' },
        { day: 5, topic: 'Pharmaceutical Serialization and Traceability: EDA Requirements for 2026', pillar: 'regulatory' },
        { day: 6, topic: 'The Difference Between GMP, ISO, and WHO Certification for Pharma', pillar: 'regulatory' },
      ],
      2: [ // Week 2: Product Education
        { day: 8, topic: 'Iron Deficiency Anemia: Causes, Symptoms, and the Role of Supplementation', pillar: 'product' },
        { day: 9, topic: 'Vitamin D in the Egyptian Population: Why Supplementation Matters', pillar: 'product' },
        { day: 10, topic: 'Probiotics and Gut Health: What the Science Actually Shows', pillar: 'product' },
        { day: 11, topic: 'Omega-3 Fatty Acids: Cardiovascular Benefits and Optimal Dosage', pillar: 'product' },
        { day: 12, topic: 'Multivitamins: Who Actually Needs Them and Why', pillar: 'product' },
        { day: 13, topic: 'Zinc and Immune Function: Evidence-Based Guidance for Patients', pillar: 'product' },
      ],
      3: [ // Week 3: Industry Insights
        { day: 15, topic: 'The Egyptian Pharmaceutical Market in 2026: Trends and Growth Opportunities', pillar: 'industry' },
        { day: 16, topic: 'AI in Drug Discovery: How Machine Learning Is Transforming Egyptian Pharma', pillar: 'industry' },
        { day: 17, topic: 'Pharmaceutical Supply Chain Resilience: Lessons for MENA Manufacturers', pillar: 'industry' },
        { day: 18, topic: 'Sustainable Pharmaceutical Manufacturing: Reducing Environmental Impact', pillar: 'industry' },
        { day: 19, topic: 'The Future of Generic Drugs in Egypt: Access and Affordability', pillar: 'industry' },
        { day: 20, topic: 'Digital Transformation in Pharma Manufacturing: From Paper to AI', pillar: 'industry' },
      ],
      4: [ // Week 4: Wellness & Prevention
        { day: 22, topic: 'Building a Strong Immune System: Nutrition and Lifestyle Strategies', pillar: 'wellness' },
        { day: 23, topic: 'Heart Health at Every Age: Prevention Strategies for Egyptian Adults', pillar: 'wellness' },
        { day: 24, topic: 'Bone Health and Calcium Absorption: What You Need to Know', pillar: 'wellness' },
        { day: 25, topic: 'Women\s Health: Essential Nutrients Through Every Life Stage', pillar: 'wellness' },
        { day: 26, topic: 'Managing Blood Sugar Naturally: Diet and Supplement Support', pillar: 'wellness' },
        { day: 27, topic: 'The Science of Hydration: Electrolytes and Optimal Performance', pillar: 'wellness' },
      ],
    },
  },
  'traffic-test': {
    clientName: 'Traffic Test',
    siteType: 'shopify',
    approvalMode: 'auto',
    publishDirect: true,
    weeklyTopics: {
      1: [ // Week 1: SEO & Content Strategy
        { day: 1, topic: 'Shopify SEO for 2026: What Actually Works for Product Pages', pillar: 'seo' },
        { day: 3, topic: 'Content Marketing for E-Commerce: Building Traffic That Converts', pillar: 'marketing' },
        { day: 5, topic: 'Product Description Writing: Convert Browsers into Buyers', pillar: 'conversion' },
      ],
      2: [ // Week 2: E-Commerce Operations
        { day: 8, topic: 'Inventory Management for Growing Shopify Stores', pillar: 'operations' },
        { day: 10, topic: 'Customer Retention Strategies for E-Commerce Brands', pillar: 'marketing' },
        { day: 12, topic: 'Email Marketing Automation for Shopify: A Complete Guide', pillar: 'marketing' },
      ],
      3: [ // Week 3: Advanced Growth
        { day: 15, topic: 'Upselling and Cross-Selling Strategies That Increase AOV', pillar: 'conversion' },
        { day: 17, topic: 'Social Media Advertising for E-Commerce: ROI-Focused Approach', pillar: 'marketing' },
        { day: 19, topic: 'Mobile Optimization for Shopify: Capturing the Smartphone Shopper', pillar: 'seo' },
      ],
      4: [ // Week 4: Analytics & Optimization
        { day: 22, topic: 'Google Analytics 4 for Shopify: Tracking What Matters', pillar: 'analytics' },
        { day: 24, topic: 'A/B Testing Product Pages: Data-Driven Decisions for More Sales', pillar: 'conversion' },
        { day: 26, topic: 'Building a Brand Community Around Your Shopify Store', pillar: 'marketing' },
      ],
    },
  },
  'boston-vet': {
    clientName: 'Boston Veterinary Pharmaceutical',
    siteType: 'wordpress',
    approvalMode: 'auto',
    publishDirect: true,
    weeklyTopics: {
      1: [ // Week 1: Poultry Health Management
        { day: 1, topic: 'Managing Infectious Bursal Disease in Egyptian Broiler Flocks: Prevention and Control', pillar: 'poultry' },
        { day: 2, topic: 'Feed Conversion Optimization: Nutritional Strategies for Poultry Farmers', pillar: 'poultry' },
        { day: 3, topic: 'Heat Stress Management in Poultry: Protocols for Egyptian Summer Conditions', pillar: 'poultry' },
        { day: 4, topic: 'Vaccination Schedules for Commercial Poultry: A Practical Guide', pillar: 'poultry' },
        { day: 5, topic: 'Coccidiosis Prevention in Broilers: Modern Approaches and Products', pillar: 'poultry' },
        { day: 6, topic: 'Litter Management and Gut Health in Poultry Production', pillar: 'poultry' },
      ],
      2: [ // Week 2: Livestock & Ruminant Nutrition
        { day: 8, topic: 'Ruminant Feed Formulation: Balancing Energy and Protein for Dairy Cows', pillar: 'livestock' },
        { day: 9, topic: 'Trace Mineral Supplementation in Cattle: Improving Fertility and Immunity', pillar: 'livestock' },
        { day: 10, topic: 'Managing Bloat in Feedlot Cattle: Causes, Prevention, and Treatment', pillar: 'livestock' },
        { day: 11, topic: 'Sheep and Goat Nutrition: Meeting Production Goals with Quality Feed', pillar: 'livestock' },
        { day: 12, topic: 'The Role of Liver Tonics in Ruminant Health and Productivity', pillar: 'livestock' },
        { day: 13, topic: 'Calving Management and Postpartum Nutrition for Dairy Herds', pillar: 'livestock' },
      ],
      3: [ // Week 3: Companion Animal Care
        { day: 15, topic: 'Canine Dental Health: Preventing Periodontal Disease in Dogs', pillar: 'companion' },
        { day: 16, topic: 'Feline Nutrition: Essential Nutrients for Every Life Stage', pillar: 'companion' },
        { day: 17, topic: 'Vaccination Protocols for Dogs and Cats in Egypt', pillar: 'companion' },
        { day: 18, topic: 'Managing Parasites in Companion Animals: A Year-Round Strategy', pillar: 'companion' },
        { day: 19, topic: 'Joint Health in Aging Dogs: Supplements and Lifestyle Interventions', pillar: 'companion' },
        { day: 20, topic: 'Pet Obesity: Risks, Prevention, and Weight Management Programs', pillar: 'companion' },
      ],
      4: [ // Week 4: Equine Health & Industry Insights
        { day: 22, topic: 'Equine Osteoarthritis: Diagnosis, Treatment, and Management Options', pillar: 'equine' },
        { day: 23, topic: 'Equine Nutrition: Feeding for Performance and Health', pillar: 'equine' },
        { day: 24, topic: 'The Egyptian Veterinary Pharmaceuticals Market: Growth and Opportunities', pillar: 'industry' },
        { day: 25, topic: 'Antibiotic Stewardship in Veterinary Medicine: Egyptian Regulatory Landscape', pillar: 'industry' },
        { day: 26, topic: 'Advances in Poultry Vaccine Technology: What Egyptian Producers Need to Know', pillar: 'industry' },
        { day: 27, topic: 'Digital Tools for Farm Management: Tracking Health and Productivity', pillar: 'industry' },
      ],
    },
  },
};

// ─── Helpers ────────────────────────────────────────────────────

function log(level, msg, data = {}) {
  const ts = new Date().toISOString();
  console.log(JSON.stringify({ ts, level, msg, ...data }));
}

async function getClient(slug) {
  const r = await pool.query('SELECT id, name, shopify_shop, approval_mode FROM clients');
  for (const c of r.rows) {
    if (c.name.toLowerCase().includes(slug.replace('-', ' '))) return c;
    if (c.shopify_shop && c.shopify_shop.includes(slug)) return c;
  }
  // Fallback: try to match by shopify_shop or name containing the slug
  const exact = await pool.query('SELECT id, name, shopify_shop, approval_mode FROM clients WHERE LOWER(name) LIKE $1 OR LOWER(shopify_shop) LIKE $1', [`%${slug.replace('-', '')}%`]);
  return exact.rows[0] || null;
}

function getWeekNumber(day) {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function getDueTopics(dayOfMonth) {
  const topics = [];
  for (const [slug, plan] of Object.entries(CONTENT_PLAN)) {
    const week = getWeekNumber(dayOfMonth);
    const weekTopics = plan.weeklyTopics[week] || [];
    for (const t of weekTopics) {
      if (t.day === dayOfMonth) {
        topics.push({ slug, ...plan, topic: t.topic, pillar: t.pillar });
      }
    }
  }
  return topics;
}

// ─── Core Functions ─────────────────────────────────────────────

async function generateArticle(clientId, topic, options = {}) {
  log('info', 'Generating article', { clientId, topic: topic.substring(0, 60) });
  const token = generateToken();
  try {
    const res = await fetch(`${BASE_URL}/api/articles/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        keyword: topic,
        clientId,
        publish: options.publishDirect || false,
        tone: options.tone || '',
        minWords: 1200,
        maxWords: 2500,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    log('info', 'Article generated', { id: body.article?.id, title: body.article?.title?.substring(0, 60) });
    return body;
  } catch (err) {
    log('error', 'Failed to generate article', { error: err.message, topic: topic.substring(0, 60) });
    return null;
  }
}

async function publishArticle(articleId, clientId) {
  log('info', 'Publishing article', { articleId });
  const token = generateToken();
  try {
    const res = await fetch(`${BASE_URL}/api/articles/${articleId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    log('info', 'Article published', { articleId, url: body.url });
    return body;
  } catch (err) {
    log('error', 'Failed to publish', { error: err.message, articleId });
    return null;
  }
}

async function queueArticleForPublishing(articleId, clientId, scheduledAt) {
  log('info', 'Queuing article for scheduled publishing', { articleId, scheduledAt });
  try {
    await pool.query(
      `INSERT INTO publishing_queue (article_id, client_id, scheduled_at, status, priority)
       VALUES ($1, $2, $3, 'queued', 5)
       ON CONFLICT DO NOTHING`,
      [articleId, clientId, scheduledAt]
    );
    return true;
  } catch (err) {
    log('error', 'Failed to queue article', { error: err.message, articleId });
    return false;
  }
}

async function getExistingArticles(clientId, limit = 5) {
  const r = await pool.query(
    `SELECT id, title, status, created_at, seo_score, quality_score
     FROM articles WHERE client_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [clientId, limit]
  );
  return r.rows;
}

async function getOldUnpublishedDrafts(clientId, daysOld = 7) {
  const r = await pool.query(
    `SELECT id, title, status, created_at
     FROM articles
     WHERE client_id = $1 AND status = 'draft'
       AND created_at < NOW() - INTERVAL '${daysOld} days'
     ORDER BY created_at DESC`,
    [clientId]
  );
  return r.rows;
}

async function improveOldArticles(clientId) {
  log('info', 'Checking for old articles to improve', { clientId });

  // Find articles with low quality scores that need improvement
  const lowQuality = await pool.query(
    `SELECT id, title, quality_score, seo_score
     FROM articles
     WHERE client_id = $1 AND status = 'published'
       AND (quality_score < 7 OR quality_score IS NULL)
       AND created_at > NOW() - INTERVAL '90 days'
     ORDER BY quality_score ASC NULLS LAST
     LIMIT 3`,
    [clientId]
  );

  for (const article of lowQuality.rows) {
    log('info', 'Regenerating low-quality article', { id: article.id, title: article.title?.substring(0, 50), score: article.quality_score });
    const token = generateToken();
    try {
      const res = await fetch(`${BASE_URL}/api/articles/${article.id}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) log('info', 'Article regenerated', { id: article.id });
    } catch (err) {
      log('warn', 'Failed to regenerate article', { error: err.message, id: article.id });
    }
  }

  return lowQuality.rows.length;
}

// ─── Maintenance Functions ──────────────────────────────────────

async function checkSiteHealth() {
  log('info', 'Running site health checks');

  const checks = [
    { name: 'Backend API', url: `${BASE_URL}/health` },
    { name: 'Boston Pharma', url: 'https://boston-pharma.com/wp-json/tds-geo/v1/status', type: 'wordpress' },
  ];

  let allOk = true;
  for (const check of checks) {
    try {
      const res = await fetch(check.url, { signal: AbortSignal.timeout(10000) });
      const ok = res.ok || res.status === 200;
      log(ok ? 'info' : 'warn', `Health check: ${check.name}`, { status: res.status, ok });
      if (!ok) allOk = false;
    } catch (err) {
      log('warn', `Health check failed: ${check.name}`, { error: err.message });
      allOk = false;
    }
  }

  return allOk;
}

async function checkDiskAndMemory() {
  log('info', 'Checking system resources');
  try {
    const { execSync } = await import('child_process');
    const disk = execSync('df -h / | tail -1').toString().trim();
    const mem = execSync('free -h | grep Mem').toString().trim();
    log('info', 'System resources', { disk: disk.replace(/\s+/g, ' '), memory: mem.replace(/\s+/g, ' ') });
  } catch (err) {
    log('warn', 'Failed to check system resources', { error: err.message });
  }
}

async function verifyPluginHealth() {
  log('info', 'Checking TDS Geo plugin health on WordPress sites');
  const apiKey = process.env.BOSTON_PHARMA_API_KEY || 'kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1';
  try {
    const res = await fetch('https://boston-pharma.com/wp-json/tds-geo/v1/status', {
      headers: { 'X-TDS-Geo-Key': apiKey },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data?.success) {
      log('info', 'Boston Pharma plugin healthy', { version: data.data?.version, api: data.data?.api_enabled });
    } else {
      log('warn', 'Boston Pharma plugin issue', { data });
    }
  } catch (err) {
    log('warn', 'Boston Pharma plugin unreachable', { error: err.message });
  }
}

async function processPublishingQueue() {
  log('info', 'Processing publishing queue');

  const dueItems = await pool.query(
    `SELECT pq.id, pq.article_id, pq.client_id, a.title, a.status as article_status, c.shopify_shop, c.name as client_name
     FROM publishing_queue pq
     JOIN articles a ON a.id = pq.article_id
     JOIN clients c ON c.id = pq.client_id
     WHERE pq.status = 'queued'
       AND pq.scheduled_at <= NOW()
       AND (pq.locked_until IS NULL OR pq.locked_until < NOW())
       AND a.status = 'approved'
     ORDER BY pq.priority DESC, pq.scheduled_at ASC
     LIMIT 5`
  );

  for (const item of dueItems.rows) {
    log('info', 'Publishing queued article', { id: item.article_id, title: item.title?.substring(0, 50) });

    // Lock the queue item
    await pool.query(
      `UPDATE publishing_queue SET status = 'processing', locked_until = NOW() + INTERVAL '5 minutes' WHERE id = $1`,
      [item.id]
    );

    const result = await publishArticle(item.article_id, item.client_id);

    if (result) {
      await pool.query(
        `UPDATE publishing_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [item.id]
      );
    } else {
      await pool.query(
        `UPDATE publishing_queue SET status = 'failed', last_error = 'Publish failed', attempt_count = attempt_count + 1 WHERE id = $1`,
        [item.id]
      );
    }
  }

  return dueItems.rows.length;
}

async function cleanupOldLogs() {
  log('info', 'Cleaning up old workflow logs');
  const r = await pool.query(
    `DELETE FROM workflow_logs WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  if (r.rowCount > 0) log('info', 'Cleaned old logs', { deleted: r.rowCount });
}

async function recordDailyMetrics() {
  log('info', 'Recording daily metrics snapshot');

  const articleCount = await pool.query('SELECT client_id, status, count(*) FROM articles GROUP BY client_id, status');
  const queueCount = await pool.query("SELECT status, count(*) FROM publishing_queue GROUP BY status");
  const scheduleCount = await pool.query("SELECT is_active, count(*) FROM schedules GROUP BY is_active");

  // Insert into metrics_snapshots
  await pool.query(
    `INSERT INTO metrics_snapshots (snapshot_date, metrics)
     VALUES ($1, $2::jsonb)`,
    [TODAY, JSON.stringify({
      articles: articleCount.rows,
      publishing_queue: queueCount.rows,
      schedules: scheduleCount.rows,
      timestamp: TODAY,
    })]
  );

  log('info', 'Daily metrics recorded');
}

// ─── Daily Operations ───────────────────────────────────────────

async function runDailyOps() {
  log('info', '═══ Starting Daily Operations ═══', { day: DAY, dow: DAY_OF_WEEK, hour: HOUR });

  // Step 1: Process publishing queue (publish any due items)
  log('info', '── Step 1: Process publishing queue ──');
  await processPublishingQueue();

  // Step 2: Check site health (once daily)
  if (HOUR === 6) {
    log('info', '── Step 2: Site health checks ──');
    await checkSiteHealth();
    await checkDiskAndMemory();
    await verifyPluginHealth();
  }

  // Step 3: Generate today's content
  log('info', '── Step 3: Generate today content ──');
  const dueTopics = getDueTopics(DAY);

  if (dueTopics.length === 0) {
    log('info', 'No content scheduled for today', { day: DAY });
  }

  for (const topic of dueTopics) {
    const client = await getClient(topic.slug);
    if (!client) {
      log('warn', 'Client not found for topic', { slug: topic.slug, topic: topic.topic.substring(0, 50) });
      continue;
    }

    const result = await generateArticle(client.id, topic.topic, {
      tone: topic.pillar === 'regulatory' ? 'formal'
        : topic.pillar === 'wellness' ? 'warm'
        : topic.pillar === 'poultry' ? 'practical'
        : topic.pillar === 'livestock' ? 'technical'
        : topic.pillar === 'companion' ? 'compassionate'
        : topic.pillar === 'equine' ? 'professional'
        : topic.pillar === 'seo' ? 'strategic'
        : 'educational',
      publishDirect: false, // Queue for scheduled publish instead
    });

    if (result?.article?.id) {
      // Schedule publishing for next day at 9 AM Cairo time (UTC+2)
      const pubDate = new Date();
      pubDate.setDate(pubDate.getDate() + 1);
      pubDate.setUTCHours(7, 0, 0, 0); // 9 AM Cairo = 7 AM UTC
      // If weekend, push to Monday
      const dow = pubDate.getUTCDay();
      if (dow === 0) pubDate.setDate(pubDate.getDate() + 1); // Sunday → Monday
      if (dow === 6) pubDate.setDate(pubDate.getDate() + 2); // Saturday → Monday

      await queueArticleForPublishing(result.article.id, client.id, pubDate.toISOString());
    }
  }

  // Step 4: Improve existing content (once per week, Sunday)
  if (DAY_OF_WEEK === 0 && HOUR === 5) {
    log('info', '── Step 4: Content improvement loop ──');
    const clients = await pool.query('SELECT id, name FROM clients');
    for (const client of clients.rows) {
      const improved = await improveOldArticles(client.id);
      log('info', 'Content improvement done', { client: client.name, improved });
    }
  }

  // Step 5: Cleanup (once per day)
  if (HOUR === 4) {
    log('info', '── Step 5: Housekeeping ──');
    await cleanupOldLogs();
    await recordDailyMetrics();
  }

  // Step 6: Publish drafts that have been sitting too long (once per week, Monday)
  if (DAY_OF_WEEK === 1 && HOUR === 6) {
    log('info', '── Step 6: Clear stale drafts ──');
    const clients = await pool.query('SELECT id, name FROM clients');
    for (const client of clients.rows) {
      const staleDrafts = await getOldUnpublishedDrafts(client.id, 14);
      for (const draft of staleDrafts) {
        log('info', 'Clearing stale draft', { id: draft.id, title: draft.title?.substring(0, 50) });
        // Approve and queue it
        await pool.query(
          `UPDATE articles SET status = 'approved', editorial_status = 'approved', updated_at = NOW() WHERE id = $1`,
          [draft.id]
        );
        const pubDate = new Date();
        pubDate.setDate(pubDate.getDate() + 1);
        pubDate.setUTCHours(9, 0, 0, 0);
        await queueArticleForPublishing(draft.id, client.id, pubDate.toISOString());
      }
    }
  }

  log('info', '═══ Daily Operations Complete ═══');
  return { success: true, day: DAY, topicsGenerated: dueTopics.length };
}

// ─── Monthly Reports ────────────────────────────────────────────

async function generateMonthlyReport() {
  log('info', '═══ Generating Monthly Report ═══');

  const clients = await pool.query('SELECT id, name FROM clients');

  for (const client of clients.rows) {
    const articleStats = await pool.query(
      `SELECT status, count(*) as count,
              ROUND(AVG(quality_score)::numeric, 1) as avg_quality,
              ROUND(AVG(seo_score)::numeric, 1) as avg_seo
       FROM articles WHERE client_id = $1
         AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY status`,
      [client.id]
    );

    const publishCount = await pool.query(
      `SELECT count(*) FROM publishing_history ph
       JOIN articles a ON a.id = ph.article_id
       WHERE a.client_id = $1 AND ph.created_at > NOW() - INTERVAL '30 days'`,
      [client.id]
    );

    log('report', `Monthly stats: ${client.name}`, {
      articles: articleStats.rows,
      published: parseInt(publishCount.rows[0]?.count || '0'),
      period: 'last 30 days',
    });

    // Log a system alert
    const totalPublished = parseInt(publishCount.rows[0]?.count || '0');
    if (totalPublished > 0) {
      await pool.query(
        `INSERT INTO system_alerts (alert_type, severity, title, message, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          'monthly_report',
          'info',
          `Monthly Report: ${client.name}`,
          `${totalPublished} articles published in last 30 days`,
          JSON.stringify({ client: client.name, published: totalPublished, stats: articleStats.rows }),
        ]
      );
    }
  }

  log('info', 'Monthly report generated');
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2] || 'daily';

  try {
    switch (command) {
      case 'daily':
        await runDailyOps();
        break;
      case 'report':
        await generateMonthlyReport();
        break;
      case 'publish-queue':
        await processPublishingQueue();
        break;
      case 'health':
        await checkSiteHealth();
        await verifyPluginHealth();
        break;
      case 'improve':
        const clients = await pool.query('SELECT id, name FROM clients');
        for (const client of clients.rows) {
          await improveOldArticles(client.id);
        }
        break;
      case 'init-schedules':
        await initializeSchedules();
        break;
      default:
        console.log('Usage: node monthly-ops.mjs [daily|report|publish-queue|health|improve|init-schedules]');
    }
  } catch (err) {
    log('error', 'Monthly ops failed', { error: err.message, stack: err.stack?.split('\n')[1] });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// ─── Initialize DB Schedules ────────────────────────────────────

async function initializeSchedules() {
  log('info', 'Initializing schedules in database');

  const clients = await pool.query('SELECT id, name FROM clients');

  for (const client of clients.rows) {
    // Check if schedule already exists
    const existing = await pool.query(
      'SELECT id FROM schedules WHERE client_id = $1 AND is_active = true',
      [client.id]
    );
    if (existing.rows.length > 0) {
      log('info', 'Schedule already exists for client', { name: client.name });
      continue;
    }

    // Create a schedule for daily content generation
    await pool.query(
      `INSERT INTO schedules (client_id, name, frequency, cron_expression, config, is_active)
       VALUES ($1, $2, 'cron', $3, $4::jsonb, true)`,
      [
        client.id,
        `${client.name} — Daily Content Generation`,
        '0 8 * * *', // Daily at 8 AM UTC (10 AM Cairo)
        JSON.stringify({
          type: 'content_generation',
          minWords: 1200,
          maxWords: 2500,
          autoPublish: true,
          priority: 'normal',
        }),
      ]
    );

    // Create a weekly improvement schedule
    await pool.query(
      `INSERT INTO schedules (client_id, name, frequency, cron_expression, config, is_active)
       VALUES ($1, $2, 'cron', $3, $4::jsonb, true)`,
      [
        client.id,
        `${client.name} — Weekly Content Improvement`,
        '0 5 * * 0', // Sunday at 5 AM UTC
        JSON.stringify({
          type: 'content_improvement',
          maxArticles: 5,
          minQualityScore: 7,
        }),
      ]
    );

    log('info', 'Schedules created for client', { name: client.name });
  }

  log('info', 'Schedule initialization complete');
}

main();
