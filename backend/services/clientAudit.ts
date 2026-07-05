import { logger } from '../utils/logger';
import resilience from './circuitBreaker';
import openaiService from './openai';

export interface ClientAuditResult {
  clientName: string;
  auditDate: string;
  technical: {
    robotsTxt: string;
    sitemapDetected: boolean;
    hasSchemaOrg: boolean;
    hasFaqSchema: boolean;
    hasBreadcrumbSchema: boolean;
    coreWebVitals: string;
    issues: string[];
  };
  content: {
    totalPages: number;
    pagesWithAnswerCapsules: number;
    pagesWithSourcedStats: number;
    entityConsistencyScore: number;
    issues: string[];
  };
  visibility: {
    googleAISnippets: number;
    chatgptCitations: number;
    perplexityReferences: number;
    citationShareRank: string;
  };
  recommendations: string[];
  priorityScore: number;
}

class ClientAuditService {
  async runAudit(
    clientData: {
      name: string;
      domain: string;
      shopifyShop?: string;
      wooCommerceUrl?: string;
    }
  ): Promise<ClientAuditResult> {
    const domain = clientData.domain;
    const issues: string[] = [];

    // Phase 1: Technical checks
    const technical = await this.auditTechnical(domain);

    // Phase 2: Content spot-check
    const content = await this.auditContent(domain);

    // Phase 3: AI visibility scan
    const visibility = await this.auditVisibility(domain);

    // Phase 4: Generate recommendations
    const recommendations = this.generateRecommendations(technical, content, visibility);

    const priorityScore = this.calculatePriority(technical, content, visibility);

    return {
      clientName: clientData.name,
      auditDate: new Date().toISOString().split('T')[0],
      technical,
      content,
      visibility,
      recommendations,
      priorityScore,
    };
  }

  private async auditTechnical(domain: string) {
    const issues: string[] = [];
    let robotsTxt = '';
    let sitemapDetected = false;
    let hasSchemaOrg = false;
    let hasFaqSchema = false;
    let hasBreadcrumbSchema = false;

    try {
      const robotsRes = await fetch(`https://${domain}/robots.txt`, { signal: AbortSignal.timeout(5000) });
      if (robotsRes.ok) {
        robotsTxt = await robotsRes.text();
        if (!robotsTxt.toLowerCase().includes('chatgpt-')) {
          issues.push('No ChatGPT-User crawler directive in robots.txt');
        }
        if (!robotsTxt.toLowerCase().includes('gptbot')) {
          issues.push('No GPTBot crawler directive in robots.txt');
        }
        if (!robotsTxt.toLowerCase().includes('googlebot')) {
          issues.push('No Googlebot crawler directive in robots.txt');
        }
      } else {
        issues.push('robots.txt not found or inaccessible');
      }
    } catch {
      issues.push('Could not fetch robots.txt');
    }

    try {
      const sitemapRes = await fetch(`https://${domain}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
      sitemapDetected = sitemapRes.ok;
    } catch {
      // try common alternatives
      try {
        const sitemapRes = await fetch(`https://${domain}/sitemap_index.xml`, { signal: AbortSignal.timeout(5000) });
        sitemapDetected = sitemapRes.ok;
      } catch { /* no sitemap */ }
    }

    // Check schema on homepage
    try {
      const pageRes = await fetch(`https://${domain}/`, { signal: AbortSignal.timeout(5000) });
      const html = await pageRes.text();
      hasSchemaOrg = html.includes('"@type"') || html.includes('application/ld+json');
      hasFaqSchema = html.includes('FAQPage') || html.includes('faqpage');
      hasBreadcrumbSchema = html.includes('BreadcrumbList');
    } catch { /* no schema check */ }

    return {
      robotsTxt: robotsTxt.slice(0, 500),
      sitemapDetected,
      hasSchemaOrg,
      hasFaqSchema,
      hasBreadcrumbSchema,
      coreWebVitals: 'Requires CrUX API key for measurement',
      issues,
    };
  }

  private async auditContent(domain: string) {
    return {
      totalPages: 0,
      pagesWithAnswerCapsules: 0,
      pagesWithSourcedStats: 0,
      entityConsistencyScore: 0,
      issues: ['Deep content audit requires crawling. Run with --crawl flag for full analysis.'],
    };
  }

  private async auditVisibility(domain: string) {
    return {
      googleAISnippets: 0,
      chatgptCitations: 0,
      perplexityReferences: 0,
      citationShareRank: 'Unknown (requires baseline measurement)',
    };
  }

  private generateRecommendations(
    technical: ClientAuditResult['technical'],
    content: ClientAuditResult['content'],
    visibility: ClientAuditResult['visibility']
  ): string[] {
    const recs: string[] = [];

    if (technical.issues.some(i => i.includes('robots.txt'))) {
      recs.push('Add AI crawler directives to robots.txt (ChatGPT-User, GPTBot, Claude-Web, PerplexityBot)');
    }
    if (!technical.sitemapDetected) {
      recs.push('Create and submit XML sitemap to Google Search Console and Bing Webmaster Tools');
    }
    if (!technical.hasSchemaOrg) {
      recs.push('Implement JSON-LD structured data (Organization, Article, FAQ, BreadcrumbList) on all pages');
    }
    if (!technical.hasFaqSchema) {
      recs.push('Add FAQPage schema to top 10 content pages to boost AI Overview appearance rate');
    }
    if (!technical.hasBreadcrumbSchema) {
      recs.push('Add BreadcrumbList schema for better SERP display and entity context');
    }

    recs.push('Implement IndexNow protocol for instant crawl notification on content changes');
    recs.push('Set up quarterly freshness calendar to update existing content for AI search engines');
    recs.push('Monitor AI citation share monthly using citationTracker service');

    return recs;
  }

  private calculatePriority(
    technical: ClientAuditResult['technical'],
    content: ClientAuditResult['content'],
    visibility: ClientAuditResult['visibility']
  ): number {
    let score = 50;
    if (!technical.hasSchemaOrg) score -= 10;
    if (!technical.hasFaqSchema) score -= 10;
    if (!technical.sitemapDetected) score -= 10;
    if (technical.issues.length > 2) score -= 10;
    if (content.entityConsistencyScore < 50) score -= 10;
    return Math.max(0, Math.min(100, score));
  }
}

export default new ClientAuditService();
