// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// ──────────────────────────────────────────────
// Google Search Console Integration Service
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface GscAuthRow {
  id: string;
  client_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
  email: string | null;
}

export interface GscSite {
  id: string;
  client_id: string;
  site_url: string;
  permission_level: string;
  is_active: boolean;
  last_sync_at: string | null;
}

export interface GscQuery {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_position: number;
  page: string | null;
  country: string | null;
  device: string | null;
}

export interface GscOverview {
  connected: boolean;
  email?: string;
  stats: {
    totalImpressions: number;
    totalClicks: number;
    avgCtr: number;
    avgPosition: number;
  };
  sites: Array<{
    id: string;
    site_url: string;
    permission_level: string;
    last_sync_at: string | null;
  }>;
  dailyData: Array<{ date: string; impressions: number; clicks: number }>;
  topQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    avgPosition: number;
  }>;
}

const GSC_FETCH_TIMEOUT = 15000;
const BATCH_SIZE = 500;

class GoogleSearchConsoleService {
  private pool: Pool | null = null;
  private clientId: string = '';
  private clientSecret: string = '';
  private redirectUri: string = '';

  // In-memory token cache: clientId -> { token, expiresAt }
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  initialize(pool: Pool): void {
    this.pool = pool;
    this.clientId = process.env.GSC_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GSC_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GSC_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || '';
    logger.info('GoogleSearchConsoleService initialized', {
      configured: this.isConfigured(),
    });
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }

  // ─── OAuth State Management ────────────────

  async createOAuthState(clientId: string): Promise<string> {
    if (!this.pool) throw new Error('Service not initialized');

    const state = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO gsc_states (state, client_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [state, clientId]
    );
    return state;
  }

  async consumeOAuthState(state: string): Promise<string | null> {
    if (!this.pool) return null;

    const result = await this.pool.query(
      `DELETE FROM gsc_states
       WHERE state = $1 AND expires_at > NOW()
       RETURNING client_id`,
      [state]
    );

    return result.rows.length > 0 ? result.rows[0].client_id : null;
  }

  // ─── OAuth ─────────────────────────────────

