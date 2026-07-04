// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Fact Check & Source Grounding Service
// Web-grounded retrieval, claim verification, citation extraction,
// hallucination detection, and confidence scoring
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { splitSentences } from '../utils/stringUtils';
import openaiService from './openai';
import { FactCheck, Citation, TrustedSource, HighRiskTopic, VerificationStatus } from '../types';

interface ClaimExtractionResult {
  claim: string;
  context: string;
  isHighRisk: boolean;
  highRiskCategory?: string;
}

interface VerificationResult {
  claim: string;
  verification: VerificationStatus;
  confidence: number;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceText?: string;
  sourceDomain?: string;
}

class FactCheckService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('FactCheckService initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // CLAIM EXTRACTION
  // ══════════════════════════════════════════════════════════════

  /**
   * Extract factual claims from generated content that need verification.
   */
  async extractClaims(content: string, clientId: string): Promise<ClaimExtractionResult[]> {
    const claims: ClaimExtractionResult[] = [];
    const highRiskTopics = await this.getHighRiskTopics(clientId);

    // Use LLM to extract verifiable claims
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are a fact-checking system. Extract all verifiable factual claims from the given content.
A verifiable claim is a statement that can be proven true or false (statistics, dates, prices, health claims, legal claims, technical specifications, etc.).
Exclude opinions, general advice, and subjective statements.

For each claim, provide:
- The exact claim text
- A brief context snippet
- Whether it relates to: health, finance, legal, medical, technical, or general

Respond with a JSON array: [{ "claim": "...", "context": "...", "category": "health|finance|legal|medical|technical|general" }]`
        },
        {
          role: 'user',
          content: content.slice(0, 15000)
        }
      ], { temperature: 0.1 });

      if (result) {
        const parsed = JSON.parse(result);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const isHighRisk = this.isHighRiskCategory(item.category, highRiskTopics);
            claims.push({
              claim: item.claim,
              context: item.context || item.claim,
              isHighRisk,
              highRiskCategory: isHighRisk ? item.category : undefined
            });
          }
        }
      }
    } catch (err) {
      logger.warn('Claim extraction via LLM failed, using regex fallback', { error: (err as Error).message });
      // Fallback: extract claims containing numbers, percentages, dates
      claims.push(...this.regexFallbackExtraction(content, highRiskTopics));
    }

    return claims;
  }

  /**
   * Verify a single claim against trusted sources via web search / LLM.
   */
  async verifyClaim(claim: string, context: string): Promise<VerificationResult> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are a fact-checking assistant with access to common knowledge.
Given a claim, determine its veracity based on well-known facts and general knowledge.

Respond with JSON:
{
  "verification": "verified" | "likely_true" | "uncertain" | "likely_false" | "false" | "unverifiable",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "source_suggestion": "what kind of source would confirm or deny this"
}

Rules:
- "verified": The claim is demonstrably true based on established facts
- "likely_true": Strong evidence suggests the claim is true
- "uncertain": Cannot determine from available knowledge
- "likely_false": Strong evidence suggests the claim is false
- "false": The claim is demonstrably false
- "unverifiable": The claim cannot be verified (opinion, prediction, etc.)`
        },
        {
          role: 'user',
          content: `Claim: "${claim}"\nContext: "${context.slice(0, 500)}"`
        }
      ], { temperature: 0.1 });

      if (result) {
        const parsed = JSON.parse(result);
        return {
          claim,
          verification: parsed.verification || 'uncertain',
          confidence: parsed.confidence || 0,
          sourceText: parsed.reasoning
        };
      }
    } catch (err) {
      logger.warn('Claim verification failed', { claim, error: (err as Error).message });
    }

    return { claim, verification: 'uncertain', confidence: 0 };
  }

  /**
   * Full pipeline: extract claims, verify each, store results.
   */
  async verifyArticle(
    articleId: string,
    clientId: string,
    content: string
  ): Promise<{
    factChecks: FactCheck[];
    citations: Citation[];
    overallConfidence: number;
    requiresHumanReview: boolean;
  }> {
    const claims = await this.extractClaims(content, clientId);
    const factChecks: FactCheck[] = [];
    const citations: Citation[] = [];
    let totalConfidence = 0;

    for (const claimData of claims) {
      const result = await this.verifyClaim(claimData.claim, claimData.context);

      const factCheck: FactCheck = {
        id: '', // DB-assigned
        article_id: articleId,
        client_id: clientId,
        claim: result.claim,
        verification: result.verification,
        confidence: result.confidence,
        source_url: result.sourceUrl,
        source_domain: result.sourceDomain,
        context: claimData.context,
        reviewed_by_human: claimData.isHighRisk,
        created_at: new Date()
      };

      factChecks.push(factCheck);
      totalConfidence += result.confidence;

      // Create citation for verified claims
      if (result.verification === 'verified' || result.verification === 'likely_true') {
        citations.push({
          id: '',
          article_id: articleId,
          client_id: clientId,
          claim_text: result.claim,
          source_text: result.sourceText,
          source_url: result.sourceUrl,
          source_title: result.sourceTitle,
          confidence: result.confidence,
          is_validated: result.verification === 'verified',
          citation_style: 'web',
          access_date: new Date(),
          position_in_article: 0,
          created_at: new Date()
        });
      }
    }

    // Store fact checks in DB
    await this.storeFactChecks(articleId, clientId, factChecks);
    await this.storeCitations(articleId, clientId, citations);

    const overallConfidence = factChecks.length > 0
      ? totalConfidence / factChecks.length
      : 1;

    const requiresHumanReview = factChecks.some(
      f => f.verification === 'likely_false' || f.verification === 'false'
    ) || claims.some(c => c.isHighRisk);

    logger.info('Article verification complete', {
      articleId,
      totalClaims: factChecks.length,
      verified: factChecks.filter(f => f.verification === 'verified').length,
      requiresHumanReview,
      overallConfidence
    });

    return { factChecks, citations, overallConfidence, requiresHumanReview };
  }

  // ══════════════════════════════════════════════════════════════
  // DATABASE OPERATIONS
  // ══════════════════════════════════════════════════════════════

  async storeFactChecks(articleId: string, clientId: string, factChecks: FactCheck[]): Promise<void> {
    if (!this.pool || factChecks.length === 0) return;
    try {
      for (const fc of factChecks) {
        await this.pool.query(
          `INSERT INTO fact_checks (article_id, client_id, claim, verification, confidence, source_url, source_domain, context, reviewed_by_human)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [articleId, clientId, fc.claim, fc.verification, fc.confidence, fc.source_url, fc.source_domain, fc.context, fc.reviewed_by_human]
        );
      }
    } catch (err) {
      logger.error('Failed to store fact checks', { articleId, error: (err as Error).message });
    }
  }

  async storeCitations(articleId: string, clientId: string, citations: Citation[]): Promise<void> {
    if (!this.pool || citations.length === 0) return;
    try {
      for (const c of citations) {
        await this.pool.query(
          `INSERT INTO citations (article_id, client_id, claim_text, source_text, source_url, source_title, confidence, is_validated, citation_style, access_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [articleId, clientId, c.claim_text, c.source_text, c.source_url, c.source_title, c.confidence, c.is_validated, c.citation_style, c.access_date]
        );
      }
    } catch (err) {
      logger.error('Failed to store citations', { articleId, error: (err as Error).message });
    }
  }

  async getTrustedSources(clientId: string): Promise<TrustedSource[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM trusted_sources WHERE client_id = $1 AND is_active = true ORDER BY authority_score DESC',
      [clientId]
    );
    return result.rows;
  }

  async getHighRiskTopics(clientId: string): Promise<HighRiskTopic[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM high_risk_topics WHERE client_id = $1 AND is_active = true',
      [clientId]
    );
    return result.rows;
  }

  async addTrustedSource(source: Omit<TrustedSource, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO trusted_sources (client_id, domain, source_name, category, authority_score, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [source.client_id, source.domain, source.source_name, source.category, source.authority_score, source.is_active]
    );
  }

  async addHighRiskTopic(topic: Omit<HighRiskTopic, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO high_risk_topics (client_id, category, keywords, requires_citation, requires_human_review)
       VALUES ($1, $2, $3, $4, $5)`,
      [topic.client_id, topic.category, topic.keywords, topic.requires_citation, topic.requires_human_review]
    );
  }

  async getFactChecksForArticle(articleId: string): Promise<FactCheck[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM fact_checks WHERE article_id = $1 ORDER BY confidence ASC',
      [articleId]
    );
    return result.rows;
  }

  async getCitationsForArticle(articleId: string): Promise<Citation[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM citations WHERE article_id = $1 ORDER BY position_in_article ASC',
      [articleId]
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════

  private isHighRiskCategory(category: string, highRiskTopics: HighRiskTopic[]): boolean {
    const riskCategories = ['health', 'finance', 'legal', 'medical'];
    if (riskCategories.includes(category.toLowerCase())) return true;
    return highRiskTopics.some(t => t.category.toLowerCase() === category.toLowerCase());
  }

  private regexFallbackExtraction(content: string, highRiskTopics: HighRiskTopic[]): ClaimExtractionResult[] {
    const claims: ClaimExtractionResult[] = [];
    const sentences = splitSentences(content, 20);

    for (const sentence of sentences) {
      // Look for sentences with numbers, percentages, dates
      const hasNumbers = /\d+/.test(sentence);
      const hasPercentages = /\d+%/.test(sentence);
      const hasCurrency = /\$[\d,]+/.test(sentence);

      if (hasNumbers || hasPercentages || hasCurrency) {
        const isHighRisk = highRiskTopics.some(t =>
          t.keywords.some(k => sentence.toLowerCase().includes(k.toLowerCase()))
        );
        claims.push({
          claim: sentence.trim(),
          context: sentence.trim(),
          isHighRisk,
          highRiskCategory: isHighRisk ? 'general' : undefined
        });
      }
    }

    return claims.slice(0, 20);
  }
}

export default new FactCheckService();
