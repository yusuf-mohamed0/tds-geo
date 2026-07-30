import { Pool } from 'pg';
import { logger } from '../utils/logger';
import openaiService from './openai';
import serpapiService from './serpapi';

interface KeywordCluster {
  topic: string;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  keywords: EnrichedKeyword[];
  totalVolume: number;
  avgDifficulty: number;
  opportunityScore: number;
  suggestedContentType: 'guide' | 'comparison' | 'how-to' | 'list' | 'faq' | 'review';
}

interface EnrichedKeyword {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  difficulty: number;
  trend: 'rising' | 'stable' | 'declining' | 'unavailable';
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  isQuestion: boolean;
  serpFeatures: string[];
  relevanceScore: number;
  opportunityScore: number;
  clusterTopic: string;
  relatedQuestions: string[];
}

interface SerpAnalysis {
  featuredSnippet: boolean;
  peopleAlsoAsk: string[];
  relatedSearches: string[];
  topResults?: { title: string; url: string; snippet: string }[];
  serpFeatures: string[];
}

class KeywordResearchEngine {
  async discoverWithClustering(
    pool: Pool,
    clientId: string,
    industry: string,
    seedKeywords: string[],
    count: number = 30
  ): Promise<{
    clusters: KeywordCluster[];
    keywords: EnrichedKeyword[];
    summary: {
      totalKeywords: number;
      clustersFound: number;
      avgOpportunity: number;
      topOpportunities: EnrichedKeyword[];
      recommendedContentPlan: { topic: string; contentType: string; priority: number }[];
    };
  }> {
    const allKeywords: EnrichedKeyword[] = [];

    // 1. Generate smart keyword variations from seeds
    const seedVariations = await this.generateSmartVariations(seedKeywords, count);
    const deduped = [...new Set([...seedKeywords, ...seedVariations].map(k => k.toLowerCase().trim()))].slice(0, count);

    // 2. Enrich each keyword with real data
    for (const keyword of deduped) {
      try {
        const enriched = await this.enrichKeyword(keyword, industry);
        if (enriched) allKeywords.push(enriched);
      } catch (err) {
        logger.warn(`Failed to enrich keyword "${keyword}"`, { error: (err as Error).message });
      }
    }

    // 3. AI-powered clustering and intent classification
    const keywordsWithCluster = await this.clusterKeywords(allKeywords, industry);

    // 4. Build clusters
    const clusterMap = new Map<string, EnrichedKeyword[]>();
    for (const kw of keywordsWithCluster) {
      const topic = kw.clusterTopic || 'Other';
      if (!clusterMap.has(topic)) clusterMap.set(topic, []);
      clusterMap.get(topic)!.push(kw);
    }

    const clusters: KeywordCluster[] = [];
    for (const [topic, kws] of clusterMap) {
      const primaryIntent = this.getDominantIntent(kws);
      clusters.push({
        topic,
        intent: primaryIntent,
        keywords: kws.sort((a, b) => b.opportunityScore - a.opportunityScore),
        totalVolume: kws.reduce((s, k) => s + k.searchVolume, 0),
        avgDifficulty: kws.reduce((s, k) => s + k.difficulty, 0) / kws.length,
        opportunityScore: kws.reduce((s, k) => s + k.opportunityScore, 0) / kws.length,
        suggestedContentType: this.suggestContentType(topic, primaryIntent, kws),
      });
    }

    clusters.sort((a, b) => b.opportunityScore - a.opportunityScore);

    const allScored = keywordsWithCluster.sort((a, b) => b.opportunityScore - a.opportunityScore);
    const avgOpp = allScored.length > 0
      ? allScored.reduce((s, k) => s + k.opportunityScore, 0) / allScored.length
      : 0;

    // 5. Generate content plan recommendations
    const contentPlan = clusters
      .filter(c => c.opportunityScore >= 50)
      .slice(0, 5)
      .map(c => ({
        topic: c.topic,
        contentType: c.suggestedContentType,
        priority: Math.round(c.opportunityScore),
      }));

    // 6. Store keywords in DB
    for (const kw of allScored) {
      try {
        await pool.query(
          `INSERT INTO keywords (client_id, keyword, search_volume, competition, relevance_score, source, metadata)
           VALUES ($1, $2, $3, $4, $5, 'ai_research', $6)
           ON CONFLICT (client_id, keyword) DO UPDATE SET
             search_volume = EXCLUDED.search_volume,
             competition = EXCLUDED.competition,
             relevance_score = EXCLUDED.relevance_score,
             updated_at = NOW()`,
          [
            clientId, kw.keyword, kw.searchVolume, kw.competition,
            kw.relevanceScore,
            JSON.stringify({
              difficulty: kw.difficulty,
              trend: kw.trend,
              intent: kw.intent,
              isQuestion: kw.isQuestion,
              serpFeatures: kw.serpFeatures,
              clusterTopic: kw.clusterTopic,
              opportunityScore: kw.opportunityScore,
              cpc: kw.cpc,
              relatedQuestions: kw.relatedQuestions,
            }),
          ]
        );
      } catch (err) {
        logger.warn(`Failed to store keyword "${kw.keyword}"`, { error: (err as Error).message });
      }
    }

    logger.info(`Keyword research complete: ${allScored.length} keywords in ${clusters.length} clusters`, { clientId });

    return {
      clusters,
      keywords: allScored,
      summary: {
        totalKeywords: allScored.length,
        clustersFound: clusters.length,
        avgOpportunity: Math.round(avgOpp),
        topOpportunities: allScored.slice(0, 10),
        recommendedContentPlan: contentPlan,
      },
    };
  }

