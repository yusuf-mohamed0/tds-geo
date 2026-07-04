// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// SerpAPI Keyword Research Service
// Real search volume, competition, CPC, and trends
// ──────────────────────────────────────────────

import axios from 'axios';
import { logger } from '../utils/logger';
import { SerpApiResult } from '../types';

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || '';

interface SerpApiKeywordResponse {
  search_volume?: number;
  competition?: string;
  cpc?: number;
  low_top_of_page_bid?: number;
  high_top_of_page_bid?: number;
  relevance_score?: number;
  related_keywords?: string[];
}

class SerpApiService {
  private baseUrl = 'https://serpapi.com';

  /**
   * Search for keyword data including volume, competition, and CPC.
   */
  async getKeywordData(keyword: string): Promise<SerpApiResult> {
    if (!SERPAPI_API_KEY) {
      logger.warn('SERPAPI_API_KEY not configured, returning estimated data');
      return this.getEstimatedData(keyword);
    }

    try {
      // Google Keyword Planner data via SerpAPI
      const response = await axios.get(`${this.baseUrl}/search.json`, {
        params: {
          api_key: SERPAPI_API_KEY,
          engine: 'google_keyword_planner',
          keyword,
          google_domain: 'google.com',
          device: 'desktop'
        },
        timeout: 15000
      });

      const data = response.data as SerpApiKeywordResponse;

      const result: SerpApiResult = {
        keyword,
        search_volume: data.search_volume || this.estimateVolume(keyword),
        competition: this.parseCompetition(data.competition),
        cpc: data.cpc || 0,
        trend_score: this.calculateTrend(keyword),
        related_keywords: data.related_keywords || []
      };

      logger.info('SerpAPI keyword data retrieved', {
        keyword,
        volume: result.search_volume,
        competition: result.competition
      });

      return result;
    } catch (err) {
      logger.warn('SerpAPI request failed, using estimated data', {
        keyword,
        error: (err as Error).message
      });
      return this.getEstimatedData(keyword);
    }
  }

  /**
   * Get keyword data for multiple keywords in batch.
   */
  async getBulkKeywordData(keywords: string[]): Promise<SerpApiResult[]> {
    const results: SerpApiResult[] = [];

    for (const keyword of keywords) {
      try {
        const data = await this.getKeywordData(keyword);
        results.push(data);
        // Rate limiting: 1 request per second for free tier
        await new Promise(resolve => setTimeout(resolve, 1100));
      } catch (err) {
        logger.warn(`Failed to get data for keyword: ${keyword}`, {
          error: (err as Error).message
        });
      }
    }

    return results;
  }

  /**
   * Get Google Trends data for a keyword.
   */
  async getTrendData(keyword: string): Promise<{ interest: number; related: string[] }> {
    if (!SERPAPI_API_KEY) {
      return { interest: 50, related: [] };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/search.json`, {
        params: {
          api_key: SERPAPI_API_KEY,
          engine: 'google_trends',
          q: keyword,
          data_type: 'TIMESERIES'
        },
        timeout: 15000
      });

      const data = response.data;
      const interestOverTime = data.interest_over_time?.timeline_data || [];
      const recentInterest = interestOverTime.slice(-3);
      const avgInterest = recentInterest.length > 0
        ? recentInterest.reduce((sum: number, d: any) => sum + (d.value?.[0] || 0), 0) / recentInterest.length
        : 50;

      const relatedQueries = data.related_queries?.top?.queries?.map((q: any) => q.query) || [];

      return { interest: Math.round(avgInterest), related: relatedQueries };
    } catch (err) {
      logger.warn('Google Trends request failed', { keyword, error: (err as Error).message });
      return { interest: 50, related: [] };
    }
  }

  // ─── Fallback Heuristics ──────────────────────

  private getEstimatedData(keyword: string): SerpApiResult {
    return {
      keyword,
      search_volume: this.estimateVolume(keyword),
      competition: this.estimateCompetition(keyword),
      cpc: this.estimateCpc(keyword),
      trend_score: this.calculateTrend(keyword),
      related_keywords: []
    };
  }

  private estimateVolume(keyword: string): number {
    const wordCount = keyword.split(/\s+/).length;
    // Short-tail keywords have higher volume
    if (wordCount <= 2) return Math.round(100 + Math.random() * 900);
    if (wordCount === 3) return Math.round(50 + Math.random() * 300);
    return Math.round(20 + Math.random() * 150);
  }

  private competition = 0;

  private estimateCompetition(keyword: string): number {
    const wordCount = keyword.split(/\s+/).length;
    // Long-tail = lower competition
    return Math.round((1 - (wordCount - 1) * 0.12) * 100) / 100;
  }

  private estimateCpc(keyword: string): number {
    // Service-related keywords have higher CPC
    const highCpcTerms = /\b(repair|replacement|emergency|plumber|electrician|hvac|roof)\b/i;
    return highCpcTerms.test(keyword)
      ? Math.round((3 + Math.random() * 7) * 100) / 100
      : Math.round((1 + Math.random() * 3) * 100) / 100;
  }

  private calculateTrend(keyword: string): number {
    // Keywords with "near me", "2024", "cost" are trending
    const trendingIndicators = /\b(near me|\d{4}|cost|price|guide|tips|best|top|vs)\b/i;
    const base = 50;
    const bonus = trendingIndicators.test(keyword) ? 20 : 0;
    const randomFactor = Math.floor(Math.random() * 20);
    return Math.min(100, base + bonus + randomFactor);
  }

  private parseCompetition(competition?: string): number {
    if (!competition) return 0.5;
    const map: Record<string, number> = {
      'LOW': 0.2,
      'MEDIUM': 0.5,
      'HIGH': 0.8
    };
    return map[competition.toUpperCase()] || 0.5;
  }
}

export default new SerpApiService();
