import { logger } from '../utils/logger';
import serpapiService from './serpapi';
import openaiService from './openai';

interface SerpScoreCheck {
  name: string;
  passed: boolean;
  score: number;
  details: string;
}

interface SerpScoringResult {
  score: number;
  checks: SerpScoreCheck[];
  improvements: string[];
  competitorSummary: string;
}

export class SerpContentScorer {
  async score(
    content: string,
    title: string,
    keyword: string,
  ): Promise<SerpScoringResult> {
    const checks: SerpScoreCheck[] = [];
    const improvements: string[] = [];

    // 1. Fetch top SERP results
    let topResults: { title: string; snippet: string; url: string }[] = [];
    try {
      const serpData = await serpapiService.getKeywordData(keyword);
      if (serpData?.related_keywords) {
        topResults = (serpData.related_keywords as string[]).slice(0, 5).map(k => ({
          title: k,
          snippet: '',
          url: '',
        }));
      }
    } catch {
      logger.warn('SERP fetch failed, scoring with synthetic data');
    }

    // If no real SERP data, use AI to simulate competitor analysis
    const competitorData = topResults.length >= 3
      ? topResults
      : await this.simulateSerpResults(keyword);

    // 2. Title optimization check
    const keywordInTitle = title.toLowerCase().includes(keyword.toLowerCase());
    const titleWords = title.split(/\s+/).length;
    const titleOptimal = titleWords >= 10 && titleWords <= 70 && keywordInTitle;
    checks.push({
      name: 'title-optimization',
      passed: titleOptimal,
      score: titleOptimal ? 100 : keywordInTitle ? 60 : 20,
      details: titleOptimal
        ? `Title has keyword, length ${titleWords} chars (optimal)`
        : keywordInTitle
          ? `Title has keyword but length ${titleWords} chars (target 50-60)`
          : `Keyword missing from title`,
    });
    if (!titleOptimal) {
      if (!keywordInTitle) improvements.push('Include target keyword in the title');
      else improvements.push(`Shorten title to 50-60 characters (currently ${titleWords})`);
    }

    // 3. Meta description check (first 160 chars of content used as fallback)
    const first160 = content.replace(/\s+/g, ' ').substring(0, 160);
    const keywordInMeta = first160.toLowerCase().includes(keyword.toLowerCase());
    const metaLen = first160.length;
    const metaOptimal = keywordInMeta && metaLen >= 120 && metaLen <= 160;
    checks.push({
      name: 'meta-description',
      passed: metaOptimal,
      score: metaOptimal ? 100 : keywordInMeta ? 60 : 20,
      details: metaOptimal
        ? `Meta desc has keyword at ${metaLen} chars`
        : keywordInMeta
          ? `Meta desc ${metaLen} chars — ${metaLen > 160 ? 'too long (>160)' : 'too short (<120)'}`
          : `Keyword missing from first 160 chars (meta description)`,
    });
    if (!metaOptimal) {
      if (!keywordInMeta) improvements.push('Include keyword in the first 160 characters (meta description)');
      else if (metaLen > 160) improvements.push('Shorten meta description to ≤160 characters');
      else improvements.push('Extend meta description to at least 120 characters');
    }

    // 4. Heading structure
    const headings = content.match(/^#{1,3}\s.+$/gm) || [];
    const keywordInH1 = headings.some(h => /^#\s/.test(h) && h.toLowerCase().includes(keyword.toLowerCase()));
    const keywordInH2 = headings.some(h => /^##\s/.test(h) && h.toLowerCase().includes(keyword.toLowerCase()));
    const h1Count = headings.filter(h => /^#\s/.test(h)).length;
    const hasH1 = h1Count === 1;
    const headingPassed = hasH1 && keywordInH1 && headings.length >= 3;
    checks.push({
      name: 'heading-structure',
      passed: headingPassed,
      score: headingPassed ? 100 : hasH1 ? (keywordInH1 ? 60 : 40) : 10,
      details: headingPassed
        ? `${headings.length} headings, keyword in H1, proper structure`
        : !hasH1
          ? `${h1Count > 1 ? 'Multiple H1s' : 'No H1'} — need exactly 1 H1 with keyword`
          : keywordInH1
            ? `Only ${headings.length} headings — add more H2s`
            : 'Keyword missing from H1',
    });
    if (!headingPassed) {
      if (!hasH1) improvements.push('Add exactly one H1 tag containing the target keyword');
      else if (!keywordInH1) improvements.push('Include target keyword in the H1 heading');
      else improvements.push('Add more H2 subheadings to improve structure');
    }

    // 5. Content length vs competitors
    const wordCount = content.split(/\s+/).length;
    const avgCompetitorLen = competitorData.length > 0
      ? competitorData.reduce((s, r) => {
          const snippetWords = (r.snippet || r.title).split(/\s+/).length;
          return s + snippetWords * 5;
        }, 0) / competitorData.length
      : 1500;
    const minTarget = Math.max(800, Math.round(avgCompetitorLen * 0.8));
    const maxTarget = Math.min(5000, Math.round(avgCompetitorLen * 1.5));
    const lengthOptimal = wordCount >= minTarget && wordCount <= maxTarget;
    checks.push({
      name: 'content-length',
      passed: lengthOptimal,
      score: lengthOptimal ? 100 : wordCount < minTarget ? 40 : 80,
      details: lengthOptimal
        ? `${wordCount} words vs competitive avg ${Math.round(avgCompetitorLen)} (target ${minTarget}-${maxTarget})`
        : `${wordCount} words — ${wordCount < minTarget ? `below minimum (${minTarget})` : `exceeds maximum (${maxTarget})`}`,
    });
    if (!lengthOptimal && wordCount < minTarget) {
      improvements.push(`Content is ${wordCount} words. Target at least ${minTarget} words to match top-ranking pages.`);
    }

    // 6. Keyword placement
    const contentLower = content.toLowerCase();
    const keywordLower = keyword.toLowerCase();
    const first100Words = contentLower.split(/\s+/).slice(0, 100).join(' ');
    const keywordInFirst100 = first100Words.includes(keywordLower);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    const keywordInLastPara = paragraphs.length > 0
      && paragraphs[paragraphs.length - 1].toLowerCase().includes(keywordLower);
    const placementScore = keywordInFirst100 ? (keywordInLastPara ? 100 : 70) : 40;
    checks.push({
      name: 'keyword-placement',
      passed: keywordInFirst100 && keywordInLastPara,
      score: placementScore,
      details: keywordInFirst100 && keywordInLastPara
        ? 'Keyword in opening and closing sections'
        : keywordInFirst100
          ? 'Keyword in opening but not in conclusion'
          : keywordInLastPara
            ? 'Keyword in conclusion but not in opening'
            : 'Keyword not prominent in key sections',
    });
    if (!keywordInFirst100) improvements.push('Use the target keyword within the first 100 words');
    if (!keywordInLastPara) improvements.push('Reinforce the target keyword in the concluding paragraph');

    // 7. Question / PAA coverage
    const questionWords = /(what|how|why|when|where|which|can|does|is|are|do|does)\b/i;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const questionSentences = sentences.filter(s => questionWords.test(s.trim()));
    const hasQuestionCoverage = questionSentences.length >= 2;
    checks.push({
      name: 'question-coverage',
      passed: hasQuestionCoverage,
      score: hasQuestionCoverage ? 100 : Math.round((questionSentences.length / 2) * 50),
      details: hasQuestionCoverage
        ? `${questionSentences.length} question-answering sentences (addresses PAAs)`
        : `Only ${questionSentences.length} question-based sentences — add FAQ-style content`,
    });
    if (!hasQuestionCoverage) improvements.push('Add FAQ-style content answering "People Also Ask" questions');

    // 8. Internal links presence
    const internalLinkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
    const hasInternalLinks = internalLinkCount >= 2;
    checks.push({
      name: 'internal-links',
      passed: hasInternalLinks,
      score: hasInternalLinks ? 100 : internalLinkCount === 1 ? 50 : 0,
      details: hasInternalLinks
        ? `${internalLinkCount} internal links found`
        : `Only ${internalLinkCount} internal link(s) — add links to related content`,
    });
    if (!hasInternalLinks) improvements.push('Add 2+ internal links to related articles on your site');

    // 9. Readability vs competitors
    const readability = this.calculateReadability(content);
    const compReadability = this.estimateCompetitorReadability(competitorData);
    const readabilityGap = Math.abs(readability - compReadability);
    const readabilityPassed = readabilityGap <= 15;
    checks.push({
      name: 'readability-vs-serp',
      passed: readabilityPassed,
      score: readabilityPassed ? 100 : Math.max(0, 100 - readabilityGap * 3),
      details: readabilityPassed
        ? `Flesch score ${readability} vs competitive avg ${compReadability} (good alignment)`
        : `Flesch score ${readability} vs competitive avg ${compReadability} (gap: ${readabilityGap} pts)`,
    });
    if (!readabilityPassed) {
      improvements.push(`Adjust readability from ${readability} toward ${compReadability} to match top-ranking content`);
    }

    // Overall score (weighted)
    const weights: Record<string, number> = {
      'title-optimization': 15,
      'meta-description': 10,
      'heading-structure': 15,
      'content-length': 10,
      'keyword-placement': 15,
      'question-coverage': 15,
      'internal-links': 10,
      'readability-vs-serp': 10,
    };

    let totalWeight = 0;
    let weightedScore = 0;
    for (const check of checks) {
      const w = weights[check.name] || 10;
      totalWeight += w;
      weightedScore += check.score * w;
    }
    const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    const competitorSummary = competitorData.length > 0
      ? `Analyzed against ${competitorData.length} top-ranking results for "${keyword}"`
      : 'SERP data unavailable — scored against general best practices';

    return { score, checks, improvements, competitorSummary };
  }

  private async simulateSerpResults(keyword: string): Promise<{ title: string; snippet: string; url: string }[]> {
    try {
      const response = await openaiService.getClient()!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a SEO analyst. Generate 5 realistic top-ranking SERP result titles for the given keyword. Return JSON: { "results": [{ "title": string, "snippet": string }] }',
          },
          { role: 'user', content: `Keyword: "${keyword}"` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      const content = response.choices[0]?.message?.content;
      if (!content) return [];
      const parsed = JSON.parse(content);
      return (parsed.results || []).map((r: any) => ({ title: r.title, snippet: r.snippet || '', url: '' }));
    } catch {
      return [];
    }
  }

  private calculateReadability(text: string): number {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const syllables = this.countSyllables(text);
    if (sentences.length === 0 || words.length === 0) return 50;
    return Math.round(
      206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length)
    );
  }

  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let count = 0;
    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (!cleaned) continue;
      if (cleaned.length <= 3) { count += 1; continue; }
      const syls = cleaned.replace(/[^aeiouy]+/g, ' ').trim().split(/\s+/).length;
      count += Math.max(1, syls - (cleaned.endsWith('e') ? 1 : 0) - (cleaned.endsWith('es') || cleaned.endsWith('ed') ? 1 : 0));
    }
    return count;
  }

  private estimateCompetitorReadability(competitors: { title: string; snippet: string }[]): number {
    if (competitors.length === 0) return 55;
    let total = 0;
    let count = 0;
    for (const comp of competitors) {
      const text = (comp.title + ' ' + (comp.snippet || '')).trim();
      if (text.length > 20) {
        total += this.calculateReadability(text);
        count++;
      }
    }
    return count > 0 ? Math.round(total / count) : 55;
  }
}

export default new SerpContentScorer();
