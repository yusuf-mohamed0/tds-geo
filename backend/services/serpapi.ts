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
import { getLocaleConfig } from '../utils/locale';

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

  isConfigured(): boolean {
    return Boolean(SERPAPI_API_KEY);
  }

  /**
   * Search for keyword data including volume, competition, and CPC.
   */
  async getKeywordData(keyword: string, locale?: string): Promise<SerpApiResult> {
    if (!SERPAPI_API_KEY) {
      throw new Error('SERPAPI_API_KEY is not configured; keyword metrics cannot be enriched');
    }

    try {
      // Google Keyword Planner data via SerpAPI
      const params: Record<string, string> = {
        api_key: SERPAPI_API_KEY,
        engine: 'google_keyword_planner',
        keyword,
        google_domain: 'google.com',
        device: 'desktop'
      };
      if (locale) {
        const config = getLocaleConfig(locale);
        params.gl = config.serpLocale;
        params.hl = config.serpHl;
      }
      const response = await axios.get(`${this.baseUrl}/search.json`, {
        params,
        timeout: 15000
      });

      const data = response.data as SerpApiKeywordResponse;

      const result: SerpApiResult = {
        keyword,
        search_volume: data.search_volume ?? 0,
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
      logger.warn('SerpAPI request failed', {
        keyword,
        error: (err as Error).message
      });
      throw err;
    }
  }

  /**
   * Get keyword data for multiple keywords in batch.
   */
  async getBulkKeywordData(keywords: string[], locale?: string): Promise<SerpApiResult[]> {
    const results: SerpApiResult[] = [];

    for (const keyword of keywords) {
      try {
        const data = await this.getKeywordData(keyword, locale);
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

  private calculateTrend(keyword: string): number {
    return 50;
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
