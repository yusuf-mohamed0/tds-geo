// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from '../utils/logger';
import openaiService from '../services/openai';

export interface GeoEngineScore {
  engine: string;
  score: number;
  passing: boolean;
  issues: string[];
  strengths: string[];
}

export interface GeoAnalysis {
  overallScore: number;
  overallPassing: boolean;
  engines: GeoEngineScore[];
  suggestions: string[];
  entityDensity: number;
  definitionFirstScore: number;
  citationReadiness: number;
}

interface GeoCriterion {
  name: string;
  weight: number;
  check: (content: string) => { score: number; issues: string[]; strengths: string[] };
}

const CHARS_PER_TOKEN = 4;

const AI_ENGINES: Array<{ name: string; criteria: GeoCriterion[] }> = [
  {
    name: 'ChatGPT',
    criteria: [
      {
        name: 'Definition-First Sections',
        weight: 0.30,
        check: (content) => {
          const sections = content.split(/^#{2,3}\s/m);
          let score = 0;
          const issues: string[] = [];
          const strengths: string[] = [];
          let definitionalCount = 0;

          for (const section of sections) {
            const trimmed = section.trim();
            if (trimmed.length < 20) continue;
            const firstSentence = trimmed.split(/[.?!\n]/)[0].trim();
            if (firstSentence.length > 10 && !firstSentence.includes('Introduction')) {
              const hasDefinition = /^(is|are|refers to|encompasses|describes|means|involves|represents)/i.test(firstSentence);
              if (hasDefinition) definitionalCount++;
            }
          }

          const totalSections = Math.max(sections.filter(s => s.trim().length > 20).length, 1);
          score = Math.round((definitionalCount / totalSections) * 100);

          if (score < 60) issues.push(`${score}% of sections start with a definition (target: 100%)`);
          if (score >= 80) strengths.push(`${score}% of sections open with clear definitions`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Conversational Flow',
        weight: 0.25,
        check: (content) => {
          const sentences = content.split(/[.?!]+/).filter(s => s.trim().length > 10);
          const avgWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / Math.max(sentences.length, 1);
          const issues: string[] = [];
          const strengths: string[] = [];

          const score = avgWords < 15 ? 100 : avgWords < 20 ? 80 : avgWords < 25 ? 60 : 40;

          if (avgWords > 20) issues.push(`Average sentence length ${Math.round(avgWords)} words (target: <20)`);
          if (avgWords <= 15) strengths.push(`Conversational sentence length (avg ${Math.round(avgWords)} words)`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Standalone Value Per Section',
        weight: 0.25,
        check: (content) => {
          const sections = content.split(/^#{2,3}\s/m);
          let extractableCount = 0;
          const issues: string[] = [];
          const strengths: string[] = [];

          for (const section of sections) {
            const trimmed = section.trim();
            if (trimmed.length < 20) continue;
            const firstTwoSentences = trimmed.split(/[.?!\n]/).slice(0, 2).filter(s => s.trim().length > 5).join('. ');
            if (firstTwoSentences.length > 30) extractableCount++;
          }

          const total = Math.max(sections.filter(s => s.trim().length > 20).length, 1);
          const score = Math.round((extractableCount / total) * 100);

          if (score < 70) issues.push(`${Math.round((1 - extractableCount/total) * 100)}% of sections lack standalone extractable value`);
          if (score >= 80) strengths.push(`${score}% of sections can be extracted standalone by AI`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Entity Density',
        weight: 0.20,
        check: (content) => {
          const words = content.split(/\s+/).filter(w => w.length > 2);
          const capitalizedWords = new Set(
            words.filter(w => /^[A-Z]/.test(w) && !/^(The|This|That|These|Those|What|When|Where|Why|How|Which|Who|Our|Your|Their|Its|A|An|In|On|At|To|For|With|By|From|As|Is|Are|Was|Were|Has|Have|Had|Will|Would|Could|Should|May|Might|Can|Do|Does|Did|Not|No|Or|And|But|If|So|Than|Then|Also|Very|Just|Only|Even|Still|Already|Now|Here|There)$/i.test(w))
          );
          const density = (capitalizedWords.size / Math.max(words.length, 1)) * 100;
          const issues: string[] = [];
          const strengths: string[] = [];

          const score = density >= 3 ? 100 : density >= 2 ? 75 : density >= 1 ? 50 : 25;

          if (density < 2) issues.push(`Entity density ${density.toFixed(1)}% (target: >3% for AI discoverability)`);
          if (density >= 3) strengths.push(`Strong entity density at ${density.toFixed(1)}%`);

          return { score, issues, strengths };
        }
      }
    ]
  },
  {
    name: 'Perplexity',
    criteria: [
      {
        name: 'Citation-Ready Sentences',
        weight: 0.35,
        check: (content) => {
          const sentences = content.split(/[.?!]+/).filter(s => s.trim().length > 15);
          const issues: string[] = [];
          const strengths: string[] = [];
          let citableCount = 0;

          for (const sentence of sentences) {
            const trimmed = sentence.trim();
            const hasClaim = /\b(is|are|was|were|has|have|had|found|shows|reveals|indicates|according|research|study|data|statistics|reported|demonstrated|confirmed)\b/i.test(trimmed);
            const hasVagueReference = /\b(some|many|most|several|various|numerous)\b/i.test(trimmed) && !/\d/.test(trimmed);
            if (hasClaim && !hasVagueReference) citableCount++;
          }

          const total = Math.max(sentences.length, 1);
          const citablePct = (citableCount / total) * 100;
          const score = citablePct >= 40 ? 100 : citablePct >= 25 ? 75 : citablePct >= 15 ? 50 : 25;

          if (citablePct < 25) issues.push(`Only ${Math.round(citablePct)}% of sentences are citation-ready (target: >40%)`);
          if (citablePct >= 40) strengths.push(`${Math.round(citablePct)}% of sentences are citation-ready for AI extraction`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Fact Density',
        weight: 0.30,
        check: (content) => {
          const words = content.split(/\s+/).length;
          const numbers = (content.match(/\b\d+[%]?/g) || []).length;
          const stats = (content.match(/\b\d+[%]\b/g) || []).length;
          const issues: string[] = [];
          const strengths: string[] = [];
          const numericDensity = (numbers / Math.max(words, 1)) * 100;
          const score = stats >= 3 ? 100 : stats >= 1 ? 75 : numericDensity >= 1 ? 60 : 30;

          if (stats < 2) issues.push(`Only ${stats} statistical claims found (target: 3+ for Perplexity citations)`);
          if (stats >= 3) strengths.push(`${stats} statistical claims provide strong citation material`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Concise Answers',
        weight: 0.20,
        check: (content) => {
          const sections = content.split(/^#{2,3}\s/m);
          const issues: string[] = [];
          const strengths: string[] = [];
          let conciseCount = 0;

          for (const section of sections) {
            const trimmed = section.trim();
            if (trimmed.length < 20) continue;
            if (trimmed.length < 400) conciseCount++;
          }

          const total = Math.max(sections.filter(s => s.trim().length > 20).length, 1);
          const score = Math.round((conciseCount / total) * 100);

          if (score < 50) issues.push(`${100 - score}% of sections exceed 400 chars (Perplexity prefers concise answers)`);
          if (score >= 80) strengths.push(`${score}% of sections are concise (<400 chars for AI snippet extraction)`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Attribution Ready',
        weight: 0.15,
        check: (content) => {
          const issues: string[] = [];
          const strengths: string[] = [];
          const hasAttributions = /\b(according to|as reported by|research from|study by|data from|reported in)\b/i.test(content);
          const score = hasAttributions ? 100 : 30;

          if (!hasAttributions) issues.push('No source attributions found (Perplexity prefers attributed claims)');
          if (hasAttributions) strengths.push('Contains source attributions for AI citation');

          return { score, issues, strengths };
        }
      }
    ]
  },
  {
    name: 'Gemini (Google SGE)',
    criteria: [
      {
        name: 'Structured Data Compat',
        weight: 0.30,
        check: (content) => {
          const issues: string[] = [];
          const strengths: string[] = [];
          const hasLists = /(^\d+\.\s|---|-\s|\*\s)/m.test(content);
          const hasTables = /\|.+\|.+\|/.test(content);
          const hasQA = /^#{1,3}\s.*\?$/m.test(content);
          const score = hasQA ? 100 : hasTables ? 80 : hasLists ? 60 : 30;

          if (!hasLists && !hasTables && !hasQA) issues.push('No structured formats (lists, tables, Q&A) for Gemini snippet extraction');
          if (hasQA) strengths.push('Q&A format supports Gemini featured snippet extraction');
          if (hasTables) strengths.push('Table format supports Gemini structured data display');

          return { score, issues, strengths };
        }
      },
      {
        name: 'Topical Authority Depth',
        weight: 0.30,
        check: (content) => {
          const words = content.split(/\s+/).length;
          const sections = content.split(/^#{2,3}\s/m).filter(s => s.trim().length > 50).length;
          const issues: string[] = [];
          const strengths: string[] = [];
          const depthScore = Math.min(words / 500 + sections * 15, 100);
          const score = Math.round(depthScore);

          if (words < 1500) issues.push(`Content length ${words} words (target: 1500+ for topical authority)`);
          if (sections < 4) issues.push(`Only ${sections} substantive sections (target: 5+ for depth)`);
          if (words >= 1500 && sections >= 5) strengths.push(`Comprehensive depth: ${words} words across ${sections} sections`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'EEAT Signals',
        weight: 0.25,
        check: (content) => {
          const issues: string[] = [];
          const strengths: string[] = [];
          const hasExperience = /\b(years? of experience|practiced|hands.?on|implemented|managed|led|developed|created|built)\b/i.test(content);
          const hasExpertise = /\b(expertise|specialist|expert|certified|licensed|qualified|specialized|authority)\b/i.test(content);
          const hasAuthority = /\b(according to|research|study|published|recognized|awarded|leading|trusted)\b/i.test(content);
          const hasTrust = /\b(trusted|reliable|accurate|verified|guaranteed|safe|secure|private|confidential)\b/i.test(content);
          const signals = [hasExperience, hasExpertise, hasAuthority, hasTrust].filter(Boolean).length;
          const score = Math.round((signals / 4) * 100);

          const missing = [];
          if (!hasExperience) missing.push('Experience');
          if (!hasExpertise) missing.push('Expertise');
          if (!hasAuthority) missing.push('Authority');
          if (!hasTrust) missing.push('Trustworthiness');

          if (missing.length > 0) issues.push(`Missing EEAT signals: ${missing.join(', ')}`);
          if (signals === 4) strengths.push('Strong EEAT signals across all 4 dimensions');

          return { score, issues, strengths };
        }
      },
      {
        name: 'Answer Extraction',
        weight: 0.15,
        check: (content) => {
          const issues: string[] = [];
          const strengths: string[] = [];
          const hasDirectAnswers = /^#{2,3}\s+(What|How|Why|When|Where|Which|Who)\b/im.test(content);
          const firstSentences = content.split(/^#{2,3}\s/m).filter(s => s.trim().length > 20).map(s => s.trim().split(/[.?!\n]/)[0]);
          const answerLengths = firstSentences.map(s => s.split(/\s+/).length);
          const avgAnswerLen = answerLengths.reduce((a, b) => a + b, 0) / Math.max(answerLengths.length, 1);
          const score = hasDirectAnswers ? (avgAnswerLen < 30 ? 100 : 70) : 40;

          if (!hasDirectAnswers) issues.push('No question-answer heading pairs for Gemini direct answers');
          if (hasDirectAnswers && avgAnswerLen < 30) strengths.push('Q&A headings with concise answers support Gemini direct answer extraction');

          return { score, issues, strengths };
        }
      }
    ]
  },
  {
    name: 'Claude (Anthropic)',
    criteria: [
      {
        name: 'Consistent Terminology',
        weight: 0.30,
        check: (content) => {
          const issues: string[] = [];
          const strengths: string[] = [];
          const termVariations = [
            [/AI|artificial intelligence|A\.I\./gi, 'AI'],
            [/SEO|search engine optimization/gi, 'SEO'],
            [/GEO|generative engine optimization/gi, 'GEO'],
          ];
          let totalTerms = 0;
          let dominantTermCount = 0;

          for (const [pattern, preferred] of termVariations) {
            const matches = content.match(pattern);
            if (matches && matches.length > 1) {
              totalTerms += matches.length;
              const preferredMatches = content.match(new RegExp(String(preferred).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
              if (preferredMatches) dominantTermCount += preferredMatches.length;
            }
          }

          const consistency = totalTerms > 0 ? (dominantTermCount / totalTerms) * 100 : 100;
          const score = Math.round(consistency);

          if (consistency < 80) issues.push(`Terminology consistency ${Math.round(consistency)}% (Claude needs uniform terminology)`);
          if (consistency >= 90) strengths.push(`Terminology consistency ${Math.round(consistency)}% — Claude-friendly`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Logical Progression',
        weight: 0.25,
        check: (content) => {
          const sections = content.split(/^#{2,3}\s/m).filter(s => s.trim().length > 20);
          const issues: string[] = [];
          const strengths: string[] = [];

          const progressionWords = ['first', 'second', 'then', 'next', 'finally', 'additionally', 'furthermore', 'moreover', 'consequently', 'therefore', 'as a result', 'in addition', 'beyond', 'looking ahead', 'starting with', 'begin with'];
          let progressionCount = 0;
          for (const section of sections) {
            const first100 = section.slice(0, 100).toLowerCase();
            if (progressionWords.some(w => first100.includes(w))) progressionCount++;
          }

          const score = Math.round((progressionCount / Math.max(sections.length, 1)) * 100);

          if (score < 40) issues.push(`Only ${score}% of sections have logical progression markers (Claude needs clear structure)`);
          if (score >= 70) strengths.push(`Clear logical progression in ${score}% of sections — Claude-friendly`);

          return { score, issues, strengths };
        }
      },
      {
        name: 'Depth Layering',
        weight: 0.25,
        check: (content) => {
          const issues: string[] = [];
          const strengths: string[] = [];
          const hasBeginner = /\b(beginner|basic|fundamental|introduction|getting started|overview|essentials)\b/i.test(content);
          const hasIntermediate = /\b(intermediate|advanced|deeper|beyond|next level|practical|implementation)\b/i.test(content);
          const hasExpert = /\b(expert|master|advanced|complex|enterprise|professional|specialized)\b/i.test(content);
          const layers = [hasBeginner, hasIntermediate, hasExpert].filter(Boolean).length;
          const score = Math.round((layers / 3) * 100);

          const missing = [];
          if (!hasBeginner) missing.push('Beginner');
          if (!hasIntermediate) missing.push('Intermediate');
          if (!hasExpert) missing.push('Expert');

          if (missing.length > 0) issues.push(`Missing depth layers: ${missing.join(', ')} (Claude values multi-level content)`);
          if (layers === 3) strengths.push('Complete beginner→intermediate→expert depth layering');

          return { score, issues, strengths };
        }
      },
      {
        name: 'Key Takeaway Blocks',
        weight: 0.20,
        check: (content) => {
          const issues: string[] = [];
          const strengths: string[] = [];
          const hasTakeaways = /\b(key takeaway|summary|in summary|to summarize|key point|important|notable|crucial|essential|critical point)\b/i.test(content);
          const score = hasTakeaways ? 100 : 30;

          if (!hasTakeaways) issues.push('No key takeaway blocks for Claude summary extraction');
          if (hasTakeaways) strengths.push('Key takeaway blocks present for Claude summary extraction');

          return { score, issues, strengths };
        }
      }
    ]
  }
];

export class GeoIntelligenceService {
  async analyze(content: string): Promise<GeoAnalysis> {
    const engineScores: GeoEngineScore[] = [];
    let overallWeightedScore = 0;
    let totalWeight = 0;

    for (const engine of AI_ENGINES) {
      let engineScore = 0;
      let engineWeight = 0;
      const allIssues: string[] = [];
      const allStrengths: string[] = [];

      for (const criterion of engine.criteria) {
        const result = criterion.check(content);
        engineScore += result.score * criterion.weight;
        engineWeight += criterion.weight;
        allIssues.push(...result.issues);
        allStrengths.push(...result.strengths);
      }

      const finalEngineScore = engineWeight > 0 ? Math.round(engineScore / engineWeight) : 0;
      engineScores.push({
        engine: engine.name,
        score: finalEngineScore,
        passing: finalEngineScore >= 60,
        issues: allIssues,
        strengths: allStrengths,
      });

      overallWeightedScore += finalEngineScore;
      totalWeight++;
    }

    const overallScore = totalWeight > 0 ? Math.round(overallWeightedScore / totalWeight) : 0;

    const words = content.split(/\s+/).length;
    const capitalizedWords = new Set(
      content.split(/\s+/).filter(w => /^[A-Z]/.test(w) && w.length > 2)
    );
    const entityDensity = words > 0 ? Math.round((capitalizedWords.size / words) * 1000) / 10 : 0;

    const sections = content.split(/^#{2,3}\s/m).filter(s => s.trim().length > 20);
    const definitionalSections = sections.filter(s => {
      const firstSentence = s.trim().split(/[.?!\n]/)[0].trim();
      return /^(is|are|refers to|encompasses|describes|means|involves|represents)/i.test(firstSentence);
    });
    const definitionFirstScore = Math.round((definitionalSections.length / Math.max(sections.length, 1)) * 100);

    const sentences = content.split(/[.?!]+/).filter(s => s.trim().length > 15);
    const citableSentences = sentences.filter(s => {
      const trimmed = s.trim();
      return /\b(is|are|was|were|has|have|had|found|shows|reveals|indicates|according|research|study|data)/i.test(trimmed) &&
        !(/\b(some|many|most|several)\b/i.test(trimmed) && !/\d/.test(trimmed));
    });
    const citationReadiness = Math.round((citableSentences.length / Math.max(sentences.length, 1)) * 100);

    const allSuggestions = engineScores
      .filter(e => !e.passing)
      .flatMap(e => e.issues.map(i => `[${e.engine}] ${i}`))
      .slice(0, 10);

    return {
      overallScore,
      overallPassing: overallScore >= 60,
      engines: engineScores,
      suggestions: allSuggestions,
      entityDensity,
      definitionFirstScore,
      citationReadiness,
    };
  }

  async improveContent(content: string): Promise<string> {
    const analysis = await this.analyze(content);
    if (analysis.overallPassing && analysis.suggestions.length === 0) {
      return content;
    }

    const improvementPrompt = [
      'You are a GEO (Generative Engine Optimization) specialist. Rewrite the following content to maximize its performance across AI search engines.',
      '',
      'Current GEO Analysis:',
      `- Overall Score: ${analysis.overallScore}/100`,
      '',
      ...analysis.engines.map(e =>
        `- ${e.engine}: ${e.score}/100 ${e.passing ? '(passing)' : '(needs improvement)'}` +
        (e.issues.length > 0 ? `\n  Issues: ${e.issues.join('; ')}` : '')
      ),
      '',
      'Rewrite Requirements:',
      '- Every H2/H3 section must start with a clear definition',
      '- Include statistical claims with context (for Perplexity citations)',
      '- Use consistent terminology throughout',
      '- Add key takeaway blocks at the end of major sections',
      '- Ensure each section provides standalone value',
      '- Include beginner→intermediate→expert depth layering',
      '- Add EEAT signals (experience, expertise, authority, trustworthiness)',
      '- Use Q&A format headings where appropriate',
      '- Keep sentences conversational (avg <20 words)',
      '',
      'Content to optimize:',
      content,
    ].join('\n');

    try {
      const contextWindow = content.length / CHARS_PER_TOKEN + improvementPrompt.length / CHARS_PER_TOKEN;
      const maxNewTokens = Math.min(4096, Math.max(1024, Math.round(content.length / CHARS_PER_TOKEN * 0.5)));

      const improved = await openaiService.chat([
        { role: 'system', content: 'You are a GEO content optimization specialist. Improve content for AI search engine visibility. Return only the improved content, no explanations.' },
        { role: 'user', content: improvementPrompt },
      ], { temperature: 0.4, maxTokens: maxNewTokens });
      if (improved && improved.length > content.length * 0.5) {
        return improved;
      }
      return content;
    } catch (err) {
      logger.warn('GEO improvement failed, returning original', { error: (err as Error).message });
      return content;
    }
  }
}

export const geoIntelligence = new GeoIntelligenceService();
export default geoIntelligence;
