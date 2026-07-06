import { logger } from '../utils/logger';

interface QualityGateResult {
  passed: boolean;
  score: number;
  checks: {
    name: string;
    passed: boolean;
    score: number;
    details: string;
  }[];
  summary: string[];
  warnings: string[];
}

export class ContentQualityGate {
  private readonly AI_CLICHE_PATTERNS = [
    /\bin (this )?article\b/i,
    /\bin (today'?s|this )?(digital )?(age|world|landscape)\b/i,
    /\bit is (important|essential|crucial|vital) to\b/i,
    /\blet'?s (dive|delve|deep dive)\b/i,
    /\bunlock the (power|potential|secret)\b/i,
    /\bin conclusion\b/i,
    /\bto (sum up|summarize|wrap up)\b/i,
    /\bthe (cornerstone|bedrock|backbone) of\b/i,
    /\ba (game-changer|paradigm shift|revolutionary)\b/i,
    /\bin the (ever-)?evolving (world|landscape)\b/i,
    /\bit'?s (worth )?noting that\b/i,
    /\bwhen it comes to\b/i,
    /\ba (wide )?range of\b/i,
    /\bin order to\b/i,
    /\blastly\b/i,
    /\bfirstly|secondly|thirdly\b/i,
  ];

  private readonly LOW_INFO_PATTERNS = [
    /\bis (essential|crucial|vital|important|key|critical) for\b/i,
    /\bplays a (vital|crucial|important|key|significant) role\b/i,
    /\bcan(?:not)? be (overstated|understated|overemphasized)\b/i,
    /\bit is (important|necessary|essential) to (note|remember|consider|understand)\b/i,
    /\bin (today'?s|this )?rapidly (changing|evolving) (world|landscape|environment|market)\b/i,
    /\bthe (future|success|growth) of (your|the) (business|company|organization)\b/i,
    /\bwhether you are a (seasoned|experienced) (professional|expert)\b/i,
    /\bthe truth is that\b/i,
    /\bthe fact of the matter is\b/i,
    /\bit goes without saying\b/i,
  ];

  private readonly REPETITIVE_SENTENCE_STARTS = [
    /\bIn addition\b/i,
    /\bMoreover\b/i,
    /\bFurthermore\b/i,
    /\bAdditionally\b/i,
    /\bConsequently\b/i,
    /\bNevertheless\b/i,
    /\bNonetheless\b/i,
    /\bHowever\b/,
    /\bTherefore\b/i,
    /\bThus\b/,
    /\bIndeed\b/i,
    /\bNot only\b/i,
    /\bAs a result\b/i,
    /\bFor example\b/,
    /\bFor instance\b/,
    /\bIn other words\b/i,
  ];

  async evaluate(
    content: string,
    keyword: string,
    options?: {
      existingArticles?: { title: string; content: string }[];
      minWords?: number;
      maxWords?: number;
    }
  ): Promise<QualityGateResult> {
    const checks: QualityGateResult['checks'] = [];
    const summary: string[] = [];
    const warnings: string[] = [];

    const wordCount = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    // 1. Word count check
    const minW = options?.minWords || 800;
    const maxW = options?.maxWords || 3000;
    const wordCountCheck = wordCount >= minW && wordCount <= maxW;
    checks.push({
      name: 'word-count',
      passed: wordCountCheck,
      score: wordCountCheck ? 100 : Math.round((wordCount / minW) * 50),
      details: wordCountCheck
        ? `${wordCount} words (OK)`
        : `${wordCount} words (need ${minW}-${maxW})`,
    });
    if (!wordCountCheck) warnings.push(`Content is ${wordCount} words (target: ${minW}-${maxW})`);

    // 2. AI cliché detection
    const clicheMatches: { pattern: string; count: number }[] = [];
    for (const pattern of this.AI_CLICHE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        clicheMatches.push({ pattern: pattern.source, count: matches.length });
      }
    }
    const totalCliches = clicheMatches.reduce((sum, m) => sum + m.count, 0);
    const clicheThreshold = Math.max(2, Math.floor(wordCount / 500));
    const clichePassed = totalCliches <= clicheThreshold;
    const clicheScore = Math.max(0, 100 - (totalCliches / clicheThreshold) * 50);
    checks.push({
      name: 'ai-cliches',
      passed: clichePassed,
      score: Math.round(clicheScore),
      details: clichePassed
        ? `${totalCliches} AI cliché(s) found (within threshold)`
        : `${totalCliches} AI cliché(s) found (max ${clicheThreshold}) — content reads like AI-generated filler`,
    });
    if (!clichePassed) warnings.push(`Too many AI clichés (${totalCliches}). Rewrite to sound more natural.`);

    // 3. Low-information content detection
    const lowInfoMatches: { pattern: string; count: number }[] = [];
    for (const pattern of this.LOW_INFO_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        lowInfoMatches.push({ pattern: pattern.source, count: matches.length });
      }
    }
    const totalLowInfo = lowInfoMatches.reduce((sum, m) => sum + m.count, 0);
    const lowInfoThreshold = Math.max(2, Math.floor(wordCount / 600));
    const lowInfoPassed = totalLowInfo <= lowInfoThreshold;
    checks.push({
      name: 'low-information-content',
      passed: lowInfoPassed,
      score: Math.max(0, 100 - (totalLowInfo / lowInfoThreshold) * 40),
      details: lowInfoPassed
        ? `${totalLowInfo} low-info phrases (within threshold)`
        : `${totalLowInfo} low-information phrases (max ${lowInfoThreshold}) — content is fluff-heavy`,
    });
    if (!lowInfoPassed) warnings.push(`Content has ${totalLowInfo} low-information filler phrases. Add substance.`);

    // 4. Keyword density check
    const keywordLower = keyword.toLowerCase();
    const contentLower = content.toLowerCase();
    const keywordOccurrences = (contentLower.match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const keywordDensity = (keywordOccurrences / wordCount) * 100;
    const densityPassed = keywordDensity >= 0.5 && keywordDensity <= 3.0;
    checks.push({
      name: 'keyword-density',
      passed: densityPassed,
      score: keywordDensity >= 0.5 && keywordDensity <= 3.0 ? 100
        : keywordDensity < 0.5 ? 30 : 60,
      details: densityPassed
        ? `${keywordDensity.toFixed(2)}% density (target 0.5%-3.0%)`
        : `${keywordDensity.toFixed(2)}% density — ${keywordDensity < 0.5 ? 'under-optimized' : 'over-stuffed'}`,
    });
    if (!densityPassed && keywordDensity > 3.0) warnings.push(`Keyword "${keyword}" appears too frequently (${keywordOccurrences}x). Reduce to avoid stuffing.`);
    if (!densityPassed && keywordDensity < 0.5) warnings.push(`Keyword "${keyword}" appears only ${keywordOccurrences}x. Add more natural mentions.`);

    // 5. Sentence length variety
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgSentenceLength = sentenceLengths.length > 0
      ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
      : 0;
    const veryLongSentences = sentenceLengths.filter(l => l > 40).length;
    const veryShortSentences = sentenceLengths.filter(l => l < 5).length;
    const varietyScore = Math.max(0, 100 -
      (veryLongSentences / Math.max(1, sentences.length)) * 30 -
      (veryShortSentences / Math.max(1, sentences.length)) * 20);
    const varietyPassed = varietyScore >= 50;
    checks.push({
      name: 'sentence-variety',
      passed: varietyPassed,
      score: Math.round(varietyScore),
      details: varietyPassed
        ? `Avg ${avgSentenceLength.toFixed(1)} words/sentence — good variety`
        : `Poor sentence variety: ${veryLongSentences} very long, ${veryShortSentences} very short sentences`,
    });
    if (!varietyPassed) warnings.push('Sentence length variety is poor. Mix short and longer sentences for readability.');

    // 6. Repetitive transition word check
    const transitionMatches: { word: string; count: number }[] = [];
    for (const pattern of this.REPETITIVE_SENTENCE_STARTS) {
      const matches = content.match(new RegExp(`^${pattern.source}`, 'm'));
      if (matches) {
        const word = matches[0].trim();
        const existing = transitionMatches.find(t => t.word.toLowerCase() === word.toLowerCase());
        if (existing) existing.count++;
        else transitionMatches.push({ word, count: 1 });
      }
    }
    const totalTransitions = transitionMatches.reduce((sum, t) => sum + t.count, 0);
    const overusedTransitions = transitionMatches.filter(t => t.count > 3);
    const transitionPassed = overusedTransitions.length === 0;
    checks.push({
      name: 'transition-word-balance',
      passed: transitionPassed,
      score: transitionPassed ? 100 : Math.max(0, 100 - overusedTransitions.length * 15),
      details: transitionPassed
        ? `${totalTransitions} transition words used naturally`
        : `${overusedTransitions.length} transition word(s) overused: ${overusedTransitions.map(t => `"${t.word}" (${t.count}x)`).join(', ')}`,
    });
    if (!transitionPassed) warnings.push(`Overused transition words: ${overusedTransitions.map(t => `"${t.word}" ${t.count}x`).join(', ')}. Vary your sentence openings.`);

    // 7. Paragraph length check
    const paraWords = paragraphs.map(p => p.split(/\s+/).length);
    const veryLongParas = paraWords.filter(w => w > 150).length;
    const veryShortParas = paraWords.filter(w => w < 15 && w > 0).length;
    const paraPassed = veryLongParas === 0 && veryShortParas < paragraphs.length * 0.3;
    checks.push({
      name: 'paragraph-structure',
      passed: paraPassed,
      score: paraPassed ? 100 : Math.max(0, 100 - veryLongParas * 10 - veryShortParas * 5),
      details: paraPassed
        ? `${paragraphs.length} paragraphs, well-structured`
        : `${veryLongParas} overly long paragraphs (>150 words), ${veryShortParas} too short`,
    });

    // 8. Readability estimate
    const syllables = this.countSyllables(content);
    const readabilityScore = sentences.length > 0 && wordCount > 0
      ? 206.835 - 1.015 * (wordCount / sentences.length) - 84.6 * (syllables / wordCount)
      : 0;
    const readabilityGrade = this.getReadabilityGrade(readabilityScore);
    const readabilityPassed = readabilityScore >= 50;
    checks.push({
      name: 'readability',
      passed: readabilityPassed,
      score: Math.round(Math.max(0, Math.min(100, readabilityScore))),
      details: readabilityPassed
        ? `${readabilityGrade} (score ${readabilityScore.toFixed(1)})`
        : `${readabilityGrade} (score ${readabilityScore.toFixed(1)}) — too complex for general audience`,
    });
    if (!readabilityPassed) warnings.push(`Readability score ${readabilityScore.toFixed(1)} (${readabilityGrade}). Target score ≥ 50 for broad accessibility.`);

    // 9. Headings check (for articles with headings)
    const headingMatches = content.match(/^#{1,3}\s.+$/gm);
    if (headingMatches && headingMatches.length > 0) {
      const headingWords = headingMatches.map(h => h.replace(/^#+\s/, ''));
      const shortHeadings = headingWords.filter(h => h.split(/\s+/).length < 3);
      const headingPassed = shortHeadings.length === 0;
      checks.push({
        name: 'heading-quality',
        passed: headingPassed,
        score: headingPassed ? 100 : Math.max(0, 100 - shortHeadings.length * 20),
        details: headingPassed
          ? `${headingMatches.length} descriptive headings`
          : `${shortHeadings.length} heading(s) too short — use 3+ word descriptive headings`,
      });
      if (!headingPassed) warnings.push('Some headings are too short. Use descriptive 3+ word headings for SEO.');
    }

    // 10. Cannibalization check (if existing articles provided)
    if (options?.existingArticles && options.existingArticles.length > 0) {
      const keywordWords = keyword.toLowerCase().split(/\s+/);
      const conflictingArticles = options.existingArticles.filter(existing => {
        const existingTitle = existing.title.toLowerCase();
        const existingContent = (existing.content || '').toLowerCase();
        const sharedWords = keywordWords.filter(w =>
          existingTitle.includes(w) || existingContent.includes(w)
        );
        return sharedWords.length >= Math.min(2, keywordWords.length);
      });
      const cannibalPassed = conflictingArticles.length === 0;
      checks.push({
        name: 'cannibalization',
        passed: cannibalPassed,
        score: cannibalPassed ? 100 : Math.max(0, 100 - conflictingArticles.length * 25),
        details: cannibalPassed
          ? 'No topic overlap with existing content'
          : `${conflictingArticles.length} existing article(s) cover similar topics: ${conflictingArticles.map(a => a.title).join(', ')}`,
      });
      if (!cannibalPassed) warnings.push(`This topic overlaps with ${conflictingArticles.length} existing article(s). Consider a different angle to avoid cannibalization.`);
    }

    // Calculate overall score (weighted)
    const weights: Record<string, number> = {
      'word-count': 5,
      'ai-cliches': 15,
      'low-information-content': 15,
      'keyword-density': 15,
      'sentence-variety': 10,
      'transition-word-balance': 10,
      'paragraph-structure': 5,
      'readability': 15,
      'heading-quality': 5,
      'cannibalization': 5,
    };

    let totalWeight = 0;
    let weightedScore = 0;
    for (const check of checks) {
      const weight = weights[check.name] || 10;
      totalWeight += weight;
      weightedScore += check.score * weight;
    }
    const overallScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    const passed = overallScore >= 65;

    if (passed) summary.push(`Quality gate PASSED (score: ${overallScore}/100)`);
    else summary.push(`Quality gate FAILED (score: ${overallScore}/100) — content needs improvement`);

    return { passed, score: overallScore, checks, summary, warnings };
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

  private getReadabilityGrade(score: number): string {
    if (score >= 90) return 'Very Easy (5th grade)';
    if (score >= 80) return 'Easy (6th grade)';
    if (score >= 70) return 'Fairly Easy (7th grade)';
    if (score >= 60) return 'Standard (8th-9th grade)';
    if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
    if (score >= 30) return 'Difficult (College)';
    return 'Very Difficult (College Graduate)';
  }

  generateClientReport(result: QualityGateResult): {
    grade: string;
    passed: boolean;
    score: number;
    message: string;
    warnings: string[];
  } {
    const grade = result.score >= 90 ? 'A' : result.score >= 80 ? 'B' : result.score >= 70 ? 'C' : result.score >= 60 ? 'D' : 'F';
    const message = result.passed
      ? `Content quality grade: ${grade} (${result.score}/100) — looking good!`
      : `Content quality grade: ${grade} (${result.score}/100) — needs revision`;
    return { grade, passed: result.passed, score: result.score, message, warnings: result.warnings };
  }
}

export default new ContentQualityGate();
