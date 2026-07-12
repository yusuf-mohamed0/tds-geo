// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// AI Service - OpenAI Content & Image Generation
// ──────────────────────────────────────────────

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { countKeywordOccurrences } from '../utils/stringUtils';
import { GeneratedArticle, GenerateBlogParams } from '../types';
import { writingSystemPrompt, writingOutlinePrompt } from '../prompts';
import resilience from '../services/circuitBreaker';
import { crawlCompetitors } from './contentResearch';
import dataforseo from './dataforseo';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || '';
const HEADROOM_BASE_URL = process.env.HEADROOM_BASE_URL || '';

async function compressWithHeadroom(
  messages: any[],
  model: string
): Promise<{ messages: any[]; compressed: boolean }> {
  if (!HEADROOM_BASE_URL) return { messages, compressed: false };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${HEADROOM_BASE_URL}/v1/compress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { messages, compressed: false };

    const data: any = await res.json();
    return { messages: data.messages || messages, compressed: true };
  } catch {
    return { messages, compressed: false };
  }
}

class OpenAIService {
  private openaiClient: OpenAI | null = null;
  private fallbackClient: OpenAI | null = null;
  public defaultModel: string = process.env.OPENAI_MODEL || 'gpt-4o';
  public maxTokens: number = parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10);
  public temperature: number = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');

  get isMockMode(): boolean {
    return !OPENAI_API_KEY;
  }

  private extractJson(text: string): any {
    const trimmed = text.trim();
    // Try direct parse first
    try { return JSON.parse(trimmed); } catch {}
    // Try extracting JSON object (handles markdown code blocks or wrapped text)
    const objMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    // Try extracting JSON array
    const arrMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch {}
    }
    throw new Error(`Could not extract JSON from response: ${trimmed.slice(0, 200)}`);
  }

  get provider(): string {
    return 'openai';
  }

  initialize(): void {
    const fallbackKey = process.env.OPENAI_FALLBACK_KEY;

    if (!OPENAI_API_KEY) {
      if (fallbackKey) {
        this.openaiClient = new OpenAI({ apiKey: fallbackKey });
        this.fallbackClient = null;
        logger.info('OpenAI client initialized with fallback key (no primary)', { model: this.defaultModel });
        return;
      }
      logger.warn('No OpenAI API key set — operating in DEV MOCK mode with generated content');
      this.openaiClient = null;
      return;
    }

    this.openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
      ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
    });

    if (fallbackKey) {
      this.fallbackClient = new OpenAI({ apiKey: fallbackKey });
      logger.info('OpenAI fallback client initialized');
    }

    logger.info('OpenAI client initialized', { model: this.defaultModel, hasFallback: !!fallbackKey });
  }

  /**
   * Get the active AI client.
   * When a fallback client is configured, returns a wrapper that
   * transparently routes chat.completions.create through the fallback
   * if the primary client's call fails.
   * When HEADROOM_BASE_URL is set, messages are compressed before sending.
   */
  private clientWrapper: OpenAI | null = null;

  private createClientWrapper(clientToWrap: OpenAI): OpenAI {
    const primary = clientToWrap;
    const fallback = this.fallbackClient;

    return new Proxy(primary, {
      get(target, prop, receiver) {
        if (prop === 'chat') {
          const chat = Reflect.get(target, prop, receiver);
          return new Proxy(chat, {
            get(chatTarget, chatProp, chatReceiver) {
              if (chatProp === 'completions') {
                const completions = Reflect.get(chatTarget, chatProp, chatReceiver);
                const originalCreate = completions.create.bind(completions);
                return new Proxy(completions, {
                  get(compTarget, compProp, compReceiver) {
                    if (compProp === 'create') {
                      return async (...args: any[]) => {
                        const params = args[0] || {};
                        const { messages: compressedMessages } = await compressWithHeadroom(
                          params.messages || [],
                          params.model || ''
                        );
                        const compressedArgs = compressedMessages !== params.messages
                          ? [{ ...params, messages: compressedMessages }]
                          : args;

                        try {
                          return await (originalCreate as any)(...compressedArgs);
                        } catch (err) {
                          if (fallback) {
                            logger.warn('Primary OpenAI failed, retrying with fallback');
                            const fbArgs = compressedArgs;
                            return await (fallback.chat.completions.create as any)(...fbArgs);
                          }
                          throw err;
                        }
                      };
                    }
                    return Reflect.get(compTarget, compProp, compReceiver);
                  }
                });
              }
              return Reflect.get(chatTarget, chatProp, chatReceiver);
            }
          });
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }

  private getClient(): OpenAI | null {
    if (this.clientWrapper) return this.clientWrapper;
    if (!this.openaiClient) return null;

    this.clientWrapper = this.createClientWrapper(this.openaiClient);
    return this.clientWrapper;
  }

  private ensureInitialized(): void {
    if (!this.openaiClient && OPENAI_API_KEY) {
      this.initialize();
    }
  }

  async generateOutlinePhase(params: GenerateBlogParams): Promise<string> {
    this.ensureInitialized();
    const {
      keyword,
      clientSettings = {}
    } = params;

    const systemPrompt = writingOutlinePrompt({
      TOPIC: keyword,
      SITE_NAME: (clientSettings as any).siteName || process.env.SITE_NAME || 'Website',
      SITE_DESCRIPTION: (clientSettings as any).siteDescription || process.env.SITE_DESCRIPTION || '',
      CATEGORIES: (clientSettings as any).categories || '',
      DATE: new Date().toISOString().split('T')[0],
      YEAR: String(new Date().getFullYear()),
    });

    try {
      const response = await resilience.getCircuitBreaker().call(
        'openai-generate-outline',
        async () => {
          return this.getClient()!.chat.completions.create({
            model: this.defaultModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Develop a strategic outline and creative plan for the definitive article about: "${keyword}"` }
            ],
            max_tokens: 1500,
            temperature: 0.6
          });
        },
        async () => {
          logger.warn('OpenAI outline generation circuit open — proceeding without outline');
          return null;
        }
      );

      const content = response?.choices?.[0]?.message?.content;
      if (!content) {
        logger.info('Outline phase returned no content, proceeding without outline');
        return '';
      }

      const parsed = this.extractJson(content);
      logger.info('Outline phase complete', {
        keyword,
        creativeDna: parsed.creativeDna?.slice(0, 100),
        sections: parsed.outline?.length || 0,
        techniques: parsed.creativeTechniques?.length || 0,
        faq: parsed.faqQuestions?.length || 0,
      });

      return content;
    } catch (err) {
      logger.warn('Outline phase failed, proceeding without outline', {
        keyword,
        error: (err as Error).message,
      });
      return '';
    }
  }

  async generateBlogPost(params: GenerateBlogParams): Promise<GeneratedArticle> {
    if (this.isMockMode) {
      return this.mockGenerateBlogPost(params);
    }
    this.ensureInitialized();

    const {
      keyword,
      promptTemplate,
      tone = 'educational',
      minWords = parseInt(process.env.CONTENT_MIN_WORDS || '1200', 10),
      maxWords = parseInt(process.env.CONTENT_MAX_WORDS || '2500', 10),
      clientSettings = {}
    } = params;

    const avoidKeywords = process.env.AVOID_DIY_REPAIR_KEYWORDS || '';
    const ctaText = (clientSettings as any).ctaText || process.env.CTA_DEFAULT_TEXT;
    const ctaUrl = (clientSettings as any).ctaUrl || process.env.CTA_DEFAULT_URL;

    // Extract website intelligence from clientSettings if available
    const websiteIntelligence = (clientSettings as any).websiteIntelligence as string || '';
    const brandVoiceGuidance = (clientSettings as any).brandVoiceGuidance as string || '';

    const systemPrompt = promptTemplate || writingSystemPrompt({
      TOPIC: keyword,
      SITE_NAME: (clientSettings as any).siteName || process.env.SITE_NAME || 'Website',
      SITE_DESCRIPTION: (clientSettings as any).siteDescription || process.env.SITE_DESCRIPTION || '',
      CATEGORIES: (clientSettings as any).categories || '',
      DATE: new Date().toISOString().split('T')[0],
      YEAR: String(new Date().getFullYear()),
      GRAPHIFY_CONTEXT: (clientSettings as any).graphifyContext || '',
    });

    // Run the two-pass pipeline: strategic outline phase first
    const outlineJson = await this.generateOutlinePhase(params);
    let enrichedPrompt = `Generate a complete SEO-optimized blog post about: "${keyword}"\n\n`;

    // Inject strategic outline from phase one (guides structure, creative DNA, evidence)
    if (outlineJson) {
      enrichedPrompt += `## STRATEGIC OUTLINE (from planning phase — follow this plan)\n`;
      enrichedPrompt += `The following outline was developed during the strategic planning phase.\n`;
      enrichedPrompt += `Adhere to its creative DNA, structural outline, sourced statistics, and expert quotes.\n`;
      enrichedPrompt += `DO NOT deviate from the planned H2 structure or creative direction.\n\n`;
      enrichedPrompt += `${outlineJson}\n\n`;
    }

    // Inject competitor research for differentiation
    const competitors = await crawlCompetitors(keyword);
    if (competitors.length > 0) {
      enrichedPrompt += `## COMPETITOR CONTENT (for differentiation)\n`;
      enrichedPrompt += `Review these competitor articles. Identify gaps, missing angles, and opportunities they miss.\n`;
      enrichedPrompt += `DO NOT copy or paraphrase. Write something BETTER and DIFFERENT.\n\n`;
      for (const comp of competitors) {
        enrichedPrompt += `---\nURL: ${comp.url}\nTitle: ${comp.title}\n${comp.markdown.slice(0, 1500)}\n\n`;
      }
      enrichedPrompt += `\n`;
    }

    // Inject DataForSEO keyword research data
    try {
      if (dataforseo.isEnabled()) {
        const [volumeData, keywordIdeas] = await Promise.all([
          dataforseo.getKeywordVolume([keyword]).catch(() => null),
          dataforseo.discoverContentKeywords(keyword).catch(() => null),
        ]);

        if (volumeData?.[0]) {
          const v = volumeData[0];
          enrichedPrompt += `## KEYWORD RESEARCH DATA\n`;
          enrichedPrompt += `- Primary keyword: "${keyword}"\n`;
          enrichedPrompt += `- Monthly search volume: ${v.searchVolume.toLocaleString()}\n`;
          enrichedPrompt += `- CPC: $${v.cpc.toFixed(2)}\n`;
          enrichedPrompt += `- Competition level: ${v.competition < 0.3 ? 'Low' : v.competition < 0.7 ? 'Medium' : 'High'}\n`;
          if (v.monthlySearches.length > 0) {
            enrichedPrompt += `- Monthly trend: ${v.monthlySearches.map(m => `${m.month}/${m.year}: ${m.volume}`).join(', ')}\n`;
          }
          enrichedPrompt += `\n`;
        }

        if (keywordIdeas) {
          enrichedPrompt += `## RELATED KEYWORDS TO INCORPORATE\n`;
          if (keywordIdeas.primary.length > 0) {
            enrichedPrompt += `- Primary related: ${keywordIdeas.primary.slice(0, 8).join(', ')}\n`;
          }
          if (keywordIdeas.longTail.length > 0) {
            enrichedPrompt += `- Long-tail opportunities: ${keywordIdeas.longTail.slice(0, 8).join(', ')}\n`;
          }
          if (keywordIdeas.questions.length > 0) {
            enrichedPrompt += `- People also ask: ${keywordIdeas.questions.slice(0, 5).join(', ')}\n`;
          }
          enrichedPrompt += `- Use these naturally as H2/H3 subheadings\n\n`;
        }
      }
    } catch {
      // DataForSEO is best-effort; skip on failure
    }

    // Inject website-scraped intelligence if available
    if (websiteIntelligence) {
      enrichedPrompt += `## CLIENT CONTEXT (from website intelligence)\n${websiteIntelligence}\n\n`;
    }

    // Inject brand voice guidance if available
    if (brandVoiceGuidance) {
      enrichedPrompt += `## BRAND VOICE GUIDANCE\n${brandVoiceGuidance}\n\n`;
    }

    enrichedPrompt += `## CONTENT REQUIREMENTS\n`;
    enrichedPrompt += `- Write in an ${tone} tone\n`;
    enrichedPrompt += `- Minimum ${minWords} words, maximum ${maxWords} words\n`;
    enrichedPrompt += `- Structure: H2 main sections with H3 subsections where appropriate\n`;
    enrichedPrompt += `- Include a compelling meta title (max 60 chars) and meta description (max 160 chars)\n`;
    enrichedPrompt += `- Include 3-5 relevant tags\n`;
    enrichedPrompt += `- Include an FAQ section with 3-5 questions and answers\n`;
    enrichedPrompt += `- Include a natural Call-to-Action at the end\n`;

    // Add industry-specific instructions based on intelligence
    if (websiteIntelligence && websiteIntelligence.includes('Client Intelligence')) {
      enrichedPrompt += `- REFERENCE the specific services and value propositions listed in the Client Intelligence section\n`;
      enrichedPrompt += `- Use the key terms naturally throughout the article\n`;
      enrichedPrompt += `- Mirror the company's tone and voice as described\n`;
      enrichedPrompt += `- Tailor content for the target audience described\n`;
    } else {
      enrichedPrompt += `- NEVER include dangerous DIY repair instructions\n`;
      enrichedPrompt += `- Focus on: warning signs, educational content, and preventative maintenance\n`;
    }

    enrichedPrompt += `- Use E-E-A-T principles: demonstrate Experience, Expertise, Authoritativeness, Trustworthiness\n\n`;

    enrichedPrompt += `Format your response as JSON per the schema defined in the system prompt. The output must include: title, metaTitle (max 60), metaDescription (max 150), tags, categories, secondaryKeywords, entities, searchIntent, slug, content (full HTML), and a faqSection appended to content. Follow the system prompt's output format exactly.`;

    try {
      logger.info('Generating blog post via OpenAI', { keyword, model: this.defaultModel });

      const response = await resilience.getCircuitBreaker().call(
        'openai-generate-blog',
        async () => {
          return this.getClient()!.chat.completions.create({
            model: this.defaultModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: enrichedPrompt }
            ],
            max_tokens: this.maxTokens,
            temperature: this.temperature
          });
        },
        async () => {
          logger.error('OpenAI generate-blog circuit open');
          throw new Error('OpenAI circuit breaker open — unable to generate blog post');
        }
      );

      const tokensIn = response.usage?.prompt_tokens || 0;
      const tokensOut = response.usage?.completion_tokens || 0;

      const result = this.extractJson(response?.choices?.[0]?.message?.content || '{}');

      if (!result.title || !result.content) {
        throw new Error('OpenAI response missing required fields (title, content)');
      }

      if (result.faqSection) {
        result.content += '\n\n---\n\n' + result.faqSection;
      }

      logger.info('Blog post generated successfully', {
        keyword,
        title: result.title,
        words: result.content.split(/\s+/).length,
        tokensIn,
        tokensOut
      });

      return {
        title: result.title,
        content: result.content,
        metaTitle: result.metaTitle || result.title,
        metaDescription: result.metaDescription || '',
        tags: result.tags || [],
        faqSection: result.faqSection || '',
        metadata: {
          model: this.defaultModel,
          temperature: this.temperature,
          wordCount: result.content.split(/\s+/).length,
          tokensIn,
          tokensOut
        } as unknown as GeneratedArticle['metadata']
      };
    } catch (err) {
      logger.error('OpenAI blog post generation failed', {
        keyword,
        error: (err as Error).message,
        model: this.defaultModel
      });
      throw new Error(`Content generation failed for "${keyword}": ${(err as Error).message}`);
    }
  }

  async analyzeSEO(content: string, keyword: string): Promise<Record<string, unknown>> {
    if (this.isMockMode) {
      return this.mockAnalyzeSEO(content, keyword);
    }
    this.ensureInitialized();

    const response = await resilience.getCircuitBreaker().call(
      'openai-seo-analyze',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are an SEO expert. Analyze the given content for the target keyword "${keyword}".
Score the content from 0-100 and provide actionable improvements.
Respond in JSON format with keys: score, keywordDensity, suggestions[], headingStructure[], readabilityScore.`
            },
            {
              role: 'user',
              content: `Content:\n\n${content.slice(0, 8000)}`
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        });
      },
      async () => {
        logger.warn('OpenAI SEO analysis circuit open — returning empty result');
        return null;
      }
    );

    return JSON.parse(response?.choices[0]?.message?.content || '{}');
  }

  async generateKeywordVariations(seedKeyword: string, count: number = 10): Promise<string[]> {
    if (this.isMockMode) {
      return this.mockGenerateKeywordVariations(seedKeyword, count);
    }
    this.ensureInitialized();

    const response = await resilience.getCircuitBreaker().call(
      'openai-keyword-variations',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are an SEO keyword researcher. Generate ${count} related long-tail keyword variations for the given seed keyword.
Focus on: informational intent, question-based queries, and "near me" variations for local SEO.
Respond with a JSON array of strings only.`
            },
            {
              role: 'user',
              content: `Seed keyword: "${seedKeyword}"`
            }
          ],
          max_tokens: 1000,
          temperature: 0.5,
          response_format: { type: 'json_object' }
        });
      },
      async () => {
        logger.warn('OpenAI keyword variations circuit open — returning empty array');
        return null;
      }
    );

    const result = JSON.parse(response?.choices?.[0]?.message?.content || '{}');
    const keywords = Array.isArray(result) ? result : ((result as any).keywords || (result as any).variations || []);
    return keywords.slice(0, count);
  }

  /**
   * Generate an image prompt and then generate the image via DALL-E.
   */
  async generateArticleImage(
    articleTitle: string,
    keyword: string,
    tone: string = 'professional'
  ): Promise<{ imageUrl: string; altText: string; prompt: string }> {
    if (this.isMockMode) {
      logger.info('Mock: Skipping image generation');
      return {
        imageUrl: 'https://via.placeholder.com/1792x1024?text=' + encodeURIComponent(keyword),
        altText: `${keyword} professional maintenance service`,
        prompt: `Professional maintenance service image for ${keyword}`
      };
    }
    this.ensureInitialized();

    // First, generate an optimized image prompt
    const promptResponse = await resilience.getCircuitBreaker().call(
      'openai-image-prompt',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are an expert image prompt engineer for a maintenance/property care company.
Create a detailed DALL-E prompt for a blog article image that is:
- Professional and realistic
- Safe and appropriate for all audiences
- Shows preventative maintenance or professional service work
- NEVER shows dangerous situations or DIY repairs
- Style: clean, well-lit, professional photography

Respond ONLY with the prompt text, max 400 characters.`
            },
            {
              role: 'user',
              content: `Create an image prompt for a blog article titled: "${articleTitle}" about "${keyword}". Tone: ${tone}.`
            }
          ],
          max_tokens: 200,
          temperature: 0.7
        });
      },
      async () => {
        logger.warn('OpenAI image prompt circuit open — using fallback');
        return null;
      }
    );

    const imagePrompt = promptResponse?.choices?.[0]?.message?.content?.trim() || `Professional maintenance service for ${keyword}`;

    // Generate the image (only supported via OpenAI's DALL-E)
    const imageResponse = await resilience.getCircuitBreaker().call(
      'openai-image-generate',
      async () => {
        return this.openaiClient!.images.generate({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
          style: 'vivid'
        });
      },
      async () => {
        logger.error('OpenAI image generation circuit open');
        throw new Error('Image generation circuit breaker open');
      }
    );

    const imageData0 = imageResponse.data?.[0];
    const imageUrl = imageData0?.url;
    if (!imageUrl) {
      throw new Error('Image generation returned no URL');
    }

    // Generate SEO alt text
    const altResponse = await resilience.getCircuitBreaker().call(
      'openai-image-alt',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: 'You generate concise, SEO-optimized image alt text (max 125 characters). Respond with only the alt text.'
            },
            {
              role: 'user',
              content: `Generate alt text for a blog image about: ${articleTitle}. Keyword: ${keyword}`
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        });
      },
      async () => {
        logger.warn('OpenAI alt text circuit open — using fallback');
        return null;
      }
    );

    const altText = altResponse?.choices?.[0]?.message?.content?.trim().slice(0, 125) || `${keyword} professional maintenance service`;

    return { imageUrl, altText, prompt: imagePrompt };
  }

  // ══════════════════════════════════════════════
  // Staged Pipeline Methods
  // ══════════════════════════════════════════════

  /**
   * Generate just the article title.
   */
  async generateTitle(keyword: string, brandVoice?: string): Promise<string> {
    if (this.isMockMode) {
      return this.mockGenerateTitle(keyword, brandVoice);
    }
    this.ensureInitialized();

    const response = await resilience.getCircuitBreaker().call(
      'openai-generate-title',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are an SEO title expert for a maintenance company.
Generate a single compelling, click-worthy blog title for the given keyword.
Rules:
- Max 60 characters
- Include the primary keyword naturally
- Use numbers or power words where appropriate
- Sound professional and trustworthy
- NEVER make dangerous DIY promises
- Respond with ONLY the title text, no quotes or formatting`
            },
            {
              role: 'user',
              content: `Keyword: "${keyword}"${brandVoice ? `\nBrand voice: ${brandVoice}` : ''}`
            }
          ],
          max_tokens: 100,
          temperature: 0.7
        });
      },
      async () => {
        logger.warn('OpenAI title generation circuit open — using fallback title');
        return null;
      }
    );

    return (response?.choices?.[0]?.message?.content || keyword).replace(/^["']|["']$/g, '').trim();
  }

  /**
   * Generate a structured outline for the article.
   */
  async generateOutline(keyword: string, title: string, blacklistKeywords: string[] = []): Promise<string[]> {
    if (this.isMockMode) {
      return this.mockGenerateOutline(keyword, title, blacklistKeywords);
    }
    this.ensureInitialized();

    const blacklistStr = blacklistKeywords.length > 0
      ? `\nAVOID these topics: ${blacklistKeywords.join(', ')}`
      : '';

    const response = await resilience.getCircuitBreaker().call(
      'openai-generate-outline',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are a content strategist. Generate a detailed article outline with H2 headings.
Rules:
- Include 4-6 H2 sections
- Each H2 should be a distinct subtopic
- Prioritize educational content, warning signs, and preventative maintenance
- Avoid dangerous DIY instructions${blacklistStr}
- Respond with a JSON array of strings, e.g. ["Section 1", "Section 2"]`
            },
            {
              role: 'user',
              content: `Title: "${title}"\nKeyword: "${keyword}"`
            }
          ],
          max_tokens: 500,
          temperature: 0.5,
          response_format: { type: 'json_object' }
        });
      },
      async () => {
        logger.warn('OpenAI outline generation circuit open — returning empty array');
        return null;
      }
    );

    const result = JSON.parse(response?.choices?.[0]?.message?.content || '[]');
    return Array.isArray(result) ? result : (result.sections || result.outline || []);
  }

  /**
   * Enhance existing content for SEO.
   */
  async enhanceSEO(content: string, keyword: string): Promise<string> {
    if (this.isMockMode) {
      logger.info('Mock: enhanceSEO — passing through content unchanged');
      return content;
    }
    this.ensureInitialized();

    const response = await resilience.getCircuitBreaker().call(
      'openai-seo-enhance',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are an SEO content optimizer. Improve the given article for the target keyword "${keyword}".
Guidelines:
- Ensure the keyword appears naturally in H2 headings and first 100 words
- Improve heading structure (H2 for main sections, H3 for subsections)
- Add semantic keyword variations
- Maintain original meaning and length
- Keep the same tone and voice
- Do NOT add or remove factual claims
- Return the full improved article in markdown ONLY, no explanation`
            },
            {
              role: 'user',
              content: `Keyword: "${keyword}"\n\nContent:\n${content.slice(0, 10000)}`
            }
          ],
          max_tokens: this.maxTokens,
          temperature: 0.3
        });
      },
      async () => {
        logger.warn('OpenAI SEO enhance circuit open — returning original content');
        return null;
      }
    );

    return response?.choices?.[0]?.message?.content || content;
  }

  /**
   * Generate FAQ section for an article.
   */
  async generateFAQ(keyword: string, count: number = 4): Promise<string> {
    if (this.isMockMode) {
      return this.mockGenerateFAQ(keyword, count);
    }
    this.ensureInitialized();

    const response = await resilience.getCircuitBreaker().call(
      'openai-generate-faq',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are an FAQ content creator for a maintenance company.
Generate ${count} frequently asked questions and answers about the given topic.
Rules:
- Questions should be what customers actually search for
- Answers should be concise (2-4 sentences each)
- Include local SEO variations where appropriate
- Never give dangerous DIY instructions
- Respond with ONLY the FAQ section in markdown:

## Frequently Asked Questions

### Question 1?
Answer...`
            },
            {
              role: 'user',
              content: `Generate FAQs about: "${keyword}"`
            }
          ],
          max_tokens: 800,
          temperature: 0.5
        });
      },
      async () => {
        logger.warn('OpenAI FAQ generation circuit open — returning empty string');
        return null;
      }
    );

    return response?.choices?.[0]?.message?.content || '';
  }

  /**
   * Generate metadata (meta title + description) for an article.
   */
  async generateMetadata(title: string, content: string, keyword: string): Promise<{
    metaTitle: string;
    metaDescription: string;
  }> {
    if (this.isMockMode) {
      return this.mockGenerateMetadata(title, content, keyword);
    }
    this.ensureInitialized();

    const response = await resilience.getCircuitBreaker().call(
      'openai-generate-metadata',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are an SEO metadata specialist.
Generate meta title (max 60 chars) and meta description (max 160 chars) for the given article.
Respond ONLY with JSON: {"metaTitle": "...", "metaDescription": "..."}`
            },
            {
              role: 'user',
              content: `Title: "${title}"\nKeyword: "${keyword}"\nContent excerpt: ${content.slice(0, 500)}`
            }
          ],
          max_tokens: 200,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        });
      },
      async () => {
        logger.warn('OpenAI metadata generation circuit open — returning fallback');
        return null;
      }
    );

    const result = JSON.parse(response?.choices?.[0]?.message?.content || '{}');
    return {
      metaTitle: result.metaTitle || title,
      metaDescription: result.metaDescription || ''
    };
  }

  /**
   * Moderate content for safety issues.
   * Returns a safety assessment.
   */
  async moderateContent(content: string): Promise<{
    safe: boolean;
    flags: Array<{ category: string; severity: string; text: string }>;
    summary: string;
  }> {
    if (this.isMockMode) {
      logger.info('Mock: moderateContent — marking as safe');
      return { safe: true, flags: [], summary: 'Dev mock: content marked as safe' };
    }
    this.ensureInitialized();

    const response = await resilience.getCircuitBreaker().call(
      'openai-moderate-content',
      async () => {
        return this.getClient()!.chat.completions.create({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You are a content safety moderator for a home maintenance company.
Review the content and flag any:
- Dangerous DIY repair instructions (electrical, gas, plumbing, structural)
- Medical or health claims
- Legal liability issues
- Overpromises or guarantees
- Unsafe advice

Respond with JSON:
{
  "safe": true/false,
  "flags": [{"category": "string", "severity": "low|medium|high|critical", "text": "offending text"}],
  "summary": "brief summary of findings"
}`
            },
            {
              role: 'user',
              content: content.slice(0, 8000)
            }
          ],
          max_tokens: 500,
          temperature: 0.2,
          response_format: { type: 'json_object' }
        });
      },
      async () => {
        logger.warn('OpenAI moderate content circuit open — returning safe fallback');
        return null;
      }
    );

    const moderateResult = response?.choices?.[0]?.message?.content;
    if (!moderateResult) {
      return { safe: true, flags: [], summary: 'Circuit breaker fallback: content not moderated' };
    }
    return JSON.parse(moderateResult);
  }

  /**
   * Chat completion for conversational AI.
   * Used by the chat engine to provide natural, Buffy-like conversations.
   * Returns null in mock mode (no API key) so the engine falls back to rule-based.
   */
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string | null> {
    if (this.isMockMode) {
      return null;
    }
    this.ensureInitialized();

    try {
      const result = await resilience.getCircuitBreaker().call(
        'openai-chat',
        async () => {
          const response = await this.getClient()!.chat.completions.create({
            model: this.defaultModel,
            messages: messages as any[],
            max_tokens: options?.maxTokens || 1000,
            temperature: options?.temperature ?? 0.7,
          });
          return response.choices[0].message.content || '';
        },
        async () => {
          logger.warn('OpenAI chat circuit open — returning null');
          return '' as string;
        }
      );
      return result || null;
    } catch (err) {
      logger.error('AI chat completion failed', { error: (err as Error).message });
      return null;
    }
  }

  private defaultSystemPrompt({ tone, avoidKeywords, ctaText, ctaUrl, minWords, maxWords }: {
    tone: string;
    avoidKeywords: string;
    ctaText: string;
    ctaUrl: string;
    minWords: number;
    maxWords: number;
  }): string {
    return `You are a senior content writer for a professional maintenance and property care company.
Your writing follows Google's E-E-A-T guidelines for quality content.

CONTENT GUIDELINES:
- Tone: ${tone}, professional, and trustworthy
- Length: ${minWords}-${maxWords} words
- Structure: Use H2 for main sections, H3 for subsections
- Always include: introduction, body sections, FAQ, and a Call-to-Action
- NEVER include dangerous DIY repair instructions (avoid: ${avoidKeywords})

SEO REQUIREMENTS:
- Naturally incorporate the primary keyword in the first 100 words
- Use semantic variations of the keyword throughout
- Write compelling meta titles (under 60 chars) and meta descriptions (under 160 chars)

CALL TO ACTION:
- Natural placement near the end
- Text: "${ctaText}"
- URL: "${ctaUrl}"

FORMATTING:
- Write in Markdown
- Use bullet points and numbered lists where appropriate`;
  }

  // ══════════════════════════════════════════════
  // Mock mode implementations (no API key)
  // ══════════════════════════════════════════════

  private async mockGenerateBlogPost(params: GenerateBlogParams): Promise<GeneratedArticle> {
    const { keyword, tone = 'educational', minWords = 1200, maxWords = 2500 } = params;
    const wordTarget = Math.round((minWords + maxWords) / 2);

    logger.info('Mock: Generating blog post content', { keyword, wordTarget });

    // Generate a unique title based on the keyword's industry
    const industry = this.inferIndustry(keyword);
    const title = this.generateUniqueTitle(keyword, industry);

    // Build content tailored to the keyword's industry
    const content = this.buildMockArticleContent(keyword, industry, tone, wordTarget);
    const wordCount = content.split(/\s+/).length;

    const faq = this.buildMockFAQSection(keyword, 4);
    const metaTitle = title.slice(0, 60);
    const metaDescription = this.generateMetaDescription(keyword, industry).slice(0, 160);

    // Industry-relevant tags
    const tags = this.generateTags(keyword, industry);

    return {
      title,
      content: content + '\n\n---\n\n' + faq,
      metaTitle,
      metaDescription,
      tags,
      faqSection: faq,
      metadata: {
        model: 'mock-gpt-4o',
        temperature: 0.7,
        wordCount,
        tokensIn: 450,
        tokensOut: Math.round(wordCount * 1.5)
      } as unknown as GeneratedArticle['metadata']
    };
  }

  private inferIndustry(keyword: string): string {
    const kw = keyword.toLowerCase();
    if (kw.includes('account') || kw.includes('tax') || kw.includes('audit') || kw.includes('cpa') || kw.includes('bookkeeping') || kw.includes('financial')) return 'accounting';
    if (kw.includes('social media') || kw.includes('marketing') || kw.includes('brand') || kw.includes('advertis') || kw.includes('content')) return 'marketing';
    if (kw.includes('customer') || kw.includes('cx') || kw.includes('bpo') || kw.includes('call center') || kw.includes('outsourc')) return 'cx';
    if (kw.includes('digital') || kw.includes('web') || kw.includes('seo') || kw.includes('ecommerce') || kw.includes('it consulting')) return 'digital';
    if (kw.includes('pharma') || kw.includes('medicine') || kw.includes('drug') || kw.includes('healthcare') || kw.includes('gmp')) return 'pharma';
    if (kw.includes('vet') || kw.includes('veterinary') || kw.includes('pet') || kw.includes('animal') || kw.includes('dog') || kw.includes('cat')) return 'veterinary';
    if (kw.includes('architect') || kw.includes('interior') || kw.includes('design') || kw.includes('villa') || kw.includes('residential')) return 'architecture';
    if (kw.includes('sustainable') || kw.includes('business solution') || kw.includes('consulting') || kw.includes('infrastructure')) return 'consulting';
    if (kw.includes('graphic') || kw.includes('branding') || kw.includes('logo') || kw.includes('visual') || kw.includes('packaging')) return 'design';
    if (kw.includes('cosmetic') || kw.includes('makeup') || kw.includes('beauty') || kw.includes('skincare') || kw.includes('lipstick') || kw.includes('foundation')) return 'cosmetics';
    if (kw.includes('insurance') || kw.includes('broker') || kw.includes('coverage')) return 'insurance';
    if (kw.includes('laboratory') || kw.includes('lab') || kw.includes('scientific') || kw.includes('fume') || kw.includes('workstation')) return 'laboratory';
    if (kw.includes('fitness') || kw.includes('trainer') || kw.includes('workout') || kw.includes('nutrition') || kw.includes('weight loss') || kw.includes('gym')) return 'fitness';
    if (kw.includes('skincare') || kw.includes('beauty') || kw.includes('serum') || kw.includes('moisturizer') || kw.includes('organic')) return 'skincare';
    if (kw.includes('ui') || kw.includes('ux') || kw.includes('website') || kw.includes('responsive')) return 'webdesign';
    return 'general';
  }

  private generateUniqueTitle(keyword: string, industry: string): string {
    const kw = this.capitalize(keyword);
    const titles: Record<string, string[]> = {
      'accounting': [
        `${kw}: A Complete Guide for Business Owners`,
        `Expert ${kw} Tips for Your Business`,
        `Everything You Need to Know About ${kw}`,
        `${kw} Explained: A Business Owner's Handbook`,
        `The Ultimate Guide to ${kw} in 2026`,
      ],
      'marketing': [
        `${kw}: Strategies That Drive Results`,
        `How to Master ${kw} for Your Brand`,
        `The Complete ${kw} Playbook`,
        `${kw} Trends Every Business Should Know`,
        `Unlock Growth with ${kw}`,
      ],
      'cx': [
        `${kw}: Elevate Your Customer Experience`,
        `The Ultimate Guide to ${kw}`,
        `How ${kw} Transforms Your Business`,
        `${kw} Best Practices for 2026`,
        `Why ${kw} Matters for Your Brand`,
      ],
      'digital': [
        `${kw}: Transform Your Online Presence`,
        `The Complete ${kw} Guide`,
        `How ${kw} Drives Business Growth`,
        `Expert ${kw} Strategies for Success`,
        `${kw} Explained: A Practical Guide`,
      ],
      'pharma': [
        `${kw}: Quality Healthcare Solutions`,
        `Advancing Healthcare with ${kw}`,
        `The Essential Guide to ${kw}`,
        `${kw}: Commitment to Quality`,
        `Innovation in ${kw}: What You Need to Know`,
      ],
      'veterinary': [
        `${kw}: Caring for Your Beloved Pet`,
        `The Complete Guide to ${kw}`,
        `Essential ${kw} Tips for Pet Owners`,
        `Keep Your Pet Healthy with ${kw}`,
        `${kw}: A Pet Owner's Guide`,
      ],
      'architecture': [
        `${kw}: Designing Beautiful Spaces`,
        `The Art and Science of ${kw}`,
        `${kw}: Transform Your Property`,
        `Expert ${kw} Solutions for Your Home`,
        `A Complete Guide to ${kw}`,
      ],
      'consulting': [
        `${kw}: Building for the Future`,
        `Strategic ${kw} for Sustainable Growth`,
        `${kw}: Solutions That Make a Difference`,
        `The Expert Guide to ${kw}`,
        `How ${kw} Drives Success`,
      ],
      'design': [
        `${kw}: Bring Your Vision to Life`,
        `Creative ${kw} Solutions for Your Brand`,
        `The Art of ${kw}: A Complete Guide`,
        `${kw}: Make Your Brand Stand Out`,
        `Expert ${kw} Services You Can Trust`,
      ],
      'cosmetics': [
        `${kw}: Discover Your Perfect Look`,
        `The Ultimate ${kw} Guide`,
        `${kw}: Beauty That Empowers`,
        `Elevate Your Beauty Routine with ${kw}`,
        `${kw}: Quality You Can Trust`,
      ],
      'insurance': [
        `${kw}: Protect What Matters Most`,
        `The Complete Guide to ${kw}`,
        `${kw}: Smart Coverage for Your Needs`,
        `Understanding ${kw}: A Practical Guide`,
        `Expert ${kw} Advice You Can Rely On`,
      ],
      'laboratory': [
        `${kw}: Precision Solutions for Science`,
        `The Complete Guide to ${kw}`,
        `${kw}: Designing the Perfect Lab`,
        `Expert ${kw} Solutions for Research`,
        `${kw}: Quality You Can Measure`,
      ],
      'fitness': [
        `${kw}: Achieve Your Fitness Goals`,
        `Transform Your Health with ${kw}`,
        `${kw}: A Personal Journey to Wellness`,
        `The Complete ${kw} Program`,
        `Expert ${kw} Coaching for Results`,
      ],
      'skincare': [
        `${kw}: Radiant Skin Starts Here`,
        `The Ultimate ${kw} Routine`,
        `${kw}: Nourish Your Natural Beauty`,
        `Discover the Power of ${kw}`,
        `${kw}: Your Path to Glowing Skin`,
      ],
      'webdesign': [
        `${kw}: Create a Stunning Online Presence`,
        `The Complete Guide to ${kw}`,
        `${kw}: Design That Captivates`,
        `Expert ${kw} Solutions for Your Business`,
        `${kw}: Where Creativity Meets Function`,
      ],
      'general': [
        `${kw}: The Complete Guide`,
        `Everything You Need to Know About ${kw}`,
        `${kw}: Expert Tips and Insights`,
        `The Ultimate Resource for ${kw}`,
        `${kw}: A Comprehensive Overview`,
      ]
    };
    const industryTitles = titles[industry] || titles.general;
    return industryTitles[Math.floor(Math.random() * industryTitles.length)].slice(0, 60);
  }

  private generateMetaDescription(keyword: string, industry: string): string {
    const descriptions: Record<string, string> = {
      'accounting': `Expert ${keyword} services tailored for your business. Discover professional accounting solutions, tax tips, and financial strategies to help your business thrive.`,
      'marketing': `Boost your brand with professional ${keyword}. Learn proven strategies and expert tips to grow your online presence and reach your target audience effectively.`,
      'cx': `Enhance your customer experience with ${keyword}. Discover how professional CX solutions can transform your business and drive customer satisfaction.`,
      'digital': `Transform your business with comprehensive ${keyword}. Expert digital solutions to help you grow, innovate, and succeed in today's competitive landscape.`,
      'pharma': `Learn about ${keyword} and quality pharmaceutical solutions. Expert insights on healthcare products, manufacturing standards, and industry best practices.`,
      'veterinary': `Expert ${keyword} services for your beloved pets. Compassionate care, professional treatment, and essential health tips from trusted veterinarians.`,
      'architecture': `Professional ${keyword} services to transform your space. Expert architectural and interior design solutions tailored to your vision and needs.`,
      'consulting': `Strategic ${keyword} solutions for sustainable growth. Expert consulting services to help your organization achieve its goals and build a better future.`,
      'design': `Creative ${keyword} solutions that make your brand stand out. Professional design services to bring your vision to life and captivate your audience.`,
      'cosmetics': `Discover premium ${keyword} products. High-quality beauty solutions that celebrate your unique style and enhance your natural beauty.`,
      'insurance': `Comprehensive ${keyword} solutions tailored to your needs. Protect what matters most with expert guidance and reliable coverage options.`,
      'laboratory': `Professional ${keyword} solutions for scientific excellence. Quality laboratory furniture and design services for research and education.`,
      'fitness': `Achieve your fitness goals with expert ${keyword}. Personalized training programs and nutrition coaching to transform your health and wellness.`,
      'skincare': `Discover radiant beauty with premium ${keyword}. Quality skincare products designed to nourish, protect, and enhance your natural glow.`,
      'webdesign': `Create a stunning online presence with professional ${keyword}. Expert web design and UI/UX solutions that captivate and convert.`,
      'general': `Learn everything you need to know about ${keyword}. Expert tips, professional insights, and comprehensive guidance for your needs.`,
    };
    return descriptions[industry] || descriptions.general;
  }

  private generateTags(keyword: string, industry: string): string[] {
    const tagMap: Record<string, string[]> = {
      'accounting': ['accounting', 'tax services', 'financial consulting', 'business finance'],
      'marketing': ['digital marketing', 'social media', 'brand strategy', 'content marketing'],
      'cx': ['customer experience', 'BPO services', 'call center', 'customer support'],
      'digital': ['digital solutions', 'web development', 'SEO', 'digital transformation'],
      'pharma': ['pharmaceutical', 'healthcare', 'medicine', 'quality manufacturing'],
      'veterinary': ['veterinary care', 'pet health', 'animal hospital', 'pet wellness'],
      'architecture': ['architecture', 'interior design', 'home design', 'architectural services'],
      'consulting': ['business consulting', 'sustainable development', 'project management', 'strategy'],
      'design': ['graphic design', 'branding', 'creative design', 'visual identity'],
      'cosmetics': ['cosmetics', 'beauty products', 'makeup', 'skincare'],
      'insurance': ['insurance', 'brokerage', 'coverage', 'risk management'],
      'laboratory': ['laboratory furniture', 'lab design', 'scientific equipment', 'research'],
      'fitness': ['fitness training', 'personal trainer', 'workout', 'nutrition'],
      'skincare': ['skincare', 'beauty', 'natural products', 'skin health'],
      'webdesign': ['web design', 'UI UX', 'creative design', 'brand identity'],
      'general': [keyword, 'professional service', 'expert guide', 'quality solutions'],
    };
    const base = tagMap[industry] || tagMap.general;
    return [...new Set([keyword, ...base])].slice(0, 5);
  }

  private buildMockArticleContent(keyword: string, industry: string, tone: string, targetWords: number): string {
    const kw = this.capitalize(keyword);
    const industryContext = this.getIndustryContext(industry, keyword);

    const sections = [
      {
        heading: `Introduction`,
        body: `When it comes to ${industryContext.intro}, understanding ${kw} is essential for success. Whether you're a seasoned professional or just getting started, knowing the fundamentals can make all the difference. This comprehensive guide will walk you through everything you need to know about ${kw}, including key insights, best practices, and expert recommendations.`
      },
      {
        heading: `Understanding ${kw}`,
        body: `${kw} plays a vital role in ${industryContext.context}. ${industryContext.detail} In this section, we'll explore the key aspects and what you should know to make informed decisions.`
      },
      {
        heading: `Key Benefits and Advantages`,
        body: `Investing in quality ${kw} offers numerous benefits. Here are the most important advantages to consider:\n\n1. **Enhanced quality and reliability** — Professional ${industryContext.subject} ensures consistent, high-quality results.\n2. **Cost-effective solutions** — Proper ${kw} saves money in the long run by preventing issues.\n3. **Expert guidance** — Work with experienced professionals who understand your unique needs.\n4. **Peace of mind** — Know that your ${industryContext.subject} is in capable hands.\n5. **Long-term value** — Quality ${kw} delivers lasting results that protect your investment.`
      },
      {
        heading: `Best Practices to Follow`,
        body: `Following established best practices is key to getting the most out of ${kw}. Here are essential guidelines to keep in mind:\n\n**Work with qualified professionals** — Always choose experienced, reputable providers for your ${industryContext.subject} needs. Check credentials, read reviews, and ask for references.\n\n**Stay informed** — Keep up with the latest trends and developments in ${industryContext.context}. Knowledge is power when making decisions about ${kw}.\n\n**Plan ahead** — Proactive planning prevents problems. Regular ${industryContext.maintenance} helps avoid costly issues down the line.\n\n**Communicate clearly** — Clearly articulate your needs and expectations. Good communication ensures better outcomes and satisfaction.`
      },
      {
        heading: `How to Choose the Right Provider`,
        body: `Selecting the right ${industryContext.subject} provider is one of the most important decisions you'll make. Consider these factors:\n\n- **Experience and expertise** — Look for providers with a proven track record in ${kw}.\n- **Reputation** — Check reviews, testimonials, and references from past clients.\n- **Range of services** — Choose a provider that offers comprehensive solutions to meet all your needs.\n- **Pricing and value** — Compare quotes and understand what's included. The cheapest option isn't always the best value.\n- **Customer service** — Responsive, helpful support makes a significant difference in your experience.\n\nTake your time to evaluate options and don't hesitate to ask questions. The right partner will be transparent, communicative, and committed to your success.`
      },
      {
        heading: `Looking Ahead: Future Trends`,
        body: `The landscape of ${industryContext.context} is constantly evolving. Staying ahead of emerging trends ensures you're always getting the best possible ${industryContext.subject} solutions. Key trends to watch include:\n\n- **Technological innovation** — New tools and technologies are transforming how ${industryContext.subject} is delivered.\n- **Sustainability** — Environmentally conscious practices are becoming increasingly important.\n- **Personalization** — Tailored solutions that address specific needs are replacing one-size-fits-all approaches.\n- **Digital transformation** — Online platforms and digital tools are making ${industryContext.subject} more accessible than ever.\n\nPartner with a forward-thinking provider who embraces these trends and can help you navigate the future of ${kw}.`
      }
    ];

    let content = '';
    for (const section of sections) {
      content += `## ${section.heading}\n\n${section.body}\n\n`;
    }

    const currentWords = content.split(/\s+/).length;
    if (currentWords < targetWords) {
      content += `## Additional Insights\n\nWhen evaluating ${kw} for your needs, there are several additional factors to consider. Every situation is unique, and what works for one may not be the best approach for another. Consulting with a qualified professional who can assess your specific circumstances is always the recommended course of action.\n\nRemember that investing in quality ${industryContext.subject} pays dividends in the long run through improved outcomes, greater efficiency, and fewer challenges. Your ${industryContext.stakeholder} deserves the best possible care and attention, and ${kw} is an essential part of achieving that goal.\n\nStay informed about the latest developments in ${industryContext.context} by following industry publications, attending relevant events, and building relationships with trusted providers who understand your unique needs.\n\n`;
    }

    return content;
  }

  private getIndustryContext(industry: string, keyword?: string): { intro: string; context: string; detail: string; subject: string; maintenance: string; stakeholder: string } {
    const contexts: Record<string, { intro: string; context: string; detail: string; subject: string; maintenance: string; stakeholder: string }> = {
      'accounting': { intro: 'managing your business finances', context: 'financial management and business operations', detail: 'Professional financial services help businesses maintain accurate records, optimize tax strategies, and make informed decisions.', subject: 'financial services', maintenance: 'financial reviews', stakeholder: 'business' },
      'marketing': { intro: 'growing your brand online', context: 'digital marketing and brand building', detail: 'Effective marketing strategies help businesses connect with their target audience, build brand awareness, and drive measurable results.', subject: 'marketing services', maintenance: 'performance reviews', stakeholder: 'brand' },
      'cx': { intro: 'delivering exceptional customer experiences', context: 'customer experience and support services', detail: 'Outstanding customer experience is the cornerstone of business success, driving loyalty, satisfaction, and growth.', subject: 'CX solutions', maintenance: 'quality assessments', stakeholder: 'business' },
      'digital': { intro: 'navigating the digital landscape', context: 'digital solutions and technology services', detail: 'Comprehensive digital solutions help businesses leverage technology to improve operations, reach customers, and drive innovation.', subject: 'digital services', maintenance: 'system updates', stakeholder: 'organization' },
      'pharma': { intro: 'advancing healthcare and medicine', context: 'pharmaceutical manufacturing and healthcare', detail: 'Quality pharmaceutical manufacturing is essential for delivering safe, effective healthcare products to patients worldwide.', subject: 'pharmaceutical solutions', maintenance: 'quality controls', stakeholder: 'community' },
      'veterinary': { intro: 'caring for your beloved pets', context: 'veterinary medicine and pet care', detail: 'Compassionate veterinary care ensures your pets live healthy, happy lives with proper medical attention and preventive treatments.', subject: 'veterinary services', maintenance: 'health checkups', stakeholder: 'pet' },
      'architecture': { intro: 'designing beautiful and functional spaces', context: 'architecture and interior design', detail: 'Professional architectural and interior design services transform spaces into beautiful, functional environments that inspire and delight.', subject: 'design services', maintenance: 'design reviews', stakeholder: 'property' },
      'consulting': { intro: 'building sustainable solutions', context: 'business consulting and development', detail: 'Expert consulting services help organizations develop strategies, optimize operations, and achieve sustainable growth.', subject: 'consulting services', maintenance: 'strategy reviews', stakeholder: 'organization' },
      'design': { intro: 'creating compelling visual identities', context: 'creative design and branding', detail: 'Professional design services help businesses create memorable brand identities that resonate with their target audience.', subject: 'design solutions', maintenance: 'brand audits', stakeholder: 'brand' },
      'cosmetics': { intro: 'enhancing natural beauty', context: 'cosmetics and beauty products', detail: 'Premium cosmetics and beauty products help people express their unique style and enhance their natural features with confidence.', subject: 'beauty products', maintenance: 'product updates', stakeholder: 'customer' },
      'insurance': { intro: 'protecting what matters most', context: 'insurance and risk management', detail: 'Comprehensive insurance solutions provide peace of mind by protecting individuals and businesses against unexpected events.', subject: 'insurance coverage', maintenance: 'policy reviews', stakeholder: 'client' },
      'laboratory': { intro: 'equipping scientific excellence', context: 'laboratory equipment and design', detail: 'Quality laboratory furniture and design solutions create safe, efficient workspaces for scientific research and education.', subject: 'lab solutions', maintenance: 'equipment checks', stakeholder: 'institution' },
      'fitness': { intro: 'achieving your fitness goals', context: 'fitness training and wellness', detail: 'Personalized fitness training and nutrition coaching help individuals transform their health, build strength, and achieve lasting results.', subject: 'fitness programs', maintenance: 'progress assessments', stakeholder: 'client' },
      'skincare': { intro: 'nurturing radiant, healthy skin', context: 'skincare and beauty', detail: 'Premium skincare products nourish and protect your skin, helping you maintain a healthy, youthful glow with natural ingredients.', subject: 'skincare products', maintenance: 'routine updates', stakeholder: 'skin' },
      'webdesign': { intro: 'creating stunning digital experiences', context: 'web design and user experience', detail: 'Professional web design and UI/UX services create engaging digital experiences that captivate users and drive business results.', subject: 'design services', maintenance: 'design iterations', stakeholder: 'brand' },
      'general': { intro: `making the most of ${this.capitalize(keyword || 'your keyword')}`, context: `${keyword || 'your keyword'} and related services`, detail: `Professional ${keyword || 'your keyword'} services provide quality solutions tailored to your specific needs and requirements.`, subject: `${keyword || 'your keyword'} services`, maintenance: 'regular reviews', stakeholder: 'organization' },
    };
    return contexts[industry] || contexts.general;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private async mockGenerateTitle(keyword: string, brandVoice?: string): Promise<string> {
    const titles = [
      `The Complete Guide to ${this.capitalize(keyword)}`,
      `${this.capitalize(keyword)}: What Every Homeowner Needs to Know`,
      `Essential ${this.capitalize(keyword)} Tips for Property Owners`,
      `Your Ultimate Resource for ${this.capitalize(keyword)}`,
      `${this.capitalize(keyword)} Explained: A Homeowner's Handbook`
    ];
    const title = titles[Math.floor(Math.random() * titles.length)];
    logger.info('Mock: Generated title', { title, keyword });
    return title.slice(0, 60);
  }

  private async mockGenerateOutline(keyword: string, title: string, blacklistKeywords: string[] = []): Promise<string[]> {
    const outline = [
      'Introduction',
      `Understanding ${this.capitalize(keyword)}`,
      'Common Warning Signs to Watch For',
      'Preventative Maintenance Tips',
      'When to Call a Professional',
      'Cost Considerations'
    ];
    logger.info('Mock: Generated outline', { sections: outline.length, title });
    return outline;
  }

  private async mockGenerateFAQ(keyword: string, count: number = 4): Promise<string> {
    return this.buildMockFAQSection(keyword, count);
  }

  private buildMockFAQSection(keyword: string, count: number = 4): string {
    const faqs = [
      {
        q: `How often should I have my ${keyword} inspected?`,
        a: `We recommend having your ${keyword} inspected at least once a year. Regular inspections help identify potential issues early and can extend the life of your systems.`
      },
      {
        q: `What are the signs that I need professional help with ${keyword}?`,
        a: `Common signs include unusual noises, visible damage, increased utility costs, and inconsistent performance. If you notice any of these, it's best to contact a qualified professional.`
      },
      {
        q: `Can I handle ${keyword} maintenance myself?`,
        a: `While basic maintenance like cleaning and visual inspections can be done by homeowners, complex issues should always be handled by trained professionals to ensure safety and proper repairs.`
      },
      {
        q: `How much does professional ${keyword} service typically cost?`,
        a: `Costs vary depending on the scope of work, your location, and the specific services required. Most companies offer free estimates and can provide detailed pricing before starting any work.`
      },
      {
        q: `Is ${keyword} covered by home insurance?`,
        a: `Coverage depends on your specific policy and the nature of the issue. We recommend reviewing your insurance policy and consulting with your provider to understand what's covered.`
      }
    ];

    const selected = faqs.slice(0, count);
    let faqSection = '## Frequently Asked Questions\n\n';
    for (const faq of selected) {
      faqSection += `### ${faq.q}\n\n${faq.a}\n\n`;
    }
    return faqSection;
  }

  private async mockGenerateMetadata(title: string, content: string, keyword: string): Promise<{
    metaTitle: string;
    metaDescription: string;
  }> {
    return {
      metaTitle: `${keyword}: Essential Guide for Homeowners`.slice(0, 60),
      metaDescription: `Learn everything you need to know about ${keyword}. Expert tips, warning signs, and when to call a professional.`.slice(0, 160)
    };
  }

  private async mockAnalyzeSEO(content: string, keyword: string): Promise<Record<string, unknown>> {
    const wordCount = content.split(/\s+/).length;
    const keywordCount = countKeywordOccurrences(content, keyword);
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

    const score = Math.min(100, Math.max(40,
      60 +
      (density >= 0.5 && density <= 2.5 ? 15 : -10) +
      (wordCount >= 800 ? 10 : -10) +
      (content.includes('## ') ? 10 : -5) +
      (content.includes('**') || content.includes('*') ? 5 : 0)
    ));

    return {
      score: Math.round(score),
      keywordDensity: Math.round(density * 100) / 100,
      keywordCount,
      wordCount,
      readabilityScore: Math.round(Math.min(100, 65 + (wordCount > 1000 ? 15 : 0) + (content.includes('## ') ? 10 : 0))),
      suggestions: [
        'Consider adding more internal links to related content',
        'Include more semantic keyword variations throughout the text',
        'Add an FAQ section with schema markup for rich snippets'
      ],
      headingStructure: content.match(/##+\s+.+/g) || []
    };
  }

  private async mockGenerateKeywordVariations(seedKeyword: string, count: number = 10): Promise<string[]> {
    const prefixes = ['best', 'top', 'affordable', 'professional', 'emergency', 'residential', 'commercial', 'local'];
    const suffixes = ['near me', 'service', 'company', 'cost', 'guide', 'tips', 'reviews', 'professionals'];
    const keywords: string[] = [];

    keywords.push(seedKeyword);
    for (let i = 0; i < count - 1 && keywords.length < count; i++) {
      const p = prefixes[Math.floor(Math.random() * prefixes.length)];
      const s = suffixes[Math.floor(Math.random() * suffixes.length)];
      const variation = `${p} ${seedKeyword} ${s}`;
      if (!keywords.includes(variation)) {
        keywords.push(variation);
      }
    }

    return keywords.slice(0, count);
  }
}

// ─── AI Provider Router ───────────────────────
// When AI_PROVIDER=ollama, the default export from this
// module is the OllamaService instead of OpenAIService.
// This makes ALL consumers work without import changes.
import ollamaService from './ollama';
import type { AIService } from '../types';

const openaiSingleton = new OpenAIService();
const aiProvider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
const defaultService: AIService = aiProvider === 'ollama' ? ollamaService : openaiSingleton;
export default defaultService;
