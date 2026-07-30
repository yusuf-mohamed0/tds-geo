-- <YKS />  YUSUF KO STA  Code. Build. Ship.™
-- ──────────────────────────────────────────────
-- Migration: Multi-Language Support
-- Adds locale to clients, articles, and creates
-- locale reference data.
-- ──────────────────────────────────────────────

-- ─── Clients: add locale ─────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en';

-- ─── Articles: add locale ────────────────────
ALTER TABLE articles ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_articles_locale ON articles(locale);
