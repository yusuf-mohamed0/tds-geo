// ──────────────────────────────────────────────
// Ollama Service — Local & Cloud AI Inference
// Mirrors OpenAIService interface for drop-in
// provider switching.
//
// Supports:
//   • Local Ollama (OLLAMA_BASE_URL, no key)
//   • Ollama Cloud (OLLAMA_BASE_URL + OLLAMA_API_KEY)
//   • Mock mode (no config)
// ──────────────────────────────────────────────

import { Ollama } from 'ollama';
import { logger } from '../utils/logger';
import { GeneratedArticle, GenerateBlogParams } from '../types';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || '';
const OLLAMA_API_KEY  = process.env.OLLAMA_API_KEY || '';

class OllamaService {
  private client: Ollama | null = null;
  public defaultModel: string = process.env.OLLAMA_MODEL || 'llama3.1:8b';
  public maxTokens: number = parseInt(process.env.OLLAMA_MAX_TOKENS || '4096', 10);
  public temperature: number = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7');

  /** True when neither a local base URL nor an API key are configured */
  get isMockMode(): boolean {
    return !OLLAMA_BASE_URL && !OLLAMA_API_KEY;
  }

  get provider(): string {
    return 'ollama';
  }

  /** Whether we are talking to a local (free) instance vs. Ollama Cloud */
  get isLocal(): boolean {
    return !!OLLAMA_BASE_URL && !OLLAMA_API_KEY;
  }

