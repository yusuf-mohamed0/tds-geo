// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Semantic SEO Intelligence Engine
// SERP analysis, entity extraction, topical authority mapping,
// semantic relevance scoring, search intent classification,
// NLP keyword clustering, EEAT optimization
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import openaiService from './openai';
import { SeoAnalysis } from '../types';

interface SerpAnalysis {
  keyword: string;
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  topRankingUrls: string[];
  avgTitleLength: number;
  featuredSnippetTypes: string[];
  serpFeatures: string[];
  competitorHeadings: string[];
  entityLandscape: string[];
}

interface EntityExtraction {
  entities: Array<{ name: string; type: string; salience: number }>;
  topics: string[];
  keywordCluster: string[];
}

interface TopicalAuthorityScore {
  score: number;
  coveredTopics: string[];
  missingTopics: string[];
  gapScore: number;
  recommendations: string[];
}

interface SearchIntentClassification {
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  confidence: number;
  subIntents: string[];
  suggestedContentFormat: string;
}

interface CompetitiveAnalysis {
  keyword: string;
  competitors: Array<{
    url: string;
    title: string;
    wordCount: number;
    estimatedTraffic: number;
    domainAuthority: number;
    strengths: string[];
    weaknesses: string[];
  }>;
  contentGaps: string[];
  opportunityScore: number;
}

class SeoIntelligenceService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('SEO Intelligence Engine initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // SEARCH INTENT CLASSIFICATION
  // ══════════════════════════════════════════════════════════════

  async classifySearchIntent(keyword: string): Promise<SearchIntentClassification> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are an SEO analyst specializing in search intent classification.
Given a keyword, classify its dominant search intent.

Respond with JSON:
{
  "intent": "informational|commercial|transactional|navigational",
  "confidence": 0.0-1.0,
  "subIntents": ["array of sub-intents"],
  "suggestedContentFormat": "the best content format for this intent"
}

Intent definitions:
- informational: user wants to learn (guides, articles, tutorials)
- commercial: user researching before purchase (comparisons, reviews, best-of)
- transactional: user ready to buy/act (pricing, booking, buy now)
- navigational: user looking for specific brand/site`
        },
        {
          role: 'user',
          content: `Keyword: "${keyword}"`
        }
      ], { temperature: 0.2 });

      if (result) {
        return JSON.parse(result);
      }
    } catch (err) {
      logger.warn('Search intent classification failed', { keyword, error: (err as Error).message });
    }

    return {
      intent: 'informational',
      confidence: 0.5,
      subIntents: ['general learning'],
      suggestedContentFormat: 'blog post'
    };
  }

  // ══════════════════════════════════════════════════════════════
  // ENTITY EXTRACTION
  // ══════════════════════════════════════════════════════════════

  async extractEntities(content: string): Promise<EntityExtraction> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are an NLP entity extraction system.
Extract named entities, topics, and keyword clusters from the given content.

Respond with JSON:
{
  "entities": [{"name": "entity name", "type": "PERSON|ORG|GPE|PRODUCT|EVENT|CONCEPT|TERM", "salience": 0.0-1.0}],
  "topics": ["topic1", "topic2"],
  "keywordCluster": ["related keyword1", "related keyword2"]
}

Include entities that are important for SEO topical authority.`
        },
        {
          role: 'user',
          content: content.slice(0, 8000)
        }
      ], { temperature: 0.2 });

      if (result) {
        return JSON.parse(result);
      }
    } catch (err) {
      logger.warn('Entity extraction failed', { error: (err as Error).message });
    }

    return { entities: [], topics: [], keywordCluster: [] };
  }

  // ══════════════════════════════════════════════════════════════
  // TOPICAL AUTHORITY ANALYSIS
  // ══════════════════════════════════════════════════════════════

  async analyzeTopicalAuthority(
    content: string,
    mainKeyword: string,
    entityLandscape: string[]
  ): Promise<TopicalAuthorityScore> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are a topical authority analyst for SEO.
Given content about "${mainKeyword}", analyze how well it covers the topic.

The expected entity landscape for this topic includes: ${entityLandscape.join(', ')}

