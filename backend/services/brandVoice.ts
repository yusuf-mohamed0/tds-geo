// ══════════════════════════════════════════════════════════════════
// Brand Voice Memory System
// Persistent brand identity intelligence with embeddings + retrieval
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import openaiService from './openai';
import vectorMemory from './vectorMemory';
import { BrandVoiceProfile } from '../types';

interface BrandVoiceGuidance {
  toneInstructions: string;
  vocabularyNotes: string;
  audienceNotes: string;
  formattingNotes: string;
  ctaGuidance: string;
  forbiddenPhrases: string[];
  preferredTerminology: Record<string, string>;
  similarSnippets: string[];
}

class BrandVoiceService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Brand Voice Memory System initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // PROFILE MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async getProfile(clientId: string): Promise<BrandVoiceProfile | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM brand_voice_profiles WHERE client_id = $1',
      [clientId]
    );
    return result.rows[0] || null;
  }

  async createOrUpdateProfile(
    clientId: string,
    profile: Partial<BrandVoiceProfile>
  ): Promise<BrandVoiceProfile> {
    if (!this.pool) throw new Error('BrandVoiceService not initialized');

    const existing = await this.getProfile(clientId);

    if (existing) {
      const result = await this.pool.query(
        `UPDATE brand_voice_profiles SET
          tone_profile = COALESCE($2, tone_profile),
          vocabulary_profile = COALESCE($3, vocabulary_profile),
          audience_profile = COALESCE($4, audience_profile),
          formatting_preferences = COALESCE($5, formatting_preferences),
          cta_style = COALESCE($6, cta_style),
          forbidden_phrases = COALESCE($7, forbidden_phrases),
          preferred_terminology = COALESCE($8, preferred_terminology),
          sample_content = COALESCE($9, sample_content),
          sample_articles = COALESCE($10, sample_articles),
          metadata = COALESCE($11, metadata),
          updated_at = NOW()
         WHERE client_id = $1
         RETURNING *`,
        [
          clientId,
          JSON.stringify(profile.tone_profile || existing.tone_profile),
          JSON.stringify(profile.vocabulary_profile || existing.vocabulary_profile),
          JSON.stringify(profile.audience_profile || existing.audience_profile),
          JSON.stringify(profile.formatting_preferences || existing.formatting_preferences),
          profile.cta_style || existing.cta_style,
          profile.forbidden_phrases || existing.forbidden_phrases,
          JSON.stringify(profile.preferred_terminology || existing.preferred_terminology),
          profile.sample_content || existing.sample_content,
          profile.sample_articles || existing.sample_articles,
          JSON.stringify(profile.metadata || existing.metadata)
        ]
      );
      return result.rows[0];
    } else {
      const result = await this.pool.query(
        `INSERT INTO brand_voice_profiles
          (client_id, tone_profile, vocabulary_profile, audience_profile,
           formatting_preferences, cta_style, forbidden_phrases,
           preferred_terminology, sample_content, sample_articles, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          clientId,
          JSON.stringify(profile.tone_profile || {}),
          JSON.stringify(profile.vocabulary_profile || {}),
          JSON.stringify(profile.audience_profile || {}),
          JSON.stringify(profile.formatting_preferences || {}),
          profile.cta_style || 'direct',
          profile.forbidden_phrases || [],
          JSON.stringify(profile.preferred_terminology || {}),
          profile.sample_content || [],
          profile.sample_articles || [],
          JSON.stringify(profile.metadata || {})
        ]
      );
      return result.rows[0];
    }
  }

  // ══════════════════════════════════════════════════════════════
  // BRAND VOICE EMBEDDINGS
  // ══════════════════════════════════════════════════════════════

  async storeSampleEmbedding(
    clientId: string,
    contentSnippet: string,
    sourceType: string = 'article'
  ): Promise<void> {
    if (!this.pool) return;
    try {
      const embedding = await vectorMemory.generateEmbedding(contentSnippet);
      await this.pool.query(
        `INSERT INTO brand_voice_embeddings (client_id, content_snippet, embedding, source_type)
         VALUES ($1, $2, ($3)::vector, $4)`,
        [clientId, contentSnippet, JSON.stringify(embedding), sourceType]
      );
    } catch (err) {
      logger.warn('Failed to store brand voice embedding', { error: (err as Error).message });
    }
  }

  async findSimilarSnippets(clientId: string, content: string, limit: number = 3): Promise<string[]> {
    if (!this.pool) return [];
    try {
      const embedding = await vectorMemory.generateEmbedding(content);
      const result = await this.pool.query(
        `SELECT content_snippet,
                1 - (embedding <=> $2::vector) as similarity
         FROM brand_voice_embeddings
         WHERE client_id = $1
           AND 1 - (embedding <=> $2::vector) > 0.7
         ORDER BY similarity DESC
         LIMIT $3`,
        [clientId, JSON.stringify(embedding), limit]
      );
      return result.rows.map(r => r.content_snippet);
    } catch (err) {
      logger.warn('Brand voice similarity search failed', { error: (err as Error).message });
      return [];
    }
  }

  // ══════════════════════════════════════════════════════════════
  // WRITING FINGERPRINT & ANALYSIS
  // ══════════════════════════════════════════════════════════════

  async analyzeWritingFingerprint(clientId: string): Promise<{
    avgSentenceLength: number;
    vocabularyRichness: number;
    commonPhrases: string[];
    toneConsistency: number;
  }> {
    if (!this.pool) return { avgSentenceLength: 0, vocabularyRichness: 0, commonPhrases: [], toneConsistency: 0 };

    const profile = await this.getProfile(clientId);
    if (!profile || !profile.sample_content || profile.sample_content.length === 0) {
      return { avgSentenceLength: 0, vocabularyRichness: 0, commonPhrases: [], toneConsistency: 0 };
    }

    const allContent = profile.sample_content.join(' ');
    const sentences = allContent.split(/[.!?]+/).filter(s => s.trim());
    const words = allContent.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z]/g, '')).filter(w => w.length > 0));

    return {
      avgSentenceLength: sentences.length > 0 ? words.length / sentences.length : 0,
      vocabularyRichness: uniqueWords.size / Math.max(1, words.length),
      commonPhrases: [], // Would need n-gram analysis
      toneConsistency: 0.7 // Default estimate
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GENERATE CONTENT GUIDANCE
  // ══════════════════════════════════════════════════════════════

  async getContentGuidance(clientId: string): Promise<BrandVoiceGuidance> {
    const profile = await this.getProfile(clientId);
    const similarSnippets = await this.findSimilarSnippets(clientId, '', 5);

    if (!profile) {
      return {
        toneInstructions: 'Write in a professional, educational tone.',
        vocabularyNotes: 'Use industry-appropriate terminology.',
        audienceNotes: 'Write for property owners and decision-makers.',
        formattingNotes: 'Use clear heading structure with bullet points.',
        ctaGuidance: 'End with a clear call to action.',
        forbiddenPhrases: [],
        preferredTerminology: {},
        similarSnippets
      };
    }

    const tone = profile.tone_profile as any;
    const vocab = profile.vocabulary_profile as any;
    const audience = profile.audience_profile as any;
    const formatting = profile.formatting_preferences as any;

    return {
      toneInstructions: `Write in a ${tone.primary || 'professional'} tone with ${tone.secondary || 'educational'} undertones.
Formality level: ${(tone.formality || 0.7) * 100}%.
Enthusiasm level: ${(tone.enthusiasm || 0.5) * 100}%.
Empathy level: ${(tone.empathy || 0.6) * 100}%.`,
      vocabularyNotes: `Preferred industry jargon: ${(vocab.industry_jargon || []).join(', ') || 'Use standard industry terminology'}.
Power words to include: ${(vocab.power_words || []).join(', ') || 'Use compelling, action-oriented language'}.`,
      audienceNotes: `Target audience: ${JSON.stringify(audience.demographics || {})}.
Pain points to address: ${(audience.pain_points || []).join(', ')}.
Desires to fulfill: ${(audience.desires || []).join(', ')}.
Reading level: ${audience.reading_level || 'intermediate'}.`,
      formattingNotes: `Heading style: ${formatting.heading_style || 'sentence case'}.
Paragraph length: ${formatting.paragraph_length || 'medium'}.
Use bullet points: ${formatting.use_bullets !== false ? 'Yes' : 'No'}.
Use emphasis: ${formatting.use_emphasis !== false ? 'Yes' : 'No'}.`,
      ctaGuidance: profile.cta_style || 'Use a direct, clear call to action.',
      forbiddenPhrases: profile.forbidden_phrases || [],
      preferredTerminology: (profile.preferred_terminology as Record<string, string>) || {},
      similarSnippets
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GENERATION PROMPT BUILDER
  // ══════════════════════════════════════════════════════════════

  async buildBrandPrompt(clientId: string, basePrompt: string): Promise<string> {
    const guidance = await this.getContentGuidance(clientId);
    const forbiddenStr = guidance.forbiddenPhrases.length > 0
      ? `\n\nFORBIDDEN PHRASES (do not use these): ${guidance.forbiddenPhrases.join(', ')}`
      : '';
    const terminologyStr = Object.keys(guidance.preferredTerminology).length > 0
      ? `\n\nPREFERRED TERMINOLOGY (use these terms):\n${Object.entries(guidance.preferredTerminology)
          .map(([from, to]) => `- Use "${to}" instead of "${from}"`).join('\n')}`
      : '';
    const similarStr = guidance.similarSnippets.length > 0
      ? `\n\nREFERENCE STYLE (match this style):\n${guidance.similarSnippets.slice(0, 2).join('\n\n---\n\n')}`
      : '';

    return `${basePrompt}

BRAND VOICE GUIDELINES:
Tone: ${guidance.toneInstructions}
Vocabulary: ${guidance.vocabularyNotes}
Audience: ${guidance.audienceNotes}
Formatting: ${guidance.formattingNotes}
CTA: ${guidance.ctaGuidance}${forbiddenStr}${terminologyStr}${similarStr}`;
  }

  // ══════════════════════════════════════════════════════════════
  // CONSISTENCY CHECK
  // ══════════════════════════════════════════════════════════════

  async checkConsistency(clientId: string, content: string): Promise<{
    score: number;
    violations: string[];
    suggestions: string[];
  }> {
    const violations: string[] = [];
    const suggestions: string[] = [];
    const profile = await this.getProfile(clientId);

    if (!profile) {
      return { score: 100, violations: [], suggestions: ['Create a brand voice profile for better consistency checks'] };
    }

    // Check forbidden phrases
    for (const phrase of profile.forbidden_phrases || []) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        violations.push(`Contains forbidden phrase: "${phrase}"`);
        suggestions.push(`Replace "${phrase}" with an approved alternative`);
      }
    }

    // Check preferred terminology
    const terminology = profile.preferred_terminology as Record<string, string> || {};
    for (const [from, to] of Object.entries(terminology)) {
      if (content.toLowerCase().includes(from.toLowerCase())) {
        violations.push(`Uses discouraged term "${from}" — prefer "${to}"`);
        suggestions.push(`Replace "${from}" with "${to}"`);
      }
    }

    const score = violations.length === 0
      ? 100
      : Math.max(0, 100 - violations.length * 15);

    return { score, violations, suggestions };
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default new BrandVoiceService();
