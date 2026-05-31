// ──────────────────────────────────────────────
// AI Service - Multi-Provider Content & Image Generation
// Supports: OpenAI (default) and DeepSeek
// ──────────────────────────────────────────────

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { GeneratedArticle, GenerateBlogParams } from '../types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

type AIProvider = 'openai' | 'deepseek';

class OpenAIService {
  private openaiClient: OpenAI | null = null;
  private deepseekClient: OpenAI | null = null;
  private _provider: AIProvider = 'openai';
  public defaultModel: string = process.env.OPENAI_MODEL || 'gpt-4o';
  public maxTokens: number = parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10);
  public temperature: number = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');

  get isMockMode(): boolean {
    return !OPENAI_API_KEY && !DEEPSEEK_API_KEY;
  }

  get provider(): AIProvider {
    return this._provider;
  }

  setProvider(provider: AIProvider): void {
    this._provider = provider;
    logger.info(`AI provider set to: ${provider}`);
  }

  initialize(): void {
    const hasOpenAI = !!OPENAI_API_KEY;
    const hasDeepSeek = !!DEEPSEEK_API_KEY;

    if (!hasOpenAI && !hasDeepSeek) {
      logger.warn('No AI API keys set — operating in DEV MOCK mode with generated content');
      this.openaiClient = null;
      this.deepseekClient = null;
      return;
    }

    // Initialize OpenAI client
    if (hasOpenAI) {
      this.openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
      logger.info('OpenAI client initialized', { model: this.defaultModel });
    }

    // Initialize DeepSeek client (OpenAI-compatible)
    if (hasDeepSeek) {
      this.deepseekClient = new OpenAI({
        apiKey: DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
      });
      logger.info('DeepSeek client initialized', { model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash' });
    }

    // Auto-select DeepSeek if it's available and no OpenAI key
    if (!hasOpenAI && hasDeepSeek) {
      this._provider = 'deepseek';
      this.defaultModel = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    } else if (hasOpenAI && hasDeepSeek) {
      // Both available — check config for preferred provider (default: deepseek)
      const preferred = process.env.AI_PROVIDER || 'deepseek';
      this._provider = preferred === 'deepseek' ? 'deepseek' : 'openai';
      if (this._provider === 'deepseek') {
        this.defaultModel = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
      }
    }

    logger.info('AI service initialized', {
      provider: this._provider,
      model: this.defaultModel,
      hasOpenAI,
      hasDeepSeek
    });
  }

  /**
   * Get the active AI client based on current provider setting.
   */
  private getClient(): OpenAI | null {
    if (this._provider === 'deepseek' && this.deepseekClient) {
      return this.deepseekClient;
    }
    return this.openaiClient;
  }

  private ensureInitialized(): void {
    if (!this.getClient() && (OPENAI_API_KEY || DEEPSEEK_API_KEY)) {
      this.initialize();
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

    const systemPrompt = promptTemplate || this.defaultSystemPrompt({
      tone,
      avoidKeywords,
      ctaText: ctaText as string,
      ctaUrl: ctaUrl as string,
      minWords,
      maxWords
    });

    const userPrompt = `Generate a complete SEO-optimized blog post about: "${keyword}"

Requirements:
- Write in an ${tone} tone suitable for a maintenance/property care company
- Minimum ${minWords} words, maximum ${maxWords} words
- Structure: H2 main sections with H3 subsections where appropriate
- Include a compelling meta title (max 60 chars) and meta description (max 160 chars)
- Include 3-5 relevant tags
- Include an FAQ section with 3-5 questions and answers
- Include a natural Call-to-Action at the end
- Do NOT include any DIY repair instructions that could be dangerous
- Focus on: warning signs, educational content, and preventative maintenance
- Use E-E-A-T principles: demonstrate Experience, Expertise, Authoritativeness, Trustworthiness

Format your response as JSON with the following keys:
{
  "title": "The article title",
  "metaTitle": "SEO meta title (max 60 chars)",
  "metaDescription": "SEO meta description (max 160 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "faqSection": "## Frequently Asked Questions\\n\\n### Question 1?\\nAnswer 1...",
  "content": "The full article content in markdown"
}`;

    try {
      logger.info('Generating blog post via OpenAI', { keyword, model: this.defaultModel });

      const response = await this.getClient()!.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      const tokensIn = response.usage?.prompt_tokens || 0;
      const tokensOut = response.usage?.completion_tokens || 0;

      const result = JSON.parse(response.choices[0].message.content || '{}');

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

    const response = await this.getClient()!.chat.completions.create({
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

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  async generateKeywordVariations(seedKeyword: string, count: number = 10): Promise<string[]> {
    if (this.isMockMode) {
      return this.mockGenerateKeywordVariations(seedKeyword, count);
    }
    this.ensureInitialized();

    const response = await this.getClient()!.chat.completions.create({
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

    const result = JSON.parse(response.choices[0].message.content || '{}');
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
    // DeepSeek doesn't support image generation — return mock directly
    if (this.isMockMode || this._provider === 'deepseek') {
      logger.info(`${this.isMockMode ? 'Mock' : 'DeepSeek'}: Skipping image generation`);
      return {
        imageUrl: 'https://via.placeholder.com/1792x1024?text=' + encodeURIComponent(keyword),
        altText: `${keyword} professional maintenance service`,
        prompt: `Professional maintenance service image for ${keyword}`
      };
    }
    this.ensureInitialized();

    // First, generate an optimized image prompt
    const promptResponse = await this.getClient()!.chat.completions.create({
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

    const imagePrompt = promptResponse.choices[0].message.content?.trim() || `Professional maintenance service for ${keyword}`;

    // Generate the image (only supported via OpenAI's DALL-E)
    const imageResponse = await this.openaiClient!.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      style: 'vivid'
    });

    const imageData0 = imageResponse.data?.[0];
    const imageUrl = imageData0?.url;
    if (!imageUrl) {
      throw new Error('Image generation returned no URL');
    }

    // Generate SEO alt text
    const altResponse = await this.getClient()!.chat.completions.create({
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

    const altText = altResponse.choices[0].message.content?.trim().slice(0, 125) || `${keyword} professional maintenance service`;

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

    const response = await this.getClient()!.chat.completions.create({
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

    return (response.choices[0].message.content || '').replace(/^["']|["']$/g, '').trim();
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

    const response = await this.getClient()!.chat.completions.create({
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

    const result = JSON.parse(response.choices[0].message.content || '[]');
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

    const response = await this.getClient()!.chat.completions.create({
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

    return response.choices[0].message.content || content;
  }

  /**
   * Generate FAQ section for an article.
   */
  async generateFAQ(keyword: string, count: number = 4): Promise<string> {
    if (this.isMockMode) {
      return this.mockGenerateFAQ(keyword, count);
    }
    this.ensureInitialized();

    const response = await this.getClient()!.chat.completions.create({
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

    return response.choices[0].message.content || '';
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

    const response = await this.getClient()!.chat.completions.create({
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

    const result = JSON.parse(response.choices[0].message.content || '{}');
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

    const response = await this.getClient()!.chat.completions.create({
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

    return JSON.parse(response.choices[0].message.content || '{}');
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
      const response = await this.getClient()!.chat.completions.create({
        model: this.defaultModel,
        messages: messages as any[],
        max_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature ?? 0.7,
      });
      return response.choices[0].message.content || '';
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

    const content = this.buildMockArticleContent(keyword, tone, wordTarget);
    const wordCount = content.split(/\s+/).length;

    const title = `${keyword}: Essential Guide for Homeowners`.slice(0, 60);
    const faq = this.buildMockFAQSection(keyword, 4);
    const metaTitle = `${keyword}: Essential Guide for Homeowners`;
    const metaDescription = `Learn everything you need to know about ${keyword}. Expert tips, warning signs, and when to call a professional.`;

    return {
      title,
      content: content + '\n\n---\n\n' + faq,
      metaTitle: metaTitle.slice(0, 60),
      metaDescription: metaDescription.slice(0, 160),
      tags: [keyword, 'home maintenance', 'professional service', 'property care'],
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

  private buildMockArticleContent(keyword: string, tone: string, targetWords: number): string {
    const sections = [
      {
        heading: `Introduction`,
        body: `When it comes to maintaining your home, understanding ${keyword} is essential for every homeowner. Whether you're a new property owner or have years of experience, knowing the fundamentals can save you time, money, and stress. This comprehensive guide will walk you through everything you need to know about ${keyword}, including common warning signs, preventative measures, and when it's time to call in the professionals.`
      },
      {
        heading: `Understanding ${this.capitalize(keyword)}`,
        body: `${this.capitalize(keyword)} is a critical aspect of home maintenance that many homeowners overlook until problems arise. Regular attention to ${keyword} can prevent costly repairs down the line. In this section, we'll explore the key components and what every property owner should be aware of.`
      },
      {
        heading: `Common Warning Signs to Watch For`,
        body: `Being proactive about ${keyword} means knowing what to look for. Here are the most common warning signs that indicate you may need professional assistance:\n\n1. **Unusual sounds or odors** — If you notice strange noises or smells, it could indicate an underlying issue related to ${keyword}.\n2. **Visible wear and tear** — Regular inspections can help catch problems early.\n3. **Increased utility bills** — A sudden spike in your energy or water bills often signals inefficiency.\n4. **Age of your system** — Most systems have a lifespan of 10-15 years.\n5. **Inconsistent performance** — If things aren't working as well as they used to, it's time to investigate.`
      },
      {
        heading: `Preventative Maintenance Tips`,
        body: `Regular maintenance is the key to extending the life of your home's systems and avoiding emergency repairs. Here are practical tips every homeowner should follow:\n\n**Schedule annual inspections** — Having a professional inspect your ${keyword} related systems annually can catch minor issues before they become major problems.\n\n**Keep it clean** — Regular cleaning and upkeep can prevent many common issues. Follow manufacturer guidelines for best results.\n\n**Address small problems quickly** — Don't ignore minor issues. What starts as a small problem can quickly escalate into a costly repair.\n\n**Maintain proper documentation** — Keep records of all maintenance and repairs. This helps with warranty claims and provides valuable history for future service.`
      },
      {
        heading: `When to Call a Professional`,
        body: `While some maintenance tasks can be handled by homeowners, certain situations require professional expertise. Contact a qualified service provider if you encounter:\n\n- **Complex technical issues** that require specialized training\n- **Safety concerns** involving electrical, gas, or structural components\n- **Recurring problems** that don't resolve with basic maintenance\n- **System replacements** that require proper installation and permitting\n\nProfessional service providers have the training, tools, and experience to diagnose and resolve issues safely and effectively. They can also provide valuable advice on extending the life of your systems.`
      },
      {
        heading: `Cost Considerations`,
        body: `Understanding the costs associated with ${keyword} maintenance and repair can help you budget effectively. While preventative maintenance requires an upfront investment, it typically costs significantly less than major repairs or replacements. Many service providers offer maintenance plans that provide regular inspections at a discounted rate.\n\n**Factors affecting costs include:**\n- The complexity of the issue\n- Required parts and materials\n- Labor rates in your area\n- Whether it's a routine visit or emergency service\n\nAlways request a detailed quote before authorizing any work, and don't hesitate to ask questions about recommended services.`
      }
    ];

    // Build content with enough repetition to hit target word count
    let content = '';
    for (const section of sections) {
      content += `## ${section.heading}\n\n${section.body}\n\n`;
    }

    // Add extra content to reach target words
    const currentWords = content.split(/\s+/).length;
    if (currentWords < targetWords) {
      const extraSection = `## Additional Considerations\n\nWhen evaluating ${keyword} for your property, there are several additional factors to keep in mind. Every home is unique, and what works for one property may not be the best approach for another. Consulting with a qualified professional who can assess your specific situation is always the recommended course of action.\n\nRemember that investing in quality service and maintenance for ${keyword} pays dividends in the long run through improved efficiency, extended lifespan, and fewer emergency repairs. Your home is one of your most valuable assets, and proper care of ${keyword} is an essential part of protecting that investment.\n\nStay informed about the latest best practices for ${keyword} by following industry publications, attending home maintenance workshops, and building a relationship with trusted local service providers who understand your property's unique needs.\n\n`;
      content += extraSection;
    }

    return content;
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
    const keywordCount = (content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
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

export default new OpenAIService();
