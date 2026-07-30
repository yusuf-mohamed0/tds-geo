import { Pool } from 'pg';
import { logger } from '../utils/logger';
import dataforseo from './dataforseo';
import openaiService from './openai';

interface BacklinkProspect {
  id: string;
  domain: string;
  domainRating: number;
  relevanceScore: number;
  estimatedTraffic: number;
  niche?: string;
  contactEmail?: string;
  contactPage?: string;
  status: string;
}

interface EnrichedProspect {
  domain: string;
  domainRating: number;
  relevanceScore: number;
  estimatedTraffic: number;
  niche: string;
  contactPage?: string;
  guestPostGuidelines?: string;
  summary?: string;
}

interface GuestPostResult {
  title: string;
  content: string;
  wordCount: number;
}

class BacklinkAutomationService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('BacklinkAutomationService not initialized');
    return this.pool;
  }

  async discoverProspects(
    clientId: string,
    targetDomain: string,
    limit: number = 20
  ): Promise<BacklinkProspect[]> {
    const pool = this.getPool();
    const results: BacklinkProspect[] = [];

    if (!dataforseo.isEnabled()) {
      throw new Error('Backlink discovery requires DataForSEO. No prospect data is available until it is configured.');
    }

    try {
      // 1. Use DataForSEO to find competitor referring domains
      const competitorBacklinks = await dataforseo.getCompetitorBacklinks(targetDomain, limit);

      for (const bl of competitorBacklinks) {
        if (!bl.url || bl.url.includes('facebook.com') || bl.url.includes('twitter.com') || bl.url.includes('linkedin.com')) continue;

        const existing = await pool.query(
          'SELECT id, status FROM backlink_prospects WHERE client_id = $1 AND domain = $2',
          [clientId, bl.url]
        );

        if (existing.rows.length > 0) {
          results.push(this.mapProspect(existing.rows[0]));
          continue;
        }

        // 2. Get domain metrics
        let domainData = null;
        try {
          domainData = await dataforseo.getDomainAnalysis(bl.url);
        } catch {
          domainData = null;
        }

        // 3. Enrich with AI
        const enriched = await this.aiEnrichProspect(bl.url, targetDomain);

        const insertResult = await pool.query(
          `INSERT INTO backlink_prospects
           (client_id, domain, domain_rating, relevance_score, estimated_traffic, niche,
            contact_page, guest_post_guidelines, notes, source, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'competitor_analysis', $10)
           ON CONFLICT (client_id, domain) DO UPDATE SET
             domain_rating = EXCLUDED.domain_rating,
             relevance_score = EXCLUDED.relevance_score,
             updated_at = NOW()
           RETURNING *`,
          [
            clientId,
            bl.url,
            bl.domainRating || domainData?.referringDomains || 0,
            enriched.relevanceScore,
            domainData?.organicTraffic || 0,
            enriched.niche,
            enriched.contactPage || null,
            enriched.guestPostGuidelines || null,
            enriched.summary || null,
            JSON.stringify({ sourceDomain: targetDomain, foundVia: 'competitor_backlinks' }),
          ]
        );

        results.push(this.mapProspect(insertResult.rows[0]));
      }

      logger.info(`Discovered ${results.length} backlink prospects`, { clientId, targetDomain });
    } catch (err: any) {
      logger.error('Backlink prospect discovery failed', { clientId, targetDomain, error: err.message });
      throw err;
    }

    return results;
  }

  async getProspects(clientId: string, status?: string): Promise<BacklinkProspect[]> {
    const pool = this.getPool();
    let query = 'SELECT * FROM backlink_prospects WHERE client_id = $1';
    const params: any[] = [clientId];
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    query += ' ORDER BY relevance_score DESC, domain_rating DESC';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapProspect);
  }

  async createOutreach(
    clientId: string,
    prospectId: string,
    pitchType: string = 'guest_post',
    articleId?: string
  ): Promise<any> {
    const pool = this.getPool();
    const prospect = await pool.query(
      'SELECT * FROM backlink_prospects WHERE id = $1 AND client_id = $2',
      [prospectId, clientId]
    );
    if (prospect.rows.length === 0) throw new Error('Prospect not found');

    const article = articleId
      ? await pool.query('SELECT title, content_md FROM articles WHERE id = $1 AND client_id = $2', [articleId, clientId])
      : null;

    const emailContent = await this.generateOutreachEmail(
      prospect.rows[0],
      article?.rows[0] || null,
      pitchType
    );

    const result = await pool.query(
      `INSERT INTO backlink_outreach
       (client_id, prospect_id, email_subject, email_body, pitch_type, article_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING *`,
      [clientId, prospectId, emailContent.subject, emailContent.body, pitchType, articleId || null]
    );

    return result.rows[0];
  }

  async markSent(outreachId: string, clientId: string): Promise<void> {
    await this.getPool().query(
      `UPDATE backlink_outreach SET status = 'sent', sent_at = NOW() WHERE id = $1 AND client_id = $2`,
      [outreachId, clientId]
    );
  }

  async getOutreach(clientId: string, status?: string): Promise<any[]> {
    const pool = this.getPool();
    let query = `SELECT bo.*, bp.domain, bp.domain_rating
                 FROM backlink_outreach bo
                 JOIN backlink_prospects bp ON bp.id = bo.prospect_id
                 WHERE bo.client_id = $1`;
    const params: any[] = [clientId];
    if (status) {
      query += ' AND bo.status = $2';
      params.push(status);
    }
    query += ' ORDER BY bo.created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  }

  async generateGuestPost(
    clientId: string,
    prospectId: string,
    topic: string,
    tone: string = 'educational'
  ): Promise<GuestPostResult> {
    const pool = this.getPool();
    const prospect = await pool.query(
      'SELECT * FROM backlink_prospects WHERE id = $1 AND client_id = $2',
      [prospectId, clientId]
    );
    if (prospect.rows.length === 0) throw new Error('Prospect not found');
    const p = prospect.rows[0];

    const response = await openaiService.getClient()!.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a skilled guest post writer. Write a high-quality, original article suitable for publication on ${p.domain}.

Target audience niche: ${p.niche || 'general'}
Tone: ${tone}
Guidelines: ${p.guest_post_guidelines || 'Standard blog post, 1000-1500 words, original insights'}

Rules:
- Do NOT mention the guest post nature in the content itself
- Include 2-3 natural, contextual links back to the source site where relevant
- Write in the voice of an expert in the field
- Include a brief author bio at the end with a link to the client's website
- Use markdown formatting
- Original research, data, or perspectives preferred over generic advice
- No AI clichés or robotic language`
        },
        {
          role: 'user',
          content: `Write a guest post about: ${topic}

The article should be authoritative, well-researched, and provide genuine value to ${p.domain}'s audience. Include a natural backlink to our site where appropriate.

Return JSON: { "title": string, "content": string, "wordCount": number, "backlinkAnchor": string, "backlinkUrl": string }`
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Guest post generation returned empty');

    const parsed = JSON.parse(content);
    return {
      title: parsed.title || `${topic} — Expert Insights`,
      content: parsed.content || '',
      wordCount: parsed.wordCount || 0,
    };
  }

  async trackBacklink(
    clientId: string,
    sourceUrl: string,
    targetUrl: string,
    anchorText: string,
    prospectId?: string,
    outreachId?: string,
    articleId?: string
  ): Promise<any> {
    const pool = this.getPool();

    let dr = 0;
    let traffic = 0;
    try {
      const domain = new URL(sourceUrl).hostname;
      const domainData = await dataforseo.getDomainAnalysis(domain);
      dr = domainData?.referringDomains || 0;
      traffic = domainData?.organicTraffic || 0;
    } catch (err) {
      logger.warn('Backlink domain metrics unavailable', { sourceUrl, error: (err as Error).message });
    }

    const result = await pool.query(
      `INSERT INTO backlinks
       (client_id, prospect_id, outreach_id, article_id, source_url, target_url, anchor_text, status,
        domain_rating, estimated_traffic, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, NOW())
       RETURNING *`,
      [clientId, prospectId || null, outreachId || null, articleId || null, sourceUrl, targetUrl, anchorText, dr, traffic]
    );

    // Update prospect status
    if (prospectId) {
      await pool.query(
        "UPDATE backlink_prospects SET status = 'linked' WHERE id = $1",
        [prospectId]
      );
    }

    return result.rows[0];
  }

  async getBacklinks(clientId: string, status?: string): Promise<any[]> {
    const pool = this.getPool();
    let query = `SELECT b.*, bp.domain as prospect_domain
                 FROM backlinks b
                 LEFT JOIN backlink_prospects bp ON bp.id = b.prospect_id
                 WHERE b.client_id = $1`;
    const params: any[] = [clientId];
    if (status) {
      query += ' AND b.status = $2';
      params.push(status);
    }
    query += ' ORDER BY b.created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  }

  async verifyBacklinks(clientId?: string): Promise<{ checked: number; active: number; lost: number }> {
    const pool = this.getPool();
    let query = 'SELECT * FROM backlinks WHERE status = $1';
    const params: any[] = ['active'];
    if (clientId) {
      query += ' AND client_id = $2';
      params.push(clientId);
    }

    const backlinks = await pool.query(query, params);
    let checked = 0;
    let active = 0;
    let lost = 0;

    for (const bl of backlinks.rows) {
      checked++;
      try {
        const response = await fetch(bl.source_url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          active++;
        } else {
          lost++;
          await pool.query("UPDATE backlinks SET status = 'lost', lost_at = NOW() WHERE id = $1", [bl.id]);
        }
      } catch {
        lost++;
        await pool.query("UPDATE backlinks SET status = 'lost', lost_at = NOW() WHERE id = $1", [bl.id]);
      }
    }

    logger.info('Backlink verification complete', { checked, active, lost });
    return { checked, active, lost };
  }

  private async aiEnrichProspect(domain: string, targetDomain: string): Promise<EnrichedProspect> {
    try {
      const response = await openaiService.getClient()!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a backlink prospecting analyst. Given a domain and a target domain,
assess the domain as a potential backlink source. Return JSON:
{
  "relevanceScore": number (0-100, how relevant is this domain to the target's niche),
  "niche": string (the primary topic/niche of the domain),
  "contactPage": string (likely contact or contribute page URL),
  "guestPostGuidelines": string (likely guest post guidelines based on the domain),
  "summary": string (1-sentence assessment of this domain as a backlink prospect)
}`
          },
          {
            role: 'user',
            content: `Domain: ${domain}\nTarget domain: ${targetDomain}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return this.defaultEnrichment();
      return JSON.parse(content);
    } catch {
      return this.defaultEnrichment();
    }
  }

  private async generateOutreachEmail(
    prospect: any,
    article: any,
    pitchType: string
  ): Promise<{ subject: string; body: string }> {
    try {
      const response = await openaiService.getClient()!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at writing backlink outreach emails. Write a personalized,
professional email to a site owner proposing a ${pitchType.replace('_', ' ')} collaboration.

Rules:
- Be genuine and personalized
- Clearly explain the value proposition
- Keep it under 200 words
- Include a specific mention of their content/site
- No spammy language
- Professional but warm tone
- Include your name as [Your Name] and site as [Your Site] (placeholders)

Return JSON: { "subject": string, "body": string }`
          },
          {
            role: 'user',
            content: `Website: ${prospect.domain}
Relevance: ${prospect.relevance_score}/100
Niche: ${prospect.niche || 'Unknown'}
${article ? `Our article: "${article.title}"` : ''}`
          }
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return { subject: `Collaboration opportunity with ${prospect.domain}`, body: '' };
      return JSON.parse(content);
    } catch {
      return { subject: `Collaboration opportunity with ${prospect.domain}`, body: '' };
    }
  }

  private defaultEnrichment(): EnrichedProspect {
    return {
      domain: '',
      domainRating: 0,
      relevanceScore: 50,
      estimatedTraffic: 0,
      niche: 'General',
      summary: 'Standard prospect — needs manual review',
    };
  }

  private mapProspect(row: any): BacklinkProspect {
    return {
      id: row.id,
      domain: row.domain,
      domainRating: row.domain_rating || 0,
      relevanceScore: parseFloat(row.relevance_score) || 0,
      estimatedTraffic: row.estimated_traffic || 0,
      niche: row.niche,
      contactEmail: row.contact_email,
      contactPage: row.contact_page,
      status: row.status,
    };
  }
}

export const backlinkAutomation = new BacklinkAutomationService();
export default backlinkAutomation;
