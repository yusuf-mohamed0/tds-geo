// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { getLocaleConfig } from '../utils/locale';

// ─── Types ─────────────────────────────────────

export interface KeywordVolume {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  trend: number[];
  monthlySearches: { year: number; month: number; volume: number }[];
}

export interface KeywordIdea {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  relevance: number;
}

export interface DomainOverview {
  domain: string;
  organicTraffic: number;
  organicKeywords: number;
  paidTraffic: number;
  paidKeywords: number;
  topKeywords: { keyword: string; position: number; traffic: number }[];
  estimatedMonthlyVisits: number;
  referringDomains: number;
  backlinks: number;
}

export interface BacklinkSummary {
  referringDomains: number;
  totalBacklinks: number;
  dofollow: number;
  nofollow: number;
  domainRating: number;
}

export interface SerpResult {
  keyword: string;
  position: number;
  title: string;
  url: string;
  snippet: string;
  estimatedTraffic: number;
  featuredSnippet: boolean;
  peopleAlsoAsk: string[];
}

export interface SiteAuditResult {
  pageUrl: string;
  title: string;
  metaDescription: string;
  h1: string;
  wordCount: number;
  loadTime: number;
  statusCode: number;
  issues: { type: string; description: string; severity: 'high' | 'medium' | 'low' }[];
  score: number;
}

// ─── DataForSEO Client ─────────────────────────

class DataForSeoService {
  private baseUrl = 'https://api.dataforseo.com/v3';
  private authHeader: string;
  private enabled: boolean;