Respond with JSON:
{
  "score": 0-100,
  "coveredTopics": ["topics thoroughly covered"],
  "missingTopics": ["important topics missing"],
  "gapScore": 0-100,
  "recommendations": ["actionable recommendations to improve topical authority"]
}`
        },
        {
          role: 'user',
          content: content.slice(0, 8000)
        }
      ], { temperature: 0.2 });

      if (result) {
        return JSON.parse(result);
      }
    } catch (err) {
      logger.warn('Topical authority analysis failed', { error: (err as Error).message });
    }

    return {
      score: 50,
      coveredTopics: [],
      missingTopics: [],
      gapScore: 50,
      recommendations: ['Consider adding more comprehensive coverage of subtopics']
    };
  }

  // ══════════════════════════════════════════════════════════════
  // COMPETITIVE ANALYSIS (via LLM simulated SERP analysis)
  // ══════════════════════════════════════════════════════════════

  async analyzeSERP(keyword: string): Promise<SerpAnalysis> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are a SERP analyst. Analyze what the search results page would look like for the given keyword.
Provide realistic SERP features and competitor analysis based on typical search patterns.

Respond with JSON:
{
  "keyword": "${keyword}",
  "searchIntent": "informational|commercial|transactional|navigational",
  "topRankingUrls": ["example.com/url1", "example.com/url2"],
  "avgTitleLength": 55,
  "featuredSnippetTypes": ["paragraph", "list", "table"],
  "serpFeatures": ["featured_snippet", "people_also_ask", "related_searches"],
  "competitorHeadings": ["common heading patterns"],
  "entityLandscape": ["important entities for this topic"]
}`
        },
        {
          role: 'user',
          content: `Analyze SERP for: "${keyword}"`
        }
      ], { temperature: 0.3 });

      if (result) {
        return JSON.parse(result);
      }
    } catch (err) {
      logger.warn('SERP analysis failed', { keyword, error: (err as Error).message });
    }

    return {
      keyword,
      searchIntent: 'informational',
      topRankingUrls: [],
      avgTitleLength: 55,
      featuredSnippetTypes: [],
      serpFeatures: [],
      competitorHeadings: [],
      entityLandscape: []
    };
  }

  async analyzeCompetitors(keyword: string): Promise<CompetitiveAnalysis> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are a competitive SEO analyst. For the keyword "${keyword}", simulate a competitive analysis.
Based on typical search results, identify what competing content looks like and find content gaps.

Respond with JSON:
{
  "keyword": "${keyword}",
  "competitors": [
    {
      "url": "example.com/page",
      "title": "Page Title",
      "wordCount": 1500,
      "estimatedTraffic": 5000,
      "domainAuthority": 65,
      "strengths": ["strength1"],
      "weaknesses": ["weakness1"]
    }
  ],
  "contentGaps": ["what's missing from competitors"],
  "opportunityScore": 0-100
}`
        },
        {
          role: 'user',
          content: `Competitive analysis for keyword: "${keyword}"`
        }
      ], { temperature: 0.3 });

      if (result) {
        return JSON.parse(result);
      }
    } catch (err) {
      logger.warn('Competitive analysis failed', { keyword, error: (err as Error).message });
    }

    return {
      keyword,
      competitors: [],
      contentGaps: [],
      opportunityScore: 50
    };
  }

  // ══════════════════════════════════════════════════════════════
  // EEAT OPTIMIZATION
  // ══════════════════════════════════════════════════════════════

  async optimizeEEAT(content: string, keyword: string): Promise<{
    score: number;
    suggestions: string[];
    optimizedContent?: string;
  }> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are an EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) optimization specialist.
Analyze and improve the content for EEAT signals.

Respond with JSON:
{
  "score": 0-100,
  "suggestions": ["specific EEAT improvements"],
  "optimizedContent": "the content with EEAT improvements (keep original length/style)"
}`
        },
        {
          role: 'user',
          content: `EEAT-optimize this content for keyword "${keyword}":\n\n${content.slice(0, 8000)}`
        }
      ], { temperature: 0.3 });

      if (result) {
        return JSON.parse(result);
      }
    } catch (err) {
      logger.warn('EEAT optimization failed', { error: (err as Error).message });
    }

    return { score: 50, suggestions: ['Add author credentials and experience indicators'] };
  }

  // ══════════════════════════════════════════════════════════════
  // COMPREHENSIVE CONTENT ANALYSIS
  // ══════════════════════════════════════════════════════════════

  async analyzeContentSEO(content: string, keyword: string): Promise<SeoAnalysis> {
    const [intentClassification, serpAnalysis, entityExtraction] = await Promise.all([
      this.classifySearchIntent(keyword),
      this.analyzeSERP(keyword),
      this.extractEntities(content)
    ]);

    const topicalAuthority = await this.analyzeTopicalAuthority(
      content,
      keyword,
      serpAnalysis.entityLandscape
    );

    // Compute composite score
    const baseScore = 50;
    const intentBonus = intentClassification.confidence > 0.7 ? 10 : 0;
    const entityBonus = Math.min(15, entityExtraction.entities.length * 3);
    const topicalBonus = Math.round((topicalAuthority.score - 50) * 0.3);
    const gapPenalty = Math.round(topicalAuthority.gapScore * 0.2);
    const finalScore = Math.min(100, Math.max(0,
      baseScore + intentBonus + entityBonus + topicalBonus - gapPenalty
    ));

    return {
      score: finalScore,
      keywordDensity: 0,
      readabilityScore: 70,
      suggestions: [
        ...topicalAuthority.recommendations,
        ...(intentClassification.confidence < 0.7 ? [`Content may not match search intent for "${keyword}"`] : []),
        ...(entityExtraction.entities.length < 3 ? ['Include more named entities and industry-specific terms'] : []),
        `Consider content format: ${intentClassification.suggestedContentFormat}`
      ],
      headingStructure: { h1: false, h2: 0, h3: 0 }
    };
  }

  // ══════════════════════════════════════════════════════════════
  // KEYWORD CLUSTERING & SEMANTIC ANALYSIS
  // ══════════════════════════════════════════════════════════════

  async clusterKeywords(keywords: string[]): Promise<Array<{ cluster: string; keywords: string[]; semanticTheme: string }>> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are an SEO keyword cluster analyst.
