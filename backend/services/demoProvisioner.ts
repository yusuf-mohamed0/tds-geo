// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// ──────────────────────────────────────────────
// Demo Provisioner — Free Trial / Demo Mode
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';

export interface DemoSignupRequest {
  email: string;
  name: string;
  password: string;
  company?: string;
}

export interface DemoStatus {
  is_demo: boolean;
  trial_ends_at: string | null;
  days_remaining: number;
  articles_used: number;
  articles_limit: number;
  tokens_used: number;
  tokens_limit: number;
  expired: boolean;
}

const DEMO_TRIAL_DAYS = 14;
const DEMO_ARTICLES_LIMIT = 3;
const DEMO_TOKENS_LIMIT = 50000;
const DEMO_COST_LIMIT = 5.00;

class DemoProvisioner {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('DemoProvisioner initialized');
  }

  // ─── Create Demo Account ────────────────────

  async createDemoAccount(req: DemoSignupRequest): Promise<{ clientId: string; userId: string }> {
    if (!this.pool) throw new Error('Service not initialized');

    const client = await this.pool.query('SELECT id FROM clients WHERE name = $1', [req.name]);
    if (client.rows.length > 0) {
      throw new Error('A client with this name already exists');
    }

    const slug = req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-demo';
    const trialEnd = new Date(Date.now() + DEMO_TRIAL_DAYS * 86400000);

    const clientResult = await this.pool.query(
      `INSERT INTO clients (name, slug, shopify_shop, shopify_token, shopify_api_version,
         brand_voice, service_area, timezone, publish_frequency, approval_mode,
         monthly_token_limit, monthly_cost_limit, locale, settings, is_active,
         is_demo, trial_ends_at)
       VALUES ($1, $2, 'demo-' || $2 || '.myshopify.com', 'demo-token', '2025-07',
         'professional and educational', 'demo', 'UTC', 'manual', 'manual',
         $3, $4, 'en', $5, true, true, $6)
       RETURNING id`,
      [req.name, slug, DEMO_TOKENS_LIMIT, DEMO_COST_LIMIT,
       JSON.stringify({ isDemo: true, demoCreatedAt: new Date().toISOString() }),
       trialEnd.toISOString()]
    );

    const clientId = clientResult.rows[0].id;

    const passwordHash = await bcrypt.hash(req.password, 12);
    const userResult = await this.pool.query(
      `INSERT INTO users (email, password_hash, name, role, client_id, is_active)
       VALUES ($1, $2, $3, 'client', $4, true)
       RETURNING id`,
      [req.email, passwordHash, req.name, clientId]
    );
    const userId = userResult.rows[0].id;

    await this.pool.query(
      `INSERT INTO demo_signups (email, name, company, client_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [req.email, req.name, req.company || null, clientId]
    );

    await this.createDemoArticle(clientId);

    logger.info('Demo account created', { clientId, email: req.email, trialEnd });
    return { clientId, userId };
  }

  // ─── Sample Data ────────────────────────────

  private async createDemoArticle(clientId: string): Promise<void> {
    if (!this.pool) return;

    try {
      const title = 'Getting Started with AI-Powered SEO — A Demo Article';
      const slug = 'getting-started-with-ai-seo-demo-' + Date.now().toString(36);
      const contentMd = `# Getting Started with AI-Powered SEO

Welcome to your TDS GEO demo dashboard. This sample article shows what the platform can generate for your business.

## What is AI-Powered SEO?

AI-powered SEO uses machine learning and natural language processing to automate content creation, optimize for search engines, and improve your visibility in both traditional search and AI-generated answers.

## Key Benefits

- **Automated Content Generation**: Generate SEO-optimized articles in minutes
- **Multi-Surface Optimization**: Content optimized for Google, ChatGPT, Perplexity, and Gemini
- **Real-time Analytics**: Track impressions, clicks, and rankings
- **Brand Voice Control**: Maintain consistency across all content

## Getting Started

1. Connect your Shopify store
2. Define your keywords and topics
3. Set your brand voice and preferences
4. Let AI generate and publish content automatically
5. Monitor performance through the analytics dashboard

This demo account includes 3 free article generations to help you evaluate the platform.`;

      await this.pool.query(
        `INSERT INTO articles (client_id, title, slug, content_md, content_html,
           meta_title, meta_description, tags, word_count, status, seo_score, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', 85, 'demo')
         RETURNING id`,
        [clientId, title, slug, contentMd, '<p>' + contentMd.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>',
         'Getting Started with AI-Powered SEO', 'Learn how TDS GEO helps automate SEO content creation and optimization.',
         ['seo', 'ai', 'getting-started'], 256, 'draft', 85, 'demo']
      );
    } catch (err) {
      logger.warn('Failed to create demo article', { error: (err as Error).message });
    }
  }

  // ─── Trial Enforcement ──────────────────────

  async getDemoStatus(clientId: string): Promise<DemoStatus> {
    if (!this.pool) {
      return { is_demo: false, trial_ends_at: null, days_remaining: 0,
              articles_used: 0, articles_limit: 0, tokens_used: 0, tokens_limit: 0, expired: false };
    }

    const clientResult = await this.pool.query(
      `SELECT is_demo, trial_ends_at FROM clients WHERE id = $1`, [clientId]
    );

    if (clientResult.rows.length === 0) {
      return { is_demo: false, trial_ends_at: null, days_remaining: 0,
              articles_used: 0, articles_limit: 0, tokens_used: 0, tokens_limit: 0, expired: false };
    }

    const client = clientResult.rows[0];
    if (!client.is_demo) {
      return { is_demo: false, trial_ends_at: null, days_remaining: 0,
              articles_used: 0, articles_limit: 0, tokens_used: 0, tokens_limit: 0, expired: false };
    }

    const articleCount = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM articles WHERE client_id = $1 AND source != 'demo'`,
      [clientId]
    );

    const tokenUsage = await this.pool.query(
      `SELECT COALESCE(SUM(tokens_in + tokens_out), 0)::bigint as total
       FROM cost_tracking WHERE client_id = $1`,
      [clientId]
    );

    const trialEnd = client.trial_ends_at ? new Date(client.trial_ends_at) : new Date();
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000));
    const expired = now > trialEnd;

    return {
      is_demo: true,
      trial_ends_at: client.trial_ends_at?.toISOString() || null,
      days_remaining: daysRemaining,
      articles_used: parseInt(articleCount.rows[0].count) || 0,
      articles_limit: DEMO_ARTICLES_LIMIT,
      tokens_used: parseInt(tokenUsage.rows[0].total) || 0,
      tokens_limit: DEMO_TOKENS_LIMIT,
      expired,
    };
  }

  async checkGenerationAllowed(clientId: string): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.pool) return { allowed: true };

    const clientResult = await this.pool.query(
      `SELECT is_demo, trial_ends_at, is_active FROM clients WHERE id = $1`,
      [clientId]
    );

    if (clientResult.rows.length === 0) return { allowed: false, reason: 'Client not found' };

    const client = clientResult.rows[0];
    if (!client.is_demo) return { allowed: true };

    if (!client.is_active) return { allowed: false, reason: 'Demo account has been disabled' };

    if (client.trial_ends_at && new Date(client.trial_ends_at) < new Date()) {
      return { allowed: false, reason: 'Demo trial has expired' };
    }

    const status = await this.getDemoStatus(clientId);
    if (status.articles_used >= status.articles_limit) {
      return { allowed: false, reason: `Demo article limit reached (${status.articles_limit}). Upgrade to continue generating.` };
    }

    return { allowed: true };
  }

  // ─── Trial Expiry ───────────────────────────

  async expireTrial(clientId: string): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(
      `UPDATE clients SET is_active = false WHERE id = $1 AND is_demo = true`,
      [clientId]
    );

    await this.pool.query(
      `UPDATE demo_signups SET status = 'expired' WHERE client_id = $1`,
      [clientId]
    );

    logger.info('Demo trial expired', { clientId });
  }

  async checkExpiredTrials(): Promise<number> {
    if (!this.pool) return 0;

    const result = await this.pool.query(
      `UPDATE clients SET is_active = false
       WHERE is_demo = true AND trial_ends_at < NOW() AND is_active = true
       RETURNING id`
    );

    const expiredIds = result.rows.map(r => r.id);
    if (expiredIds.length > 0) {
      await this.pool.query(
        `UPDATE demo_signups SET status = 'expired'
         WHERE client_id = ANY($1::uuid[])`,
        [expiredIds]
      );
      logger.info('Expired demo trials', { count: expiredIds.length });
    }

    return expiredIds.length;
  }

  // ─── Upgrade ────────────────────────────────

  async upgradeFromDemo(clientId: string, shopifyShop: string, shopifyToken: string): Promise<void> {
    if (!this.pool) throw new Error('Service not initialized');

    await this.pool.query(
      `UPDATE clients SET
         is_demo = false,
         trial_ends_at = NULL,
         shopify_shop = $2,
         shopify_token = $3,
         monthly_token_limit = 1000000,
         monthly_cost_limit = 100.00,
         settings = settings || '{"upgradedFromDemo": true}'::jsonb
       WHERE id = $1 AND is_demo = true`,
      [clientId, shopifyShop, shopifyToken]
    );

    await this.pool.query(
      `UPDATE demo_signups SET status = 'converted', converted_at = NOW()
       WHERE client_id = $1`,
      [clientId]
    );

    logger.info('Demo account upgraded', { clientId, shopifyShop });
  }
}

const demoProvisioner = new DemoProvisioner();
export default demoProvisioner;
