// ══════════════════════════════════════════════════════════════════
// Client Website Intelligence Service
// Orchestrates Scrapling-based website scanning, stores results,
// and provides condensed intelligence for hyper-personalized
// article generation.
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { WebsiteIntelligence, ClientIntelligencePrompt } from '../types';

class ClientScraperService {
  private pool: Pool | null = null;
  private scraperScriptPath: string = '';

  /**
   * Initialize the scraper service.
   */
  initialize(pool: Pool): void {
    this.pool = pool;

    // Resolve path to the Python scraper script
    const possiblePaths = [
      path.resolve(__dirname, '../../scripts/scraper/scrape_client.py'),
      path.resolve(__dirname, '../../../scripts/scraper/scrape_client.py'),
      '/root/my-project/scripts/scraper/scrape_client.py',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.scraperScriptPath = p;
        break;
      }
    }

    if (this.scraperScriptPath) {
      logger.info('ClientScraperService initialized', { scriptPath: this.scraperScriptPath });
    } else {
      logger.warn('ClientScraperService initialized but scraper script not found');
    }
  }

  /**
   * Check if Scrapling (Python) is available.
   */
  get isAvailable(): boolean {
    try {
      execSync('python -c "import scrapling" 2>/dev/null', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scan a client's website and return the intelligence data.
   *
   * Runs the Python Scrapling script and parses the JSON output.
   * Falls back to basic HTTP intelligence if Scrapling is not available.
   *
   * @param url The client's website URL
   * @param clientId Optional client ID to store results in DB
   */
  async scanWebsite(url: string, clientId?: string): Promise<WebsiteIntelligence> {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

    logger.info('Scanning client website', { url: normalizedUrl, clientId });

    if (this.isAvailable && this.scraperScriptPath) {
      return this.scanWithScrapling(normalizedUrl, clientId);
    }

    // Fallback: basic intelligence without Scrapling
    logger.warn('Scrapling not available — using fallback scanner', { url: normalizedUrl });
    return this.fallbackScan(normalizedUrl, clientId);
  }

  /**
   * Scan a website using the Python Scrapling script.
   */
  private async scanWithScrapling(url: string, clientId?: string): Promise<WebsiteIntelligence> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const pythonProcess = spawn('python', [
        this.scraperScriptPath,
        url,
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000, // 60 second timeout
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code: number | null) => {
        const duration = Date.now() - startTime;
        logger.info('Scrapling process completed', { url, code, durationMs: duration });

        if (stderr) {
          // Scrapling writes status to stderr, which is fine
          logger.debug('Scrapling stderr', { stderr: stderr.slice(0, 500) });
        }

        if (code === 0 && stdout) {
          try {
            const data = JSON.parse(stdout);
            const intelligence = this.normalizeIntelligence(data, url, clientId);
            this.storeIntelligence(intelligence, clientId).catch(err => {
              logger.warn('Failed to store intelligence', { error: (err as Error).message });
            });
            resolve(intelligence);
          } catch (err) {
            logger.error('Failed to parse Scrapling output', {
              error: (err as Error).message,
              stdout: stdout.slice(0, 300),
            });
            reject(new Error(`Failed to parse scraper output: ${(err as Error).message}`));
          }
        } else {
          reject(new Error(`Scrapling exited with code ${code}: ${stderr.slice(0, 300)}`));
        }
      });

      pythonProcess.on('error', (err: Error) => {
        reject(new Error(`Failed to start Scrapling: ${err.message}`));
      });
    });
  }

  /**
   * Fallback scanner when Scrapling is not available.
   * Uses basic HTTP requests and regex parsing.
   */
  private async fallbackScan(url: string, clientId?: string): Promise<WebsiteIntelligence> {
    const basicIntelligence: WebsiteIntelligence = {
      id: '',
      client_id: clientId || '',
      url,
      pages_scanned: 0,
      pages_found: [],
      site_name: url.replace(/https?:\/\//, '').split('.')[0],
      description: '',
      meta_keywords: [],
      services: [],
      industries: [],
      target_audience: [],
      unique_selling_points: [],
      tone_analysis: {
        primary_tone: 'professional',
        secondary_tone: 'educational',
        tone_scores: { professional: 1 },
        formality_estimate: 0.7,
      },
      common_terms: [],
      cta_patterns: [],
      page_structure: { h1: [], h2: [], h3: [] },
      contact_info: { email: [], phone: [], address: [] },
      social_links: [],
      tech_stack_hints: [],
      content_gaps: [],
      raw_data: {},
      scraped_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Try to fetch homepage for basic info
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Vireon/1.0)',
        },
      });

      if (response.ok) {
        const html = await response.text();
        basicIntelligence.pages_scanned = 1;
        basicIntelligence.pages_found = ['/'];

        // Extract basic info from HTML
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) basicIntelligence.site_name = titleMatch[1].trim();

        const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        if (descMatch) basicIntelligence.description = descMatch[1].trim();

        const kwMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
        if (kwMatch) basicIntelligence.meta_keywords = kwMatch[1].split(',').map(k => k.trim());

        // Tech stack detection
        if (html.includes('/wp-content/')) basicIntelligence.tech_stack_hints.push('WordPress');
        if (html.includes('/_next/')) basicIntelligence.tech_stack_hints.push('Next.js');
        if (html.includes('cdn.shopify.com')) basicIntelligence.tech_stack_hints.push('Shopify');
        if (html.includes('webflow')) basicIntelligence.tech_stack_hints.push('Webflow');
      }
    } catch (err) {
      logger.warn('Fallback scan HTTP failed', { url, error: (err as Error).message });
    }

    // Store in DB if clientId is provided
    if (clientId) {
      await this.storeIntelligence(basicIntelligence, clientId).catch(err => {
        logger.warn('Failed to store fallback intelligence', { error: (err as Error).message });
      });
    }

    return basicIntelligence;
  }

  /**
   * Normalize raw scraper data into our standard WebsiteIntelligence format.
   */
  private normalizeIntelligence(
    data: Record<string, unknown>,
    url: string,
    clientId?: string
  ): WebsiteIntelligence {
    const defaultToneAnalysis = {
      primary_tone: 'professional' as const,
      secondary_tone: 'educational' as const,
      tone_scores: {} as Record<string, number>,
      formality_estimate: 0.7,
    };

    const now = new Date();

    return {
      id: '',
      client_id: clientId || '',
      url,
      domain: (data.domain as string) || '',
      pages_scanned: (data.pages_scanned as number) || 0,
      pages_found: (data.pages_found as string[]) || [],
      site_name: (data.site_name as string) || '',
      description: (data.description as string) || '',
      meta_keywords: (data.keywords_meta as string[]) || [],
      services: (data.services as Array<{ name: string; description?: string; page?: string }>) || [],
      industries: (data.industries as string[]) || [],
      target_audience: (data.target_audience as string[]) || [],
      unique_selling_points: (data.unique_selling_points as string[]) || [],
      tone_analysis: { ...defaultToneAnalysis, ...(data.tone_analysis as Record<string, unknown> || {}) } as WebsiteIntelligence['tone_analysis'],
      common_terms: (data.common_terms as string[]) || [],
      cta_patterns: (data.cta_patterns as Array<{ text: string; url?: string; page?: string }>) || [],
      page_structure: (data.page_structure as WebsiteIntelligence['page_structure']) || { h1: [], h2: [], h3: [] },
      contact_info: this.normalizeContactInfo(data.contact_info as Record<string, unknown>),
      social_links: (data.social_links as Array<{ platform: string; url: string }>) || [],
      tech_stack_hints: (data.tech_stack_hints as string[]) || [],
      content_gaps: (data.content_gaps as string[]) || [],
      raw_data: (data.raw_data as Record<string, unknown>) || data,
      scraped_at: now,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Normalize contact info with type safety.
   */
  private normalizeContactInfo(raw: Record<string, unknown> | undefined): WebsiteIntelligence['contact_info'] {
    return {
      email: Array.isArray(raw?.email) ? raw.email as string[] : [],
      phone: Array.isArray(raw?.phone) ? raw.phone as string[] : [],
      address: Array.isArray(raw?.address) ? raw.address as string[] : [],
    };
  }

  /**
   * Store intelligence in the database (upsert by client_id).
   */
  private async storeIntelligence(
    intelligence: WebsiteIntelligence,
    clientId?: string
  ): Promise<void> {
    if (!this.pool || !clientId) return;

    try {
      await this.pool.query(
        `INSERT INTO website_intelligence (
          client_id, url, domain, pages_scanned, pages_found,
          site_name, description, meta_keywords,
          services, industries, target_audience, unique_selling_points,
          tone_analysis, common_terms, cta_patterns, page_structure,
          contact_info, social_links, tech_stack_hints, content_gaps,
          raw_data, scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (client_id) DO UPDATE SET
          url = EXCLUDED.url,
          domain = EXCLUDED.domain,
          pages_scanned = EXCLUDED.pages_scanned,
          pages_found = EXCLUDED.pages_found,
          site_name = EXCLUDED.site_name,
          description = EXCLUDED.description,
          meta_keywords = EXCLUDED.meta_keywords,
          services = EXCLUDED.services,
          industries = EXCLUDED.industries,
          target_audience = EXCLUDED.target_audience,
          unique_selling_points = EXCLUDED.unique_selling_points,
          tone_analysis = EXCLUDED.tone_analysis,
          common_terms = EXCLUDED.common_terms,
          cta_patterns = EXCLUDED.cta_patterns,
          page_structure = EXCLUDED.page_structure,
          contact_info = EXCLUDED.contact_info,
          social_links = EXCLUDED.social_links,
          tech_stack_hints = EXCLUDED.tech_stack_hints,
          content_gaps = EXCLUDED.content_gaps,
          raw_data = EXCLUDED.raw_data,
          scraped_at = EXCLUDED.scraped_at,
          is_stale = false,
          updated_at = NOW()`,
        [
          clientId, intelligence.url, intelligence.domain, intelligence.pages_scanned,
          intelligence.pages_found, intelligence.site_name, intelligence.description,
          intelligence.meta_keywords,
          JSON.stringify(intelligence.services),
          intelligence.industries,
          intelligence.target_audience,
          intelligence.unique_selling_points,
          JSON.stringify(intelligence.tone_analysis),
          intelligence.common_terms,
          JSON.stringify(intelligence.cta_patterns),
          JSON.stringify(intelligence.page_structure),
          JSON.stringify(intelligence.contact_info),
          JSON.stringify(intelligence.social_links),
          intelligence.tech_stack_hints,
          intelligence.content_gaps,
          JSON.stringify(intelligence.raw_data),
          intelligence.scraped_at,
        ]
      );

      logger.info('Website intelligence stored', { clientId, url: intelligence.url });
    } catch (err) {
      logger.error('Failed to store website intelligence', {
        clientId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Get stored intelligence for a client.
   */
  async getIntelligence(clientId: string): Promise<WebsiteIntelligence | null> {
    if (!this.pool) return null;

    try {
      const result = await this.pool.query(
        'SELECT * FROM website_intelligence WHERE client_id = $1 AND is_stale = false LIMIT 1',
        [clientId]
      );
      return result.rows[0] || null;
    } catch (err) {
      logger.error('Failed to get website intelligence', {
        clientId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Get all stored intelligence records (for batch operations).
   */
  async getAllIntelligence(): Promise<WebsiteIntelligence[]> {
    if (!this.pool) return [];

    try {
      const result = await this.pool.query(
        'SELECT * FROM website_intelligence WHERE is_stale = false ORDER BY scraped_at DESC'
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  /**
   * Mark intelligence as stale (triggers re-scan).
   */
  async markStale(clientId: string): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(
      'UPDATE website_intelligence SET is_stale = true WHERE client_id = $1',
      [clientId]
    );
  }

  /**
   * Build a condensed intelligence prompt for the OpenAI article generator.
   * This takes the raw scraped data and formats it for AI consumption.
   */
  buildIntelligencePrompt(intelligence: WebsiteIntelligence): ClientIntelligencePrompt {
    const tone = intelligence.tone_analysis;
    const services = intelligence.services.slice(0, 5);
    const usps = intelligence.unique_selling_points.slice(0, 3);
    const audience = intelligence.target_audience.slice(0, 3);
    const terms = intelligence.common_terms.slice(0, 15);

    return {
      company_name: intelligence.site_name || intelligence.domain || intelligence.url,
      description: intelligence.description || '',
      industry: intelligence.industries[0] || intelligence.tech_stack_hints[0] || 'general',
      services: services.map(s => `  - ${s.name}${s.description ? `: ${s.description}` : ''}`).join('\n'),
      target_audience: audience.join('; '),
      tone: `${tone.primary_tone} (formality: ${tone.formality_estimate})`,
      unique_selling_points: usps.join('; '),
      common_terms: terms.join(', '),
      cta_style: intelligence.cta_patterns.slice(0, 3).map(c => c.text).join(' | '),
    };
  }

  /**
   * Format intelligence for injection into OpenAI prompts.
   */
  formatIntelligenceForPrompt(intelligence: WebsiteIntelligence): string {
    const prompt = this.buildIntelligencePrompt(intelligence);

    return [
      `## CLIENT INTELLIGENCE (Scraped from website)`,
      ``,
      `Company: ${prompt.company_name}`,
      `Description: ${prompt.description}`,
      `Industry: ${prompt.industry}`,
      ``,
      `### Services`,
      prompt.services || `  (Not explicitly listed — write broadly about the topic)`,
      ``,
      `### Target Audience`,
      prompt.target_audience || `Businesses and professionals`,
      ``,
      `### Tone & Voice`,
      `Primary tone: ${prompt.tone}`,
      ``,
      `### Unique Selling Points`,
      prompt.unique_selling_points || `(Generic — highlight general value)`,
      ``,
      `### Key Terms to Use Naturally`,
      prompt.common_terms || `Industry-standard terminology`,
      ``,
      `### CTA Style Examples`,
      prompt.cta_style || `Professional call-to-action`,
    ].join('\n');
  }

  /**
   * Get all clients that need scanning (no existing intelligence, or stale).
   */
  async getClientsNeedingScan(): Promise<Array<{ id: string; name: string; domain: string }>> {
    if (!this.pool) return [];

    try {
      const result = await this.pool.query(
        `SELECT c.id, c.name, c.shopify_shop as domain
         FROM clients c
         WHERE c.is_active = true
         AND c.shopify_shop != ''
         AND c.shopify_shop IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM website_intelligence wi
           WHERE wi.client_id = c.id AND wi.is_stale = false
         )
         ORDER BY c.name`
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  /**
   * Get ALL active clients with domains (for forced batch scans).
   */
  async getAllActiveClients(): Promise<Array<{ id: string; name: string; domain: string }>> {
    if (!this.pool) return [];

    try {
      const result = await this.pool.query(
        `SELECT id, name, shopify_shop as domain
         FROM clients
         WHERE is_active = true
         AND shopify_shop != ''
         AND shopify_shop IS NOT NULL
         ORDER BY name`
      );
      return result.rows;
    } catch {
      return [];
    }
  }
}

export default new ClientScraperService();