Group the given keywords into semantic clusters based on search intent and topical relevance.

Respond with JSON:
{
  "clusters": [
    {"cluster": "cluster name", "keywords": ["kw1", "kw2"], "semanticTheme": "overall theme of this cluster"}
  ]
}`
        },
        {
          role: 'user',
          content: `Keywords: ${JSON.stringify(keywords)}`
        }
      ], { temperature: 0.3 });

      if (result) {
        const parsed = JSON.parse(result);
        return parsed.clusters || [];
      }
    } catch (err) {
      logger.warn('Keyword clustering failed', { error: (err as Error).message });
    }

    return [{ cluster: 'General', keywords, semanticTheme: 'All keywords' }];
  }

  // ══════════════════════════════════════════════════════════════
  // SEMANTIC CONTENT GAP ANALYSIS
  // ══════════════════════════════════════════════════════════════

  async findContentGaps(clientId: string, mainKeyword: string): Promise<{
    gapTopics: string[];
    opportunityScore: number;
    recommendations: string[];
  }> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are a content gap analyst. Given a main keyword, identify topics that should be covered
but typically are missing from competing content. Focus on subtopics that add EEAT value.

Respond with JSON:
{
  "gapTopics": ["topic1", "topic2"],
  "opportunityScore": 0-100,
  "recommendations": ["actionable recommendations"]
}`
        },
        {
          role: 'user',
          content: `Find content gaps for keyword: "${mainKeyword}"`
        }
      ], { temperature: 0.3 });

      if (result) {
        return JSON.parse(result);
      }
    } catch (err) {
      logger.warn('Content gap analysis failed', { error: (err as Error).message });
    }

    return {
      gapTopics: [],
      opportunityScore: 50,
      recommendations: ['Perform deeper competitive analysis']
    };
  }

  // ══════════════════════════════════════════════════════════════
  // INTERNAL LINKING INTELLIGENCE
  // ══════════════════════════════════════════════════════════════

  async findInternalLinkOpportunities(
    content: string,
    existingArticles: Array<{ id: string; title: string; keyword: string }>
  ): Promise<Array<{ articleId: string; reason: string; recommendedAnchor: string; position: number }>> {
    const opportunities: Array<{ articleId: string; reason: string; recommendedAnchor: string; position: number }> = [];

    for (const article of existingArticles) {
      const kw = article.keyword.toLowerCase();
      if (content.toLowerCase().includes(kw)) {
        const position = content.toLowerCase().indexOf(kw);
        opportunities.push({
          articleId: article.id,
          reason: `Mentions related topic: ${article.title}`,
          recommendedAnchor: article.title,
          position
        });
      }
    }

    return opportunities.slice(0, 5);
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default new SeoIntelligenceService();
