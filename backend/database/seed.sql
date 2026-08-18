-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- © 2026 Yusuf Mohamed. All rights reserved.
-- Licensed under the ISC License.

-- ══════════════════════════════════════════════
-- AI SEO Automation - Development Seed Data
-- ══════════════════════════════════════════════
-- Run: psql -d ai_seo_automation -f backend/database/seed.sql

-- ─── Admin User ──────────────────────────────
-- Password: <redacted — see local credential store> (bcrypt hash)
INSERT INTO users (email, password_hash, name, role, is_active)
VALUES (
  'admin@tds-geo.internal',
  '$2a$12$ALds38BW1pmUbF80uArXB.u12.UsDx/LyWTD3bz6O58EvD7Jx5rym',
  'Admin User',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;

-- ─── Sample Client ───────────────────────────
INSERT INTO clients (name, slug, shopify_shop, shopify_token, brand_voice, service_area, timezone, approval_mode, is_active)
VALUES (
  'Acme Maintenance Co.',
  'acme-maintenance',
  'acme-maintenance.myshopify.com',
  'shpat_sample_token_abc123',
  'Professional and educational — we are trusted experts in home maintenance',
  'California, USA',
  'America/Los_Angeles',
  'manual',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ─── Editor User ─────────────────────────────
INSERT INTO users (email, password_hash, name, role, client_id, is_active)
SELECT
  'editor@tds-geo.internal',
  '$2a$12$DIxJ7Z7wbEQ2d/aw6or1geHWNDlzPA/vZ0nXiWJNX5r9fAXX/AquS',
  'Editor User',
  'editor',
  id,
  true
FROM clients WHERE slug = 'acme-maintenance'
ON CONFLICT (email) DO NOTHING;

-- ─── Sample Keywords ─────────────────────────
INSERT INTO keywords (client_id, keyword, search_volume, competition, relevance_score, source, is_active)
SELECT
  c.id,
  kw.keyword,
  kw.search_volume,
  kw.competition,
  kw.relevance_score,
  kw.source,
  true
FROM clients c
CROSS JOIN (VALUES
  ('gutter cleaning tips', 1200, 0.45, 85, 'research'),
  ('roof maintenance guide', 800, 0.35, 78, 'research'),
  ('plumbing emergency checklist', 1500, 0.55, 92, 'manual'),
  ('hvac seasonal maintenance', 950, 0.40, 80, 'research'),
  ('foundation repair signs', 600, 0.30, 75, 'research'),
  ('pressure washing services', 2000, 0.50, 70, 'manual'),
  ('drain cleaning solutions', 1100, 0.42, 82, 'research'),
  ('electrical safety tips', 1300, 0.38, 88, 'research'),
  ('water heater replacement cost', 2500, 0.60, 95, 'research'),
  ('home inspection checklist', 1800, 0.35, 76, 'manual')
) AS kw(keyword, search_volume, competition, relevance_score, source)
WHERE c.slug = 'acme-maintenance'
ON CONFLICT (client_id, keyword) DO NOTHING;

-- ─── Sample Generated Articles ───────────────
INSERT INTO articles (client_id, keyword_id, title, slug, content_md, content_html, meta_title, meta_description, tags, word_count, status, seo_score)
SELECT
  c.id,
  kw.id,
  'The Ultimate Guide to ' || kw.keyword,
  LOWER(REGEXP_REPLACE('ultimate-guide-' || kw.keyword, '[^a-z0-9]+', '-', 'g')),
  '# ' || INITCAP(kw.keyword) || E'\n\n'
    || 'Welcome to our comprehensive guide on ' || kw.keyword || E'. '
    || 'With years of experience in the industry, our team of licensed professionals '
    || 'has compiled the most important information to help you make informed decisions '
    || 'about your home maintenance needs.' || E'\n\n'
    || '## Common Warning Signs' || E'\n\n'
    || 'Here are the key signs that indicate you may need professional assistance:' || E'\n\n'
    || '- **Unexpected changes** — pay attention to unusual patterns' || E'\n'
    || '- **Visible damage** — early detection saves money' || E'\n'
    || '- **Unusual sounds** — don''t ignore warning noises' || E'\n'
    || '- **Age of system** — older systems need more attention' || E'\n\n'
    || '## Why Professional Service Matters' || E'\n\n'
    || 'Attempting DIY repairs can often lead to more costly problems. Our certified '
    || 'technicians have the training and equipment to diagnose and resolve issues '
    || 'correctly the first time.' || E'\n\n'
    || '## Preventative Maintenance Tips' || E'\n\n'
    || '1. **Schedule regular inspections** — catch problems before they escalate' || E'\n'
    || '2. **Keep a maintenance log** — track service history' || E'\n'
    || '3. **Address issues promptly** — don''t wait until it''s an emergency' || E'\n'
    || '4. **Follow manufacturer guidelines** — protect your warranty' || E'\n\n'
    || '## When to Call a Professional' || E'\n\n'
    || 'Some situations require immediate expert attention. Contact our team if you '
    || 'notice any of the warning signs mentioned above.' || E'\n\n'
    || '### Emergency Situations' || E'\n\n'
    || '| Issue | Action Required |' || E'\n'
    || '|-------|-----------------' || E'\n'
    || '| Gas leak | Evacuate and call 911 immediately |' || E'\n'
    || '| Major water leak | Shut off main valve and call plumber |' || E'\n'
    || '| Electrical fire | Call 911 and cut power |' || E'\n'
    || '| Structural damage | Evacuate and call inspector |' || E'\n\n'
    || '## Frequently Asked Questions' || E'\n\n'
    || '### How often should I schedule maintenance?' || E'\n'
    || 'Annual maintenance is recommended for most home systems. Some systems may '
    || 'require more frequent attention depending on usage and age.' || E'\n\n'
    || '### What are the signs of a problem?' || E'\n'
    || 'Look for unexpected increases in utility bills, strange noises, visible damage, '
    || 'and unusual odors. Early detection is key to preventing major repairs.' || E'\n\n'
    || '### How much does professional service cost?' || E'\n'
    || 'Costs vary depending on the service required. Contact our team for a free, '
    || 'no-obligation estimate.' || E'\n\n'
    || '---' || E'\n\n'
    || 'Contact us today to schedule your appointment. Our experts are available '
    || '24/7 for emergency services.' || E'\n'
    || '[Call Now](tel:+15551234567) | [Book Online](/contact)',
  '<p>Welcome to our comprehensive guide...</p>',
  'Professional Guide to ' || INITCAP(kw.keyword),
  'Learn everything you need to know about ' || kw.keyword || ' from our expert team.',
  ARRAY[kw.keyword, 'maintenance', 'home care'],
  850,
  CASE
    WHEN RANDOM() < 0.3 THEN 'published'
    WHEN RANDOM() < 0.6 THEN 'generated'
    WHEN RANDOM() < 0.8 THEN 'approved'
    ELSE 'draft'
  END,
  ROUND((50 + RANDOM() * 45)::numeric, 1)
FROM clients c
JOIN keywords kw ON kw.client_id = c.id
WHERE c.slug = 'acme-maintenance'
  AND NOT EXISTS (
    SELECT 1 FROM articles a WHERE a.client_id = c.id AND a.keyword_id = kw.id
  );

-- ─── Sample Activity Logs ────────────────────
INSERT INTO activity_logs (client_id, action, entity_type, level, message)
SELECT
  c.id,
  action,
  entity_type,
  level,
  message
FROM clients c
CROSS JOIN (VALUES
  ('pipeline_started', 'system', 'info', 'Daily content pipeline started'),
  ('keyword_discovery', 'system', 'info', 'Discovered 12 new keywords'),
  ('article_generated', 'article', 'info', 'Generated article: Gutter Maintenance Tips'),
  ('article_approved', 'article', 'info', 'Article approved by editor'),
  ('article_published', 'article', 'info', 'Article published to Shopify'),
  ('pipeline_completed', 'system', 'info', 'Pipeline completed successfully'),
  ('budget_warning', 'system', 'warn', 'Monthly budget at 75% usage'),
  ('shopify_sync', 'system', 'info', 'Shopify articles synced successfully')
) AS t(action, entity_type, level, message)
WHERE c.slug = 'acme-maintenance';

-- ─── System Configuration ────────────────────
INSERT INTO system_config (key, value, description, category, is_public) VALUES
  ('demo.mode', 'true', 'Enable demo mode for development', 'general', false),
  ('content.default_tone', '"educational"', 'Default tone for content generation', 'content', false),
  ('monitoring.alert_email', '"dev@example.com"', 'Development alert email', 'monitoring', false)
ON CONFLICT (key) DO NOTHING;

-- ─── Sample SEO Analytics ────────────────────
INSERT INTO seo_analytics (client_id, article_id, tracked_date, impressions, clicks, ctr, avg_position)
SELECT
  a.client_id,
  a.id,
  CURRENT_DATE - (i || ' days')::INTERVAL,
  ROUND((RANDOM() * 500 + 100)::numeric, 0),
  ROUND((RANDOM() * 30 + 2)::numeric, 0),
  ROUND((RANDOM() * 0.08 + 0.02)::numeric, 4),
  ROUND((RANDOM() * 15 + 3)::numeric, 1)
FROM articles a
CROSS JOIN generate_series(0, 14) AS i
WHERE a.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM seo_analytics sa
    WHERE sa.article_id = a.id AND sa.tracked_date = CURRENT_DATE - (i || ' days')::INTERVAL
  );

-- ══════════════════════════════════════════════
-- Seed Complete
-- ══════════════════════════════════════════════
-- Users: admin@tds-geo.internal / <redacted>, editor@tds-geo.internal / <redacted> (see local credential store)
-- Password hash generated via bcrypt.hashSync('<redacted>', 12)
-- Client: Acme Maintenance Co. with 10 keywords, articles, activity logs