  getAuthUrl(state: string): string {
    const base = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly email',
      access_type: 'offline',
      state,
      prompt: 'consent',
    });
    return `${base}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<string> {
    if (!this.pool) throw new Error('Service not initialized');

    // Consume one-time state token -> get clientId
    const clientId = await this.consumeOAuthState(state);
    if (!clientId) {
      throw new Error('Invalid or expired OAuth state token');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(GSC_FETCH_TIMEOUT),
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errBody}`);
    }

    const tokens: any = await tokenResponse.json();
    const expiresIn = tokens.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    let email: string | null = null;
    if (tokens.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        email = payload.email || null;
      } catch { /* ignore parse errors */ }
    }

    await this.pool.query(
      `INSERT INTO gsc_auth (client_id, access_token, refresh_token, token_expires_at, scope, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, gsc_auth.refresh_token),
         token_expires_at = EXCLUDED.token_expires_at,
         scope = EXCLUDED.scope,
         email = EXCLUDED.email`,
      [clientId, tokens.access_token, tokens.refresh_token || null, new Date(expiresAt).toISOString(), tokens.scope || null, email]
    );

    // Cache token
    this.tokenCache.set(clientId, { token: tokens.access_token, expiresAt });

    await this.syncSites(clientId);
    logger.info('GSC OAuth callback completed', { clientId, email });

    return clientId;
  }

  async refreshAccessToken(clientId: string): Promise<string> {
    if (!this.pool) throw new Error('Service not initialized');

    // Check in-memory cache first
    const cached = this.tokenCache.get(clientId);
    if (cached && cached.expiresAt > Date.now() + 300000) {
      return cached.token;
    }

    const result = await this.pool.query(
      'SELECT access_token, refresh_token, token_expires_at FROM gsc_auth WHERE client_id = $1',
      [clientId]
    );

    if (result.rows.length === 0) throw new Error('No GSC auth found for client');

    const row = result.rows[0];

    // If DB token is still valid, cache and return
    if (row.token_expires_at && new Date(row.token_expires_at).getTime() > Date.now() + 300000) {
      const dbExpiresAt = new Date(row.token_expires_at).getTime();
      this.tokenCache.set(clientId, { token: row.access_token, expiresAt: dbExpiresAt });
      return row.access_token;
    }

    if (!row.refresh_token) throw new Error('No refresh token available');

    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(GSC_FETCH_TIMEOUT),
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: row.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResponse.ok) {
      const errBody = await refreshResponse.text();
      if (refreshResponse.status === 400) {
        const errJson = JSON.parse(errBody);
        if (errJson.error === 'invalid_grant') {
          await this.pool.query('DELETE FROM gsc_auth WHERE client_id = $1', [clientId]);
          throw new Error('GSC authorization revoked — reconnect required');
        }
      }
      throw new Error(`Token refresh failed: ${errBody}`);
    }

    const tokens: any = await refreshResponse.json();
    const expiresIn = tokens.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    await this.pool.query(
      `UPDATE gsc_auth SET access_token = $1, token_expires_at = $2 WHERE client_id = $3`,
      [tokens.access_token, new Date(expiresAt).toISOString(), clientId]
    );

    this.tokenCache.set(clientId, { token: tokens.access_token, expiresAt });

    return tokens.access_token;
  }

  // ─── GSC API ───────────────────────────────

  private async gscFetch(clientId: string, path: string, options: RequestInit = {}): Promise<any> {
    const token = await this.refreshAccessToken(clientId);
    const url = `https://www.googleapis.com/webmasters/v3${path}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(GSC_FETCH_TIMEOUT),
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`GSC API error ${response.status}: ${errBody}`);
    }

    return response.json();
  }

  async syncSites(clientId: string): Promise<void> {
    if (!this.pool) return;

    try {
      const data = await this.gscFetch(clientId, '/sites');
      const sites: any[] = data.siteEntry || [];
      const activeUrls = sites.map(s => s.siteUrl);

      if (activeUrls.length > 0) {
        await this.pool.query(
          `UPDATE gsc_sites SET is_active = false WHERE client_id = $1 AND site_url != ALL($2)`,
          [clientId, activeUrls]
        );
      }

      for (const site of sites) {
        await this.pool.query(
          `INSERT INTO gsc_sites (client_id, site_url, permission_level)
           VALUES ($1, $2, $3)
           ON CONFLICT (client_id, site_url) DO UPDATE SET
             permission_level = EXCLUDED.permission_level,
             is_active = true`,
          [clientId, site.siteUrl, site.permissionLevel]
        );
      }

      logger.info('GSC sites synced', { clientId, count: sites.length });
    } catch (err) {
      logger.error('Failed to sync GSC sites', { clientId, error: (err as Error).message });
    }
  }

  async syncSearchAnalytics(clientId: string, siteUrl: string, days: number = 30): Promise<void> {
    if (!this.pool) return;

    try {
      const safeDays = Math.min(Math.max(days, 1), 365);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - safeDays * 86400000).toISOString().split('T')[0];

      const data = await this.gscFetch(clientId, `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['query', 'date', 'page', 'country', 'device'],
          rowLimit: 25000,
        }),
      });

      const rows: any[] = data.rows || [];

      // Batch insert in chunks
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const placeholders = chunk.map((_, j) =>
          `($${j * 11 + 1}, $${j * 11 + 2}, $${j * 11 + 3}, $${j * 11 + 4}, $${j * 11 + 5}, $${j * 11 + 6}, $${j * 11 + 7}, $${j * 11 + 8}, $${j * 11 + 9}, $${j * 11 + 10}, $${j * 11 + 11})`
        ).join(', ');

        const params: any[] = [];
        for (const row of chunk) {
          const keys = row.keys || [];
          params.push(
            clientId, siteUrl,
            keys[0] || '', keys[1] || startDate,
            row.impressions || 0, row.clicks || 0,
            row.ctr || 0, row.position || 0,
            keys[2] || '', keys[3] || '', keys[4] || ''
          );
        }

        try {
          await this.pool.query(
            `INSERT INTO gsc_queries (client_id, site_url, query, date, impressions, clicks, ctr, avg_position, page, country, device)
             VALUES ${placeholders}
             ON CONFLICT (site_url, query, date, page, country, device) DO UPDATE SET
               impressions = EXCLUDED.impressions,
               clicks = EXCLUDED.clicks,
               ctr = EXCLUDED.ctr,
               avg_position = EXCLUDED.avg_position`,
            params
          );
        } catch (insertErr) {
          logger.warn('Failed to insert GSC query batch', { error: (insertErr as Error).message });
        }
      }

      await this.pool.query(
        `UPDATE gsc_sites SET last_sync_at = NOW() WHERE client_id = $1 AND site_url = $2`,
        [clientId, siteUrl]
      );

      logger.info('GSC search analytics synced', { clientId, siteUrl, rows: rows.length, days: safeDays });
    } catch (err) {
      logger.error('Failed to sync GSC search analytics', { clientId, siteUrl, error: (err as Error).message });
    }
  }

  async syncAll(clientId: string): Promise<void> {
    if (!this.pool) return;

    const sitesResult = await this.pool.query(
      `SELECT site_url FROM gsc_sites WHERE client_id = $1 AND is_active = true`,
      [clientId]
    );

    for (const row of sitesResult.rows) {
      await this.syncSearchAnalytics(clientId, row.site_url);
    }
  }

  // ─── Data Access ────────────────────────────

  async getOverview(clientId: string, days: number = 30, topLimit: number = 10): Promise<GscOverview> {
    if (!this.pool) {
      return {
        connected: false,
        stats: { totalImpressions: 0, totalClicks: 0, avgCtr: 0, avgPosition: 0 },
        sites: [],
        dailyData: [],
        topQueries: [],
      };
    }

    const safeDays = Math.min(Math.max(days, 1), 365);

    const authResult = await this.pool.query(
      'SELECT email FROM gsc_auth WHERE client_id = $1', [clientId]
    );

    if (authResult.rows.length === 0) {
      return {
        connected: false,
        stats: { totalImpressions: 0, totalClicks: 0, avgCtr: 0, avgPosition: 0 },
        sites: [],
        dailyData: [],
        topQueries: [],
      };
    }

    const [statsResult, sitesResult, dailyResult, topQueryResult] = await Promise.all([
      this.pool.query(
        `SELECT
           COALESCE(SUM(impressions), 0)::bigint as total_impressions,
           COALESCE(SUM(clicks), 0)::bigint as total_clicks,
           COALESCE(AVG(ctr)::decimal(5,4), 0) as avg_ctr,
           COALESCE(AVG(avg_position)::decimal(4,1), 0) as avg_position
         FROM gsc_queries
         WHERE client_id = $1 AND date >= CURRENT_DATE - $2::int`,
        [clientId, safeDays]
      ),
      this.pool.query(
        `SELECT id, site_url, permission_level, last_sync_at
         FROM gsc_sites WHERE client_id = $1 AND is_active = true
         ORDER BY site_url`,
        [clientId]
      ),
      this.pool.query(
        `SELECT date::text,
                SUM(impressions)::bigint as impressions,
                SUM(clicks)::bigint as clicks
         FROM gsc_queries
         WHERE client_id = $1 AND date >= CURRENT_DATE - $2::int
         GROUP BY date
         ORDER BY date`,
        [clientId, safeDays]
      ),
      this.pool.query(
        `SELECT query,
                SUM(impressions)::bigint as impressions,
                SUM(clicks)::bigint as clicks,
                (CASE WHEN SUM(impressions) > 0 THEN ROUND(SUM(clicks)::decimal / SUM(impressions)::decimal, 4) ELSE 0 END) as ctr,
                ROUND(AVG(avg_position)::decimal, 1) as avg_position
         FROM gsc_queries
         WHERE client_id = $1 AND date >= CURRENT_DATE - $2::int
         GROUP BY query
         ORDER BY SUM(impressions) DESC
         LIMIT $3`,
        [clientId, safeDays, Math.min(Math.max(topLimit, 1), 100)]
      ),
    ]);

    return {
      connected: true,
      email: authResult.rows[0]?.email || undefined,
      stats: {
        totalImpressions: parseInt(statsResult.rows[0].total_impressions) || 0,
        totalClicks: parseInt(statsResult.rows[0].total_clicks) || 0,
        avgCtr: parseFloat(statsResult.rows[0].avg_ctr) || 0,
        avgPosition: parseFloat(statsResult.rows[0].avg_position) || 0,
      },
      sites: sitesResult.rows.map(s => ({
        id: s.id,
        site_url: s.site_url,
        permission_level: s.permission_level,
        last_sync_at: s.last_sync_at,
      })),
      dailyData: dailyResult.rows.map(d => ({
        date: d.date,
        impressions: parseInt(d.impressions) || 0,
        clicks: parseInt(d.clicks) || 0,
      })),
      topQueries: topQueryResult.rows.map(q => ({
        query: q.query,
        impressions: parseInt(q.impressions) || 0,
        clicks: parseInt(q.clicks) || 0,
        ctr: parseFloat(q.ctr) || 0,
        avgPosition: parseFloat(q.avg_position) || 0,
      })),
    };
  }

  async getAuthStatus(clientId: string): Promise<{ connected: boolean; email?: string }> {
    if (!this.pool) return { connected: false };

    const result = await this.pool.query(
      'SELECT email FROM gsc_auth WHERE client_id = $1', [clientId]
    );

    if (result.rows.length === 0) return { connected: false };
    return { connected: true, email: result.rows[0].email || undefined };
  }

  async disconnect(clientId: string): Promise<void> {
    if (!this.pool) return;

    // Revoke Google tokens before deleting
    try {
      const auth = await this.pool.query(
        'SELECT access_token, refresh_token FROM gsc_auth WHERE client_id = $1',
        [clientId]
      );

      if (auth.rows.length > 0) {
        const revokeToken = auth.rows[0].refresh_token || auth.rows[0].access_token;
        if (revokeToken) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${revokeToken}`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        }
      }
    } catch (revokeErr) {
      logger.warn('GSC token revocation failed', { clientId, error: (revokeErr as Error).message });
    }

    this.tokenCache.delete(clientId);
    await this.pool.query('DELETE FROM gsc_auth WHERE client_id = $1', [clientId]);
    await this.pool.query('DELETE FROM gsc_sites WHERE client_id = $1', [clientId]);
    await this.pool.query('DELETE FROM gsc_queries WHERE client_id = $1', [clientId]);

    logger.info('GSC disconnected', { clientId });
  }
}

const gscService = new GoogleSearchConsoleService();
export default gscService;
