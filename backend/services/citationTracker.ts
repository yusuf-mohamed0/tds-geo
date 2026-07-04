// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { checkAiCitations } from './geoIntelligence';

export interface CitationRecord {
  id?: number;
  client_id: string;
  article_id?: string;
  engine: string;
  domain: string;
  cited: boolean;
  url?: string;
  snippet?: string;
  checked_at: Date;
}

export interface CitationAuditReport {
  clientId: string;
  domain: string;
  timestamp: string;
  engines: Array<{
    name: string;
    cited: boolean;
    url?: string;
    snippet?: string;
  }>;
  citationCount: number;
  recommendations: string[];
}

class CitationTrackerService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('CitationTrackerService initialized');
  }

  async checkCitations(domain: string): Promise<CitationAuditReport> {
    const engineResults: Array<{
      name: string;
      cited: boolean;
      url?: string;
      snippet?: string;
    }> = [];

    try {
      const result = await checkAiCitations(domain);
      for (const citation of result.citations) {
        engineResults.push({
          name: citation.engine,
          cited: citation.cited,
          url: '',
          snippet: result.summary,
        });
      }
    } catch (err) {
      logger.warn(`Citation check failed for ${domain}`, {
        error: (err as Error).message,
      });
    }

    const citationCount = engineResults.filter(r => r.cited).length;
    const recommendations = this.generateRecommendations(engineResults, citationCount);

    return {
      clientId: '',
      domain,
      timestamp: new Date().toISOString(),
      engines: engineResults,
      citationCount,
      recommendations,
    };
  }

  async saveCitationRecord(record: Omit<CitationRecord, 'id' | 'checked_at'>): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO citation_records (client_id, article_id, engine, domain, cited, url, snippet)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [record.client_id, record.article_id, record.engine, record.domain, record.cited, record.url, record.snippet]
      );
    } catch (err) {
      logger.error('Failed to save citation record', { error: (err as Error).message });
    }
  }

  async getCitationHistory(domain: string, days: number = 90): Promise<CitationRecord[]> {
    if (!this.pool) return [];
    try {
      const result = await this.pool.query(
        `SELECT * FROM citation_records
         WHERE domain = $1 AND checked_at >= NOW() - INTERVAL '1 day' * $2
         ORDER BY checked_at DESC`,
        [domain, days]
      );
      return result.rows;
    } catch (err) {
      logger.error('Failed to get citation history', { error: (err as Error).message });
      return [];
    }
  }

  async getCitationTrend(domain: string, days: number = 90): Promise<Array<{ date: string; count: number }>> {
    if (!this.pool) return [];
    try {
      const result = await this.pool.query(
        `SELECT DATE(checked_at) as date, COUNT(*) FILTER (WHERE cited = true) as count
         FROM citation_records
         WHERE domain = $1 AND checked_at >= NOW() - INTERVAL '1 day' * $2
         GROUP BY DATE(checked_at)
         ORDER BY date`,
        [domain, days]
      );
      return result.rows;
    } catch (err) {
      logger.error('Failed to get citation trend', { error: (err as Error).message });
      return [];
    }
  }

  private generateRecommendations(engines: Array<{ name: string; cited: boolean }>, citationCount: number): string[] {
    const recs: string[] = [];

    if (citationCount === 0) {
      recs.push('No AI citations detected. Implement AEO answer capsules and GEO depth layering immediately.');
    }

    if (!engines.find(e => e.name === 'Google AI Overviews')?.cited) {
      recs.push('Add FAQPage schema to improve Google AI Overviews citation rates (2-3x lift).');
    }

    if (!engines.find(e => e.name === 'ChatGPT')?.cited) {
      recs.push('Front-load answers in the first 100 words for ChatGPT extraction (44.2% of citations come from page top).');
    }

    if (!engines.find(e => e.name === 'Perplexity')?.cited) {
      recs.push('Add sourced statistics with named sources and dates for Perplexity cross-referencing.');
    }

    if (citationCount < 3) {
      recs.push('Increase entity density to 3%+ and add named expert quotes (2+ per 1,000 words, +40.9% citation lift).');
    }

    return recs;
  }

  async runMonthlyAudit(clientId: string, domain: string): Promise<CitationAuditReport> {
    const report = await this.checkCitations(domain);
    report.clientId = clientId;

    for (const engine of report.engines) {
      await this.saveCitationRecord({
        client_id: clientId,
        engine: engine.name,
        domain,
        cited: engine.cited,
        url: engine.url,
        snippet: engine.snippet,
      });
    }

    logger.info('Monthly citation audit complete', {
      clientId,
      domain,
      citationsFound: report.citationCount,
      enginesChecked: report.engines.length,
    });

    return report;
  }
}

export const citationTracker = new CitationTrackerService();
export default citationTracker;