  initialize(): void {
    if (this.isMockMode) {
      logger.warn('No Ollama config found — operating in DEV MOCK mode');
      this.client = null;
      return;
    }

    const host = OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

    // If an API key is provided, attach it via custom fetch headers
    if (OLLAMA_API_KEY) {
      const originalFetch = globalThis.fetch;
      const client = new Ollama({
        host,
        fetch: async (input: any, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${OLLAMA_API_KEY}`);
          return originalFetch(input, { ...init, headers });
        },
      });
      this.client = client;
      logger.info('Ollama Cloud client initialized', {
        model: this.defaultModel,
        host,
      });
    } else {
      this.client = new Ollama({ host });
      logger.info('Ollama local client initialized', {
        model: this.defaultModel,
        host,
      });
    }
  }

  /** Ensure the underlying client is ready (idempotent) */
  private ensureInitialized(): void {
    if (!this.client && !this.isMockMode) {
      this.initialize();
    }
  }

  // ══════════════════════════════════════════════
  // CHAT COMPLETION (core building block)
  // ══════════════════════════════════════════════

  /**
   * Low-level chat completion against the configured Ollama model.
   * All higher-level methods build on this.
   */
  private async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      format?: 'json';
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
    if (this.isMockMode) {
      return { content: '{}', tokensIn: 0, tokensOut: 0 };
    }
    this.ensureInitialized();

    const response = await this.client!.chat({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ] as any,
      options: {
        num_predict: options?.maxTokens ?? this.maxTokens,
        temperature: options?.temperature ?? this.temperature,
      },
      ...(options?.format === 'json' ? { format: 'json' as any } : {}),
    });

    return {
      content: response.message.content,
      tokensIn: (response as any).prompt_eval_count || 0,
      tokensOut: (response as any).eval_count || 0,
    };
  }

  // ══════════════════════════════════════════════
  // CONTENT GENERATION
  // ══════════════════════════════════════════════

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
      clientSettings = {},
    } = params;

    const avoidKeywords = process.env.AVOID_DIY_REPAIR_KEYWORDS || '';
    const ctaText = (clientSettings as any).ctaText || process.env.CTA_DEFAULT_TEXT;
    const ctaUrl = (clientSettings as any).ctaUrl || process.env.CTA_DEFAULT_URL;
    const websiteIntelligence = (clientSettings as any).websiteIntelligence as string || '';
    const brandVoiceGuidance = (clientSettings as any).brandVoiceGuidance as string || '';

    const systemPrompt = promptTemplate || this.defaultSystemPrompt({
      tone, avoidKeywords,
      ctaText: ctaText as string,
      ctaUrl: ctaUrl as string,
      minWords, maxWords,
    });

    let userPrompt = `Generate a complete SEO-optimized blog post about: "${keyword}"\n\n`;
    if (websiteIntelligence) userPrompt += `## CLIENT CONTEXT\n${websiteIntelligence}\n\n`;
    if (brandVoiceGuidance) userPrompt += `## BRAND VOICE GUIDANCE\n${brandVoiceGuidance}\n\n`;
    userPrompt += `## CONTENT REQUIREMENTS\n- Tone: ${tone}\n- Min ${minWords} words, max ${maxWords} words\n- Structure: H2 sections with H3 subsections\n- Include meta title (≤60 chars) and meta description (≤160 chars)\n- Include 3-5 tags\n- Include FAQ section with 3-5 Q&A\n- Include natural CTA\n- Use E-E-A-T principles\n- NEVER include dangerous DIY repair instructions\n\nRespond as JSON:\n{\n  "title": "...",\n  "metaTitle": "...",\n  "metaDescription": "...",\n  "tags": [...],\n  "faqSection": "...",\n  "content": "..."\n}`;

    try {
      logger.info('Generating blog post via Ollama', { keyword, model: this.defaultModel });
      const { content: raw, tokensIn, tokensOut } = await this.chatCompletion(systemPrompt, userPrompt, { format: 'json' });
      const result = JSON.parse(raw);

      if (!result.title || !result.content) {
        throw new Error('Ollama response missing required fields (title, content)');
      }

      if (result.faqSection) {
        result.content += '\n\n---\n\n' + result.faqSection;
      }

      const wordCount = result.content.split(/\s+/).length;
      logger.info('Blog post generated via Ollama', {
        keyword,
        title: result.title,
        words: wordCount,
        tokensIn,
        tokensOut,
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
          wordCount,
          tokensIn,
          tokensOut,
        } as unknown as GeneratedArticle['metadata'],
      };
    } catch (err) {
      logger.error('Ollama blog post generation failed', {
        keyword,
        error: (err as Error).message,
        model: this.defaultModel,
      });
      throw new Error(`Content generation failed for "${keyword}": ${(err as Error).message}`);
    }
  }

  // ══════════════════════════════════════════════
  // SEO ANALYSIS
  // ══════════════════════════════════════════════

  async analyzeSEO(content: string, keyword: string): Promise<Record<string, unknown>> {
    if (this.isMockMode) return this.mockAnalyzeSEO(content, keyword);
    this.ensureInitialized();

    const systemPrompt = `You are an SEO expert. Analyze the given content for the target keyword "${keyword}".
Score 0-100 and provide improvements. Respond in JSON: { score, keywordDensity, suggestions[], headingStructure[], readabilityScore }`;

    const { content: raw } = await this.chatCompletion(systemPrompt, `Content:\n\n${content.slice(0, 8000)}`, {
      format: 'json',
      temperature: 0.3,
      maxTokens: 1500,
    });
    return JSON.parse(raw);
  }

  // ══════════════════════════════════════════════
  // KEYWORD VARIATIONS
  // ══════════════════════════════════════════════

  async generateKeywordVariations(seedKeyword: string, count: number = 10): Promise<string[]> {
    if (this.isMockMode) return this.mockGenerateKeywordVariations(seedKeyword, count);
    this.ensureInitialized();

    const systemPrompt = `You are an SEO keyword researcher. Generate ${count} related long-tail keyword variations.
Focus on informational intent, question queries, and "near me" variations. Respond as a JSON array of strings.`;

    const { content: raw } = await this.chatCompletion(systemPrompt, `Seed keyword: "${seedKeyword}"`, {
      format: 'json',
      temperature: 0.5,
      maxTokens: 1000,
    });

    const result = JSON.parse(raw);
    const keywords = Array.isArray(result) ? result : (result as any).keywords || (result as any).variations || [];
    return keywords.slice(0, count);
  }

  // ══════════════════════════════════════════════
  // IMAGE GENERATION (not supported via Ollama)
  // ══════════════════════════════════════════════

  async generateArticleImage(
    articleTitle: string,
    keyword: string,
    tone: string = 'professional'
  ): Promise<{ imageUrl: string; altText: string; prompt: string }> {
    logger.info('Ollama: Image generation not supported, returning placeholder');
    return {
      imageUrl: 'https://via.placeholder.com/1792x1024?text=' + encodeURIComponent(keyword),
      altText: `${keyword} professional service`,
      prompt: `Professional image for ${keyword}`,
    };
  }

  // ══════════════════════════════════════════════
  // STAGED PIPELINE METHODS
  // ══════════════════════════════════════════════

  async generateTitle(keyword: string, brandVoice?: string): Promise<string> {
    if (this.isMockMode) return this.mockGenerateTitle(keyword, brandVoice);
    this.ensureInitialized();

    const systemPrompt = `You are an SEO title expert. Generate a single compelling blog title.
Rules: max 60 chars, include keyword naturally, use power words where appropriate, never make dangerous DIY promises.
Respond with ONLY the title text, no quotes.`;

    const { content: raw } = await this.chatCompletion(systemPrompt, `Keyword: "${keyword}"${brandVoice ? `\nBrand voice: ${brandVoice}` : ''}`, {
      maxTokens: 100,
      temperature: 0.7,
    });
    return raw.replace(/^["']|["']$/g, '').trim().slice(0, 60);
  }

  async generateOutline(keyword: string, title: string, blacklistKeywords: string[] = []): Promise<string[]> {
    if (this.isMockMode) return this.mockGenerateOutline(keyword, title, blacklistKeywords);
    this.ensureInitialized();

    const blacklistStr = blacklistKeywords.length > 0
      ? `\nAVOID: ${blacklistKeywords.join(', ')}`
      : '';

    const systemPrompt = `You are a content strategist. Generate a detailed article outline with H2 headings.
Rules: 4-6 H2 sections, educational content, avoid dangerous DIY instructions${blacklistStr}
Respond as JSON array: ["Section 1", "Section 2"]`;

    const { content: raw } = await this.chatCompletion(systemPrompt, `Title: "${title}"\nKeyword: "${keyword}"`, {
      format: 'json',
      temperature: 0.5,
      maxTokens: 500,
    });

    const result = JSON.parse(raw);
    return Array.isArray(result) ? result : (result.sections || result.outline || []);
  }

  async enhanceSEO(content: string, keyword: string): Promise<string> {
    if (this.isMockMode) {
      logger.info('Mock: enhanceSEO — passing through unchanged');
      return content;
    }
    this.ensureInitialized();

    const systemPrompt = `You are an SEO content optimizer. Improve the article for keyword "${keyword}".
Ensure keyword appears in headings and first 100 words. Improve heading structure. Add semantic variations.
Maintain original meaning, tone, and length. Return full article in markdown ONLY, no explanation.`;

    const { content: enhanced } = await this.chatCompletion(systemPrompt, `Keyword: "${keyword}"\n\nContent:\n${content.slice(0, 10000)}`, {
      maxTokens: this.maxTokens,
      temperature: 0.3,
    });
    return enhanced;
  }

  async generateFAQ(keyword: string, count: number = 4): Promise<string> {
    if (this.isMockMode) return this.mockGenerateFAQ(keyword, count);
    this.ensureInitialized();

    const systemPrompt = `You are an FAQ content creator. Generate ${count} FAQs about the given topic.
Rules: questions should be real customer searches, answers concise (2-4 sentences), never give dangerous DIY instructions.
Respond with ONLY the FAQ section in markdown starting with "## Frequently Asked Questions"`;

    const { content: faqContent } = await this.chatCompletion(systemPrompt, `Generate FAQs about: "${keyword}"`, {
      maxTokens: 800,
      temperature: 0.5,
    });
    return faqContent;
  }

  async generateMetadata(title: string, content: string, keyword: string): Promise<{
    metaTitle: string;
    metaDescription: string;
  }> {
    if (this.isMockMode) return this.mockGenerateMetadata(title, content, keyword);
    this.ensureInitialized();

    const systemPrompt = `You are an SEO metadata specialist. Generate meta title (≤60 chars) and meta description (≤160 chars).
Respond ONLY with JSON: { "metaTitle": "...", "metaDescription": "..." }`;

    const { content: raw } = await this.chatCompletion(systemPrompt,
      `Title: "${title}"\nKeyword: "${keyword}"\nContent excerpt: ${content.slice(0, 500)}`,
      { format: 'json', temperature: 0.3, maxTokens: 200 }
    );

    const result = JSON.parse(raw);
    return {
      metaTitle: result.metaTitle || title,
      metaDescription: result.metaDescription || '',
    };
  }

  async moderateContent(content: string): Promise<{
    safe: boolean;
    flags: Array<{ category: string; severity: string; text: string }>;
    summary: string;
  }> {
    if (this.isMockMode) {
      return { safe: true, flags: [], summary: 'Mock: content marked as safe' };
    }
    this.ensureInitialized();

    const systemPrompt = `You are a content safety moderator. Review content and flag:
- Dangerous DIY instructions (electrical, gas, plumbing, structural)
- Medical or health claims
- Legal liability issues
- Overpromises or guarantees
- Unsafe advice

Respond with JSON: { "safe": boolean, "flags": [{ "category": string, "severity": "low|medium|high|critical", "text": string }], "summary": string }`;

    const { content: raw } = await this.chatCompletion(systemPrompt, content.slice(0, 8000), {
      format: 'json',
      temperature: 0.2,
      maxTokens: 500,
    });

    return JSON.parse(raw);
  }

  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string | null> {
    if (this.isMockMode) return null;
    this.ensureInitialized();

    try {
      const response = await this.client!.chat({
        model: this.defaultModel,
        messages: messages as any,
        options: {
          num_predict: options?.maxTokens ?? 1000,
          temperature: options?.temperature ?? 0.7,
        },
      });
      return response.message.content || '';
    } catch (err) {
      logger.error('Ollama chat completion failed', { error: (err as Error).message });
      return null;
    }
  }

  // ══════════════════════════════════════════════
  // SYSTEM PROMPT TEMPLATE
  // ══════════════════════════════════════════════

  private defaultSystemPrompt({ tone, avoidKeywords, ctaText, ctaUrl, minWords, maxWords }: {
    tone: string; avoidKeywords: string; ctaText: string; ctaUrl: string; minWords: number; maxWords: number;
  }): string {
    return `You are a senior content writer for a professional maintenance company.
Your writing follows Google's E-E-A-T guidelines.

CONTENT GUIDELINES:
- Tone: ${tone}, professional, trustworthy
- Length: ${minWords}-${maxWords} words
- Structure: H2 main sections, H3 subsections
- Include: intro, body, FAQ, CTA
- NEVER include dangerous DIY repair instructions (avoid: ${avoidKeywords})

SEO REQUIREMENTS:
- Include keyword in first 100 words
- Use semantic variations throughout
- Meta title ≤60 chars, meta description ≤160 chars

CALL TO ACTION:
- Natural placement near end
- Text: "${ctaText}"
- URL: "${ctaUrl}"

FORMATTING: Markdown, bullet points and lists where appropriate`;
  }

  // ══════════════════════════════════════════════
  // MOCK MODE IMPLEMENTATIONS
  // ══════════════════════════════════════════════

  private async mockGenerateBlogPost(params: GenerateBlogParams): Promise<GeneratedArticle> {
    const { keyword, tone = 'educational', minWords = 1200, maxWords = 2500 } = params;
    const wordTarget = Math.round((minWords + maxWords) / 2);
    logger.info('Mock: Generating blog post content', { keyword, wordTarget });

    const industry = this.inferIndustry(keyword);
    const title = this.capitalize(keyword) + ': The Complete Guide';
    const content = `# ${title}\n\nThis is a mock article about ${keyword}. Generated in dev mock mode.\n\n`.repeat(Math.ceil(wordTarget / 20));
    const faq = this.buildMockFAQSection(keyword, 4);

    return {
      title: title.slice(0, 60),
      content: content + '\n\n---\n\n' + faq,
      metaTitle: title.slice(0, 60),
      metaDescription: `Learn everything about ${keyword}. Expert tips and insights.`.slice(0, 160),
      tags: [keyword, 'professional service', 'expert guide'],
      faqSection: faq,
      metadata: { model: 'mock-llama', temperature: 0.7, wordCount: wordTarget } as any,
    };
  }

  private async mockGenerateTitle(keyword: string, _brandVoice?: string): Promise<string> {
    return `${this.capitalize(keyword)}: The Complete Guide for Homeowners`.slice(0, 60);
  }

  private async mockGenerateOutline(_keyword: string, _title: string, _blacklist: string[] = []): Promise<string[]> {
    return ['Introduction', 'Understanding', 'Key Benefits', 'Best Practices', 'When to Call a Professional'];
  }

  private async mockGenerateFAQ(keyword: string, count: number = 4): Promise<string> {
    return this.buildMockFAQSection(keyword, count);
  }

  private buildMockFAQSection(keyword: string, count: number = 4): string {
    const faqs = [
      { q: `How often should I have my ${keyword} inspected?`, a: `We recommend annual inspections to identify issues early.` },
      { q: `What are signs I need professional ${keyword} help?`, a: `Unusual noises, visible damage, or increased costs. Contact a pro.` },
      { q: `Can I handle ${keyword} maintenance myself?`, a: `Basic cleaning is OK; complex issues need a trained professional.` },
      { q: `How much does ${keyword} service cost?`, a: `Varies by scope. Most companies offer free estimates.` },
      { q: `Is ${keyword} covered by insurance?`, a: `Depends on your policy. Check with your provider.` },
    ];
    let section = '## Frequently Asked Questions\n\n';
    for (const f of faqs.slice(0, count)) {
      section += `### ${f.q}\n\n${f.a}\n\n`;
    }
    return section;
  }

  private async mockGenerateMetadata(_title: string, _content: string, _keyword: string): Promise<{ metaTitle: string; metaDescription: string }> {
    return { metaTitle: 'Mock Title', metaDescription: 'Mock description for dev mode.' };
  }

  private mockAnalyzeSEO(content: string, keyword: string): Record<string, unknown> {
    const wordCount = content.split(/\s+/).length;
    const keywordCount = (content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
    return {
      score: 75,
      keywordDensity: wordCount > 0 ? Math.round((keywordCount / wordCount) * 10000) / 100 : 0,
      keywordCount,
      wordCount,
      readabilityScore: 70,
      suggestions: ['Add internal links', 'Include more semantic variations', 'Add FAQ schema'],
      headingStructure: content.match(/##+\s+.+/g) || [],
    };
  }

  private async mockGenerateKeywordVariations(seedKeyword: string, count: number = 10): Promise<string[]> {
    const prefixes = ['best', 'top', 'affordable', 'professional', 'emergency', 'local'];
    const suffixes = ['near me', 'service', 'cost', 'guide', 'tips', 'professionals'];
    const keywords: string[] = [seedKeyword];
    for (let i = 0; i < count - 1 && keywords.length < count; i++) {
      const p = prefixes[Math.floor(Math.random() * prefixes.length)];
      const s = suffixes[Math.floor(Math.random() * suffixes.length)];
      const v = `${p} ${seedKeyword} ${s}`;
      if (!keywords.includes(v)) keywords.push(v);
    }
    return keywords.slice(0, count);
  }

  private inferIndustry(keyword: string): string {
    const kw = keyword.toLowerCase();
    if (kw.includes('plumb') || kw.includes('pipe')) return 'plumbing';
    if (kw.includes('electr')) return 'electrical';
    if (kw.includes('hvac') || kw.includes('heat') || kw.includes('cool')) return 'hvac';
    return 'general';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default new OllamaService();
