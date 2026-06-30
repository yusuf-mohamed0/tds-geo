// ──────────────────────────────────────────────
// Internal Linking Service with Semantic Matching
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { escapeRegExp } from '../utils/stringUtils';
import shopifyService from './shopify';
import { ShopifyConfig } from '../types';

class InternalLinksService {
  private pool: Pool | null = null;

  initialize(poolOrConnectionString?: Pool | string): void {
    if (poolOrConnectionString instanceof Pool) {
      this.pool = poolOrConnectionString;
    } else {
      this.pool = new Pool({
        connectionString: poolOrConnectionString || process.env.DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 30000
      });
    }
  }

  private getPool(): Pool {
    if (!this.pool) this.initialize();
    return this.pool!;
  }

  async refreshArticleCache(shopConfig: ShopifyConfig, clientId: string, blogId: number | null = null): Promise<any[]> {
    const pool = this.getPool();

    try {
      const articles = await shopifyService.fetchArticles(shopConfig, blogId, {
        fields: 'id,title,handle,body_html,published_at,tags'
      });

      for (const article of articles) {
        await pool.query(
          `INSERT INTO internal_links_cache (client_id, link_url, link_text)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [clientId, `/blogs/${blogId || 'unknown'}/${article.handle}`, article.title]
        );

        await pool.query(
          `INSERT INTO articles (client_id, title, slug, content_html, status, source)
           VALUES ($1, $2, $3, $4, 'published', 'shopify_import')
           ON CONFLICT (slug) DO UPDATE SET content_html = EXCLUDED.content_html`,
          [clientId, article.title, article.handle, article.body_html]
        );
      }

      logger.info(`Cached ${articles.length} existing articles for internal linking`, { clientId });
      return articles;
    } catch (err) {
      logger.error('Failed to refresh article cache', { clientId, error: (err as Error).message });
      return [];
    }
  }

  async findLinkOpportunities(
    newContent: string, newTitle: string, clientId: string, maxLinks?: number | null
  ): Promise<Array<{ text: string; url: string; reason: string }>> {
    const pool = this.getPool();
    const maxInternalLinks = maxLinks || parseInt(process.env.MAX_INTERNAL_LINKS_PER_ARTICLE || '3', 10);
    const minWordsBetween = parseInt(process.env.MIN_WORDS_BETWEEN_LINKS || '300', 10);

    const existingArticles = await pool.query(
      `SELECT link_text AS title, link_url FROM internal_links_cache
       WHERE client_id = $1 AND is_active = true ORDER BY RANDOM() LIMIT 20`,
      [clientId]
    );

    const ourArticles = await pool.query(
      `SELECT title, slug FROM articles
       WHERE client_id = $1 AND status = 'published' AND title != $2
       ORDER BY created_at DESC LIMIT 20`,
      [clientId, newTitle]
    );

    const candidates = [
      ...existingArticles.rows.map(a => ({ text: a.title, url: a.link_url })),
      ...ourArticles.rows
        .filter(a => !existingArticles.rows.some((e: any) => e.title === a.title))
        .map(a => ({ text: a.title, url: `/blogs/${a.slug}` }))
    ];

    const lowerContent = newContent.toLowerCase();
    const matchedLinks: Array<{ text: string; url: string; position: number; reason: string }> = [];
    const usedPositions: number[] = [];

    for (const candidate of candidates) {
      if (matchedLinks.length >= maxInternalLinks) break;

      const searchTerms = this.extractLinkTerms(candidate.text);
      let bestPosition = -1;
      let bestTerm = '';

      for (const term of searchTerms) {
        const pos = lowerContent.indexOf(term.toLowerCase());
        if (pos >= 0) {
          const tooClose = usedPositions.some(usedPos => Math.abs(pos - usedPos) < minWordsBetween * 5);
          if (!tooClose && (bestPosition === -1 || pos < bestPosition)) {
            bestPosition = pos;
            bestTerm = term;
          }
        }
      }

      if (bestPosition >= 0) {
        matchedLinks.push({ text: bestTerm, url: candidate.url, position: bestPosition, reason: `Related: ${candidate.text}` });
        usedPositions.push(bestPosition);
      }
    }

    return matchedLinks;
  }

  injectLinks(content: string, links: Array<{ text: string; url: string }>): string {
    let result = content;
    const sortedLinks = [...links].sort((a, b) => b.text.length - a.text.length);

    for (const link of sortedLinks) {
      const regex = new RegExp(`\\b${escapeRegExp(link.text)}\\b`, 'i');
      result = result.replace(regex, (match) => `[${match}](${link.url})`);
    }

    logger.info(`Injected ${links.length} internal links into content`);
    return result;
  }

  private extractLinkTerms(title: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'your', 'our', 'is', 'are', 'it', 'its', 'be', 'have',
      'has', 'do', 'does', 'will', 'would', 'could', 'should', 'may', 'might'
    ]);

    const words = title.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
    const terms = new Set<string>();

    for (let i = 0; i < words.length; i++) {
      terms.add(words[i]);
      if (i + 1 < words.length) terms.add(`${words[i]} ${words[i + 1]}`);
      if (i + 2 < words.length) terms.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    return Array.from(terms);
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }
}

export default new InternalLinksService();
