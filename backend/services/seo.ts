// ──────────────────────────────────────────────
// SEO Optimization & Quality Analysis Service
// ──────────────────────────────────────────────

import { logger } from '../utils/logger';
import openaiService from './openai';
import { SeoAnalysis } from '../types';

class SeoService {
  async analyzeContent(content: string, keyword: string): Promise<SeoAnalysis> {
    try {
      const analysis = await openaiService.analyzeSEO(content, keyword);
      const heuristicResults = this.heuristicAnalysis(content, keyword);

      return {
        score: (analysis.score as number) || heuristicResults.score,
        keywordDensity: (analysis.keywordDensity as number) || heuristicResults.keywordDensity,
        readabilityScore: (analysis.readabilityScore as number) || heuristicResults.readabilityScore,
        suggestions: (analysis.suggestions as string[]) || heuristicResults.suggestions,
        headingStructure: (analysis.headingStructure as any) || heuristicResults.headingStructure
      };
    } catch (err) {
      logger.warn('AI SEO analysis failed, using heuristic analysis', { error: (err as Error).message });
      return this.heuristicAnalysis(content, keyword);
    }
  }

  private heuristicAnalysis(content: string, keyword: string): SeoAnalysis {
    const lowerContent = content.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    const words = content.split(/\s+/).length;
    const keywordCount = (lowerContent.match(new RegExp(this.escapeRegExp(lowerKeyword), 'g')) || []).length;
    const density = words > 0 ? (keywordCount / words) * 100 : 0;

    const h2Count = (content.match(/^## /gm) || []).length;
    const h3Count = (content.match(/^### /gm) || []).length;
    const hasH1 = /^# /.test(content);

    const first100Words = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
    const keywordInIntro = first100Words.includes(lowerKeyword);

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0 ? words / sentences.length : 0;

    // E-E-A-T Scoring
    const eatScore = this.calculateEatScore(content);

    let score = 50;
    if (density >= 0.5 && density <= 2.5) score += 10;
    if (h2Count >= 3) score += 10;
    if (h3Count >= 2) score += 5;
    if (keywordInIntro) score += 10;
    if (avgSentenceLength <= 20) score += 5;
    if (words >= 1000) score += 5;
    score += eatScore;

    const suggestions: string[] = [];
    if (density < 0.5) suggestions.push('Increase keyword usage — density is below 0.5%');
    if (density > 2.5) suggestions.push('Reduce keyword usage — density exceeds 2.5% (risk of keyword stuffing)');
    if (h2Count < 3) suggestions.push('Add more H2 sections to improve content structure');
    if (!keywordInIntro) suggestions.push(`Include target keyword "${keyword}" within the first 100 words`);
    if (avgSentenceLength > 25) suggestions.push('Shorten sentences for better readability');

    return {
      score: Math.min(100, score),
      keywordDensity: Math.round(density * 100) / 100,
      readabilityScore: Math.min(100, Math.max(0, Math.round(100 - (avgSentenceLength - 10) * 3))),
      suggestions,
      headingStructure: { h1: hasH1, h2: h2Count, h3: h3Count }
    };
  }

  /**
   * Calculate E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) score.
   */
  private calculateEatScore(content: string): number {
    let score = 0;

    // Experience indicators
    const experienceTerms = /\b(years of experience|licensed|certified|trained|professional|expert|specialist)\b/gi;
    if (experienceTerms.test(content)) score += 5;

    // Authority indicators
    const authorityTerms = /\b(according to|study shows|research indicates|industry standard|recommended by)\b/gi;
    if (authorityTerms.test(content)) score += 5;

    // Trustworthiness indicators
    const trustTerms = /\b(guarantee|warranty|insurance|satisfaction|safety|standards|compliant)\b/gi;
    if (trustTerms.test(content)) score += 5;

    // Evidence of practical knowledge
    const practicalTerms = /\b(signs|warning|symptoms|indicate|suggest|common|causes|prevent)\b/gi;
    const practicalMatches = content.match(practicalTerms);
    if (practicalMatches && practicalMatches.length >= 3) score += 5;

    return score;
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 200);
  }

  validateContent(article: { title?: string; content?: string; metaTitle?: string; metaDescription?: string; tags?: string[] }): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!article.title || article.title.length < 10) {
      errors.push('Title must be at least 10 characters');
    }

    const words = (article.content || '').split(/\s+/).length;
    if (words < 300) {
      errors.push(`Content too short: ${words} words (minimum 300)`);
    }

    if (!article.metaTitle || article.metaTitle.length > 60) {
      errors.push('Meta title must be present and under 60 characters');
    }

    if (!article.metaDescription || article.metaDescription.length > 160) {
      errors.push('Meta description must be present and under 160 characters');
    }

    if (!article.tags || article.tags.length < 2) {
      errors.push('At least 2 tags are required');
    }

    return { valid: errors.length === 0, errors };
  }

  generateSocialPreview(content: string, maxLength: number = 120): string {
    const plain = content
      .replace(/[#*_~`>\[\]()!]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
    return plain.length > maxLength
      ? plain.slice(0, maxLength - 3) + '...'
      : plain;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default new SeoService();