  private async generateSmartVariations(seeds: string[], targetCount: number): Promise<string[]> {
    try {
      const response = await openaiService.getClient()!.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an elite SEO keyword researcher. Generate ${targetCount} high-value keyword variations.

RULES:
- Cover ALL search intents: informational (how, what, why), commercial (best, vs, review), transactional (buy, near me, service), navigational (brand name)
- Include question-based keywords
- Include long-tail variations (4+ words)
- Include "near me" and local variants where relevant
- Include comparison keywords (X vs Y, X or Y)
- Include trending/modifier keywords (2026, guide, tips, ultimate, complete, professional, affordable, cost)
- Prioritize keywords with clear search intent

Return ONLY a JSON array of strings, no other text.`
          },
          {
            role: 'user',
            content: `Seed keywords: ${seeds.join(', ')}`
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];
      const parsed = JSON.parse(content);
      return parsed.keywords || parsed.variations || parsed;
    } catch (err) {
      logger.warn('Failed to generate smart variations', { error: (err as Error).message });
      return [];
    }
  }

  private async enrichKeyword(keyword: string, industry: string): Promise<EnrichedKeyword | null> {
    let serpData;
    try {
      serpData = await serpapiService.getKeywordData(keyword);
    } catch {
      return null;
    }

    const serpFeatures: SerpAnalysis = { featuredSnippet: false, peopleAlsoAsk: [], relatedSearches: [], serpFeatures: [] };
    const intent = this.classifyIntent(keyword, serpData);

    const isQuestion = /^(what|how|why|when|where|which|who|can|does|is|are|do|does)\b/i.test(keyword);

    const searchVolume = serpData.search_volume;
    const competition = serpData.competition;
    const cpc = serpData.cpc;
    const difficulty = this.calculateDifficulty(competition, searchVolume, keyword);

    const trend = 'unavailable' as const;
    const relevanceScore = this.calculateRelevanceScore(keyword, searchVolume, competition, industry);
    const opportunityScore = this.calculateOpportunityScore(searchVolume, difficulty, competition, relevanceScore, isQuestion);

    return {
      keyword,
      searchVolume,
      competition,
      cpc,
      difficulty,
      trend,
      intent,
      isQuestion,
      serpFeatures: serpFeatures.serpFeatures,
      relevanceScore,
      opportunityScore,
      clusterTopic: '',
      relatedQuestions: serpFeatures.peopleAlsoAsk,
    };
  }

  private async analyzeSerpFeatures(keyword: string): Promise<SerpAnalysis> {
    try {
      const response = await openaiService.getClient()!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Given a search keyword, predict what SERP features would appear. Respond with JSON:
{
  "featuredSnippet": boolean,
  "peopleAlsoAsk": [string],
  "relatedSearches": [string],
  "serpFeatures": [string]
}
Possible features: featured_snippet, people_also_ask, knowledge_panel, local_pack, image_pack, video_carousel, related_searches, top_stories, shopping_results`
          },
          { role: 'user', content: `Keyword: "${keyword}"` }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      return content ? JSON.parse(content) : { featuredSnippet: false, peopleAlsoAsk: [], relatedSearches: [], serpFeatures: [] };
    } catch {
      return { featuredSnippet: false, peopleAlsoAsk: [], relatedSearches: [], serpFeatures: [] };
    }
  }

  private classifyIntent(keyword: string, data: any): EnrichedKeyword['intent'] {
    const kw = keyword.toLowerCase();

    const transactionalTerms = /\b(buy|purchase|order|price|cost|cheap|affordable|discount|deals|coupon|service|near me|hire|contractor|company|quote|estimate|book|appointment|install|repair|replacement)\b/i;
    const commercialTerms = /\b(best|top|review|vs|versus|comparison|compare|alternative|rating|2026|recommended|guide|ultimate|complete|expert)\b/i;
    const navigationalTerms = /\b(official|website|login|sign in|support|contact|location|hours|directions)\b/i;

    if (transactionalTerms.test(kw)) return 'transactional';
    if (commercialTerms.test(kw)) return 'commercial';
    if (navigationalTerms.test(kw)) return 'navigational';
    if (data.competition > 0.7) return 'commercial';

    return 'informational';
  }

  private calculateDifficulty(competition: number, volume: number, keyword: string): number {
    const wordCount = keyword.split(/\s+/).length;
    let difficulty = competition * 70;

    // Short-tail keywords (1-2 words) are harder
    if (wordCount <= 2) difficulty += 20;
    // Long-tail (4+ words) are easier
    else if (wordCount >= 4) difficulty -= 15;

    // High volume = more competition
    if (volume > 1000) difficulty += 10;
    if (volume > 5000) difficulty += 10;

    return Math.max(5, Math.min(95, Math.round(difficulty)));
  }

  private calculateRelevanceScore(keyword: string, volume: number, competition: number, industry: string): number {
    const k = keyword.toLowerCase();
    const industryTerms = industry.toLowerCase().split(/\s+/);
    let score = 50;

    const industryMatch = industryTerms.some(term => k.includes(term));
    if (industryMatch) score += 15;

    const wordCount = k.split(/\s+/).length;
    if (wordCount >= 3) score += 10;
    if (wordCount >= 4) score += 5;

    if (volume > 300) score += 10;
    else if (volume > 100) score += 5;

    if (competition < 0.4) score += 10;
    else if (competition < 0.7) score += 5;

    return Math.min(100, score);
  }

  private calculateOpportunityScore(volume: number, difficulty: number, competition: number, relevance: number, isQuestion: boolean): number {
    // High volume + low difficulty + high relevance = best opportunity
    const volumeScore = Math.min(30, (volume / 100) * 5);
    const difficultyScore = Math.max(0, 30 - difficulty * 0.3);
    const competitionScore = Math.max(0, 20 - competition * 20);
    const relevanceScore = relevance * 0.15;
    const questionBonus = isQuestion ? 5 : 0;

    return Math.round(Math.min(100, volumeScore + difficultyScore + competitionScore + relevanceScore + questionBonus));
  }

  private async clusterKeywords(
    keywords: EnrichedKeyword[],
    industry: string
  ): Promise<EnrichedKeyword[]> {
    if (keywords.length === 0) return [];

    try {
      const keywordList = keywords.map(k => k.keyword);
      const response = await openaiService.getClient()!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a keyword clustering AI. Group the given keywords into topical clusters.

For each keyword, assign:
1. A cluster topic name (short, descriptive, e.g., "Solar Panel Installation", "HVAC Maintenance Cost")
2. The dominant search intent (informational, commercial, transactional, navigational)

Return JSON: { "clusters": [ { "topic": string, "keywords": [string] } ] }

Rules:
- 3-8 keywords per cluster
- Cluster names must be clear content topics
- Keywords in same cluster should have overlapping search intent
- Industry context: ${industry}`
          },
          {
            role: 'user',
            content: `Keywords to cluster: ${JSON.stringify(keywordList)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return keywords;

      const clustering = JSON.parse(content);
      const clusterMap = new Map<string, string>();

      if (clustering.clusters) {
        for (const cluster of clustering.clusters) {
          const topic = cluster.topic || 'Other';
          const kws = cluster.keywords || [];
          for (const kw of kws) {
            clusterMap.set(kw.toLowerCase(), topic);
          }
        }
      }

      return keywords.map(kw => ({
        ...kw,
        clusterTopic: clusterMap.get(kw.keyword.toLowerCase()) || 'Other',
      }));
    } catch (err) {
      logger.warn('AI clustering failed, using flat structure', { error: (err as Error).message });
      return keywords.map(kw => ({ ...kw, clusterTopic: 'Uncategorized' }));
    }
  }

  private getDominantIntent(keywords: EnrichedKeyword[]): KeywordCluster['intent'] {
    const counts = { informational: 0, commercial: 0, transactional: 0, navigational: 0 };
    for (const kw of keywords) counts[kw.intent]++;
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'informational') as KeywordCluster['intent'];
  }

  private suggestContentType(topic: string, intent: KeywordCluster['intent'], keywords: EnrichedKeyword[]): KeywordCluster['suggestedContentType'] {
    const hasQuestion = keywords.some(k => k.isQuestion);
    const hasComparison = keywords.some(k => /\bvs?\b|best|review|comparison|alternative/i.test(k.keyword));
    const hasTransactional = keywords.some(k => /\b(cost|price|service|near me|buy|hire|contractor)\b/i.test(k.keyword));

    if (hasComparison) return 'comparison';
    if (hasQuestion && intent === 'informational') return 'faq';
    if (hasTransactional) return 'how-to';
    if (intent === 'commercial') return 'guide';
    if (intent === 'informational') return 'guide';

    return 'list';
  }

  async suggestContentStrategy(
    pool: Pool,
    clientId: string,
    industry: string,
    seedKeywords: string[]
  ): Promise<{
    contentPlan: { month: number; focus: string; contentType: string; targetKeywords: string[] }[];
    quickWins: EnrichedKeyword[];
    gaps: { topic: string; reason: string }[];
  }> {
    const research = await this.discoverWithClustering(pool, clientId, industry, seedKeywords, 40);

    // Check what content already exists
    const existing = await pool.query(
      'SELECT title, keyword FROM articles WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );
    const existingTopics = new Set(existing.rows.map(r => r.keyword?.toLowerCase()));

    // Find gaps - high opportunity keywords with no existing content
    const gaps = research.keywords
      .filter(kw => !existingTopics.has(kw.keyword.toLowerCase()) && kw.opportunityScore >= 50)
      .slice(0, 10)
      .map(kw => ({
        topic: kw.keyword,
        reason: `${kw.intent} intent, ${kw.searchVolume}/mo volume, ${kw.difficulty} difficulty — opportunity score: ${kw.opportunityScore}`,
      }));

    // Generate 3-month content plan
    const topClusters = research.clusters.slice(0, 6);
    const contentPlan = topClusters.map((cluster, i) => ({
      month: Math.floor(i / 2) + 1,
      focus: cluster.topic,
      contentType: cluster.suggestedContentType,
      targetKeywords: cluster.keywords.slice(0, 5).map(k => k.keyword),
    }));

    return {
      contentPlan,
      quickWins: research.summary.topOpportunities.slice(0, 5),
      gaps,
    };
  }
}

export default new KeywordResearchEngine();
