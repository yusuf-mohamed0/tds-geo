// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Pool } from 'pg';
import { logger } from '../utils/logger';

const KNOWN_AI_CRAWLERS = [
  { pattern: /GPTBot/i, name: 'GPTBot' },
  { pattern: /OAI-SearchBot/i, name: 'OAI-SearchBot' },
  { pattern: /ChatGPT-User/i, name: 'ChatGPT-User' },
  { pattern: /PerplexityBot/i, name: 'PerplexityBot' },
  { pattern: /Perplexity-User/i, name: 'Perplexity-User' },
  { pattern: /ClaudeBot/i, name: 'ClaudeBot' },
  { pattern: /Claude-User/i, name: 'Claude-User' },
  { pattern: /Anthropic-AI/i, name: 'Anthropic-AI' },
  { pattern: /Google-Extended/i, name: 'Google-Extended' },
  { pattern: /Applebot-Extended/i, name: 'Applebot-Extended' },
  { pattern: /Googlebot/i, name: 'Googlebot' },
  { pattern: /Meta-ExternalAgent/i, name: 'Meta-ExternalAgent' },
  { pattern: /Bytespider/i, name: 'Bytespider' },
  { pattern: /CCBot/i, name: 'CCBot' },
  { pattern: /cohere-ai/i, name: 'cohere-ai' },
  { pattern: /Amazonbot/i, name: 'Amazonbot' },
  { pattern: /Bingbot/i, name: 'Bingbot' },
  { pattern: /BingPreview/i, name: 'BingPreview' },
  { pattern: /FacebookBot/i, name: 'FacebookBot' },
  { pattern: /Slurp/i, name: 'Yahoo Slurp' },
  { pattern: /DuckDuckBot/i, name: 'DuckDuckBot' },
  { pattern: /Baidu/i, name: 'Baidu' },
  { pattern: /Yandex/i, name: 'Yandex' },
  { pattern: /Sogou/i, name: 'Sogou' },
  { pattern: /Seznam/i, name: 'Seznam' },
  { pattern: /YouBot/i, name: 'YouBot' },
];

export function identifyCrawler(userAgent: string): string | null {
  if (!userAgent) return null;
  for (const crawler of KNOWN_AI_CRAWLERS) {
    if (crawler.pattern.test(userAgent)) return crawler.name;
  }
  // Generic bot detection
  if (/\b(bot|crawler|spider|scraper)\b/i.test(userAgent)) return 'Unknown Bot';
  return null;
}

export class CrawlerTrackerService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('CrawlerTrackerService not initialized');
    return this.pool;
  }

  async logVisit(
    crawlerName: string,
    userAgent: string,
    path: string,
    ipAddress: string,
    clientId?: string
  ): Promise<void> {
    try {
      await this.getPool().query(
        `INSERT INTO crawler_visits (client_id, crawler_name, user_agent, path, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [clientId || null, crawlerName, userAgent.slice(0, 500), path, ipAddress]
      );
    } catch (err: any) {
      // Non-fatal
      logger.warn('Failed to log crawler visit', { error: err.message });
    }
  }

  async getStats(clientId: string, days: number = 30): Promise<{
    totalVisits: number;
    uniqueCrawlers: number;
    topCrawlers: { name: string; count: number }[];
    dailyTrend: { date: string; count: number }[];
    topPaths: { path: string; count: number }[];
  }> {
    const since = new Date(Date.now() - days * 86400000);

    const totalResult = await this.getPool().query(
      'SELECT COUNT(*) as count FROM crawler_visits WHERE client_id = $1 AND visited_at >= $2',
      [clientId, since]
    );
    const totalVisits = parseInt(totalResult.rows[0]?.count || '0');

    const uniqueResult = await this.getPool().query(
      'SELECT COUNT(DISTINCT crawler_name) as count FROM crawler_visits WHERE client_id = $1 AND visited_at >= $2',
      [clientId, since]
    );
    const uniqueCrawlers = parseInt(uniqueResult.rows[0]?.count || '0');

    const topCrawlersResult = await this.getPool().query(
      `SELECT crawler_name as name, COUNT(*) as count
       FROM crawler_visits
       WHERE client_id = $1 AND visited_at >= $2
       GROUP BY crawler_name
       ORDER BY count DESC LIMIT 10`,
      [clientId, since]
    );
    const topCrawlers = topCrawlersResult.rows;

    const dailyResult = await this.getPool().query(
      `SELECT DATE(visited_at) as date, COUNT(*) as count
       FROM crawler_visits
       WHERE client_id = $1 AND visited_at >= $2
       GROUP BY DATE(visited_at)
       ORDER BY date ASC`,
      [clientId, since]
    );
    const dailyTrend = dailyResult.rows;

    const pathsResult = await this.getPool().query(
      `SELECT path, COUNT(*) as count
       FROM crawler_visits
       WHERE client_id = $1 AND visited_at >= $2
       GROUP BY path
       ORDER BY count DESC LIMIT 10`,
      [clientId, since]
    );
    const topPaths = pathsResult.rows;

    return { totalVisits, uniqueCrawlers, topCrawlers, dailyTrend, topPaths };
  }
}

export const crawlerTrackerService = new CrawlerTrackerService();
export default crawlerTrackerService;