  constructor() {
    const raw = config.openseo.dataforseoApiKey;
    this.enabled = !!raw;
    if (this.enabled) {
      this.authHeader = 'Basic ' + Buffer.from(raw).toString('base64');
    } else {
      this.authHeader = '';
    }
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.enabled) {
      logger.warn(`DataForSEO not configured, skipping request to ${path}`);
      throw new Error('DataForSEO API key not configured');
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        data: body,
        timeout: 30000,
      });

      const result = response.data;
      if (result.status_code !== 20000) {
        throw new Error(`DataForSEO API error: ${result.status_code} - ${result.status_message}`);
      }

      return result.tasks?.[0]?.result;
    } catch (err) {
      logger.error('DataForSEO request failed', {
        path,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  private resolveLocale(locale?: string): { language_code: string; location_code: number } {
    if (!locale) return { language_code: 'en', location_code: 2840 };
    const config = getLocaleConfig(locale);
    return { language_code: config.dataforseoLanguage, location_code: config.dataforseoLocation };
  }

  // ─── Keyword Research ────────────────────

  async getKeywordVolume(keywords: string[], locale?: string): Promise<KeywordVolume[]> {
    const { language_code, location_code } = this.resolveLocale(locale);
    const result = await this.request<any>('POST', '/keywords_data/google/search_volume/live', {
      keywords,
      location_code,
      language_code,
    });
    return (result || []).map((item: any) => ({
      keyword: item.keyword,
      searchVolume: item.search_volume || 0,
      cpc: item.cpc || 0,
      competition: item.competition || 0,
      trend: item.monthly_searches?.slice(-12).map((m: any) => m.search_volume) || [],
      monthlySearches: item.monthly_searches?.map((m: any) => ({
        year: m.year,
        month: m.month,
        volume: m.search_volume,
      })) || [],
    }));
  }

  async getKeywordIdeas(keyword: string, locale?: string): Promise<KeywordIdea[]> {
    const { language_code, location_code } = this.resolveLocale(locale);
    const result = await this.request<any>('POST', '/dataforseo_labs/google/keyword_suggestions/live', {
      keyword,
      location_code,
      language_code,
      limit: 20,
    });
    return (result?.items || []).map((item: any) => ({
      keyword: item.keyword,
      searchVolume: item.search_volume || 0,
      competition: item.competition || 0,
      cpc: item.cpc || 0,
      relevance: item.relevance || 0,
    }));
  }

  async getKeywordDifficulty(keywords: string[], locale?: string): Promise<{ keyword: string; difficulty: number }[]> {
    const { language_code, location_code } = this.resolveLocale(locale);
    const result = await this.request<any>('POST', '/dataforseo_labs/google/keyword_ideas/live', {
      keywords,
      location_code,
      language_code,
    });
    return (result || []).map((item: any) => ({
      keyword: item.keyword,
      difficulty: item.keyword_difficulty || 0,
    }));
  }

  // ─── Domain Research ──────────────────────

  async getDomainAnalysis(domain: string, locale?: string): Promise<DomainOverview | null> {
    return this.getDomainOverview(domain, locale);
  }

  async getDomainOverview(domain: string, locale?: string): Promise<DomainOverview | null> {
    const { language_code, location_code } = this.resolveLocale(locale);
    const result = await this.request<any>('POST', '/dataforseo_labs/google/domain_overview/live', {
      target: domain,
      location_code,
      language_code,
    });
    if (!result?.[0]) return null;
    const d = result[0];
    return {
      domain: d.domain,
      organicTraffic: d.organic_traffic || 0,
      organicKeywords: d.organic_keywords || 0,
      paidTraffic: d.paid_traffic || 0,
      paidKeywords: d.paid_keywords || 0,
      topKeywords: (d.top_keywords || []).slice(0, 10).map((k: any) => ({
        keyword: k.keyword,
        position: k.position || 0,
        traffic: k.traffic || 0,
      })),
      estimatedMonthlyVisits: d.estimated_monthly_visits || 0,
      referringDomains: d.referring_domains || 0,
      backlinks: d.backlinks || 0,
    };
  }

  async getDomainKeywords(domain: string, limit = 50, locale?: string): Promise<{ keyword: string; position: number; traffic: number }[]> {
    const { language_code, location_code } = this.resolveLocale(locale);
    const result = await this.request<any>('POST', '/dataforseo_labs/google/ranked_keywords/live', {
      target: domain,
      location_code,
      language_code,
      limit,
    });
    return (result?.[0]?.items || []).map((item: any) => ({
      keyword: item.keyword,
      position: item.position || 0,
      traffic: item.estimated_traffic || 0,
    }));
  }

  // ─── Competitor Analysis ──────────────────

  async getCompetitors(domain: string, locale?: string): Promise<{ domain: string; traffic: number; overlap: number }[]> {
    const { language_code, location_code } = this.resolveLocale(locale);
    const result = await this.request<any>('POST', '/dataforseo_labs/google/competitors_domain/live', {
      target: domain,
      location_code,
      language_code,
      limit: 10,
    });
    return (result?.[0]?.items || []).map((item: any) => ({
      domain: item.domain,
      traffic: item.estimated_traffic || 0,
      overlap: item.overlap || 0,
    }));
  }

  // ─── Backlinks ────────────────────────────

  async getBacklinkSummary(target: string): Promise<BacklinkSummary | null> {
    const result = await this.request<any>('POST', '/backlinks/summary/live', {
      target,
    });
    if (!result?.[0]) return null;
    const b = result[0];
    return {
      referringDomains: b.referring_domains || 0,
      totalBacklinks: b.backlinks || 0,
      dofollow: b.external_links_dofollow || 0,
      nofollow: b.external_links_nofollow || 0,
      domainRating: b.domain_rating || 0,
    };
  }

  async getCompetitorBacklinks(target: string, limit = 20): Promise<{ url: string; domainRating: number }[]> {
    const result = await this.request<any>('POST', '/backlinks/referring_domains/live', {
      target,
      limit,
    });
    return (result || []).slice(0, limit).map((item: any) => ({
      url: item.source || item.domain || '',
      domainRating: item.domain_rating || 0,
    }));
  }

  // ─── SERP Analysis ────────────────────────

  async getSerpResults(keyword: string, locale?: string): Promise<SerpResult[]> {
    const { language_code, location_code } = this.resolveLocale(locale);
    const result = await this.request<any>('POST', '/serp/google/organic/live', {
      keyword,
      location_code,
      language_code,
      limit: 10,
    });
    return (result?.[0]?.items || [])
      .filter((item: any) => item.type === 'organic')
      .map((item: any) => ({
        keyword,
        position: item.position || 0,
        title: item.title || '',
        url: item.url || '',
        snippet: item.description || '',
        estimatedTraffic: item.estimated_traffic || 0,
        featuredSnippet: item.featured_snippet === true,
        peopleAlsoAsk: item.people_also_ask?.map((q: any) => q.title || q.question) || [],
      }));
  }

  // ─── Site / Page Audit ────────────────────

  async getPageAudit(url: string): Promise<SiteAuditResult | null> {
    const result = await this.request<any>('POST', '/on_page/instant_pages/live', {
      url,
      check_spell: false,
      enable_javascript: false,
      enable_browser_rendering: false,
      min_pages_count: 1,
    });
    if (!result?.[0]) return null;
    const p = result[0];
    return {
      pageUrl: p.url,
      title: p.meta?.title || '',
      metaDescription: p.meta?.description || '',
      h1: p.meta?.h1 || '',
      wordCount: p.word_count || 0,
      loadTime: p.load_time || 0,
      statusCode: p.status_code || 0,
      issues: (p.page_issues || [])
        .filter((i: any) => i.severity)
        .slice(0, 20)
        .map((i: any) => ({
          type: i.type || i.issue_type || '',
          description: i.description || '',
          severity: i.severity as 'high' | 'medium' | 'low',
        })),
      score: p.page_score || 0,
    };
  }

  // ─── Bulk Keyword Discovery for Content ───

  async discoverContentKeywords(topic: string, locale?: string): Promise<{
    primary: string[];
    longTail: string[];
    questions: string[];
    related: string[];
  }> {
    const ideas = await this.getKeywordIdeas(topic, locale);
    const primary: string[] = [];
    const longTail: string[] = [];
    const questions: string[] = [];
    const related: string[] = [];

    for (const idea of ideas) {
      const words = idea.keyword.split(/\s+/).length;
      if (idea.keyword.includes('?')) {
        questions.push(idea.keyword);
      } else if (words >= 4) {
        longTail.push(idea.keyword);
      } else if (idea.relevance > 0.5) {
        primary.push(idea.keyword);
      } else {
        related.push(idea.keyword);
      }
    }

    return {
      primary: [...new Set(primary)],
      longTail: [...new Set(longTail)],
      questions: [...new Set(questions)],
      related: [...new Set(related)],
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export default new DataForSeoService();
