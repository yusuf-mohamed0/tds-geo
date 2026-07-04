// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export type SitePlatform = 'shopify' | 'wordpress' | 'webflow' | 'ghost';
export type SiteConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending';
export type SiteHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface ConnectedSite {
  id: string;
  platform: SitePlatform;
  site_name: string;
  domain: string;
  owner_name: string;
  owner_email: string;
  connector_id: string | null;
  connection_status: SiteConnectionStatus;
  encrypted_credentials: string;
  connected_at: Date;
  last_sync_at: Date | null;
  last_publish_at: Date | null;
  total_articles_published: number;
  health_status: SiteHealthStatus;
  created_at: Date;
  updated_at: Date;
}

export interface SiteFilters {
  platform?: SitePlatform;
  status?: SiteConnectionStatus;
  health?: SiteHealthStatus;
  search?: string;
}

class SitesService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('SitesService not initialized');
    return this.pool;
  }

  async register(data: {
    platform: SitePlatform;
    site_name: string;
    domain: string;
    owner_name?: string;
    owner_email?: string;
    connector_id?: string;
    encrypted_credentials?: string;
    connection_status?: SiteConnectionStatus;
  }): Promise<ConnectedSite> {
    const pool = this.getPool();

    const result = await pool.query(
      `INSERT INTO connected_sites (platform, site_name, domain, owner_name, owner_email, connector_id, encrypted_credentials, connection_status, connected_at, health_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'healthy')
       ON CONFLICT (domain, platform)
       DO UPDATE SET
         site_name = COALESCE(NULLIF(EXCLUDED.site_name, ''), connected_sites.site_name),
         owner_name = COALESCE(NULLIF(EXCLUDED.owner_name, ''), connected_sites.owner_name),
         owner_email = COALESCE(NULLIF(EXCLUDED.owner_email, ''), connected_sites.owner_email),
         connector_id = COALESCE(NULLIF(EXCLUDED.connector_id, ''), connected_sites.connector_id),
         encrypted_credentials = COALESCE(NULLIF(EXCLUDED.encrypted_credentials, ''), connected_sites.encrypted_credentials),
         connection_status = EXCLUDED.connection_status,
         connected_at = CASE WHEN connected_sites.connection_status != 'connected' THEN NOW() ELSE connected_sites.connected_at END,
         health_status = 'healthy',
         updated_at = NOW()
       RETURNING *`,
      [
        data.platform,
        data.site_name,
        data.domain,
        data.owner_name || '',
        data.owner_email || '',
        data.connector_id || null,
        data.encrypted_credentials || '',
        data.connection_status || 'connected',
      ]
    );

    logger.info('SitesService: site registered', { platform: data.platform, domain: data.domain });
    return result.rows[0];
  }

  async updateStatus(domain: string, platform: SitePlatform, status: SiteConnectionStatus): Promise<void> {
    const pool = this.getPool();
    await pool.query(
      `UPDATE connected_sites SET connection_status = $1, updated_at = NOW() WHERE domain = $2 AND platform = $3`,
      [status, domain, platform]
    );
  }

  async updateHealth(domain: string, platform: SitePlatform, health: SiteHealthStatus): Promise<void> {
    const pool = this.getPool();
    await pool.query(
      `UPDATE connected_sites SET health_status = $1, last_sync_at = NOW(), updated_at = NOW() WHERE domain = $2 AND platform = $3`,
      [health, domain, platform]
    );
  }

  async recordPublish(domain: string, platform: SitePlatform): Promise<void> {
    const pool = this.getPool();
    await pool.query(
      `UPDATE connected_sites SET total_articles_published = total_articles_published + 1, last_publish_at = NOW(), updated_at = NOW() WHERE domain = $2 AND platform = $3`,
      [domain, platform]
    );
  }

  async recordSync(domain: string, platform: SitePlatform): Promise<void> {
    const pool = this.getPool();
    await pool.query(
      `UPDATE connected_sites SET last_sync_at = NOW(), updated_at = NOW() WHERE domain = $1 AND platform = $2`,
      [domain, platform]
    );
  }

  async list(filters: SiteFilters = {}): Promise<ConnectedSite[]> {
    const pool = this.getPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.platform) {
      conditions.push(`platform = $${paramIdx++}`);
      params.push(filters.platform);
    }
    if (filters.status) {
      conditions.push(`connection_status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters.health) {
      conditions.push(`health_status = $${paramIdx++}`);
      params.push(filters.health);
    }
    if (filters.search) {
      conditions.push(`(site_name ILIKE $${paramIdx} OR domain ILIKE $${paramIdx} OR owner_name ILIKE $${paramIdx} OR owner_email ILIKE $${paramIdx})`);
      params.push(`%${filters.search}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM connected_sites ${where} ORDER BY created_at DESC`,
      params
    );
    return result.rows;
  }

  async getByDomain(domain: string, platform: SitePlatform): Promise<ConnectedSite | null> {
    const pool = this.getPool();
    const result = await pool.query(
      `SELECT * FROM connected_sites WHERE domain = $1 AND platform = $2`,
      [domain, platform]
    );
    return result.rows[0] || null;
  }

  async getStats(): Promise<{ total: number; byPlatform: Record<string, number>; byStatus: Record<string, number> }> {
    const pool = this.getPool();
    const result = await pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COALESCE(json_object_agg(platform, cnt) FILTER (WHERE platform IS NOT NULL), '{}'::json) AS by_platform,
        COALESCE(json_object_agg(connection_status, scnt) FILTER (WHERE connection_status IS NOT NULL), '{}'::json) AS by_status
      FROM (
        SELECT platform, COUNT(*)::int AS cnt FROM connected_sites GROUP BY platform
      ) p,
      (
        SELECT connection_status, COUNT(*)::int AS scnt FROM connected_sites GROUP BY connection_status
      ) s`
    );
    const row = result.rows[0];
    return {
      total: row?.total || 0,
      byPlatform: row?.by_platform || {},
      byStatus: row?.by_status || {},
    };
  }
}

export const sitesService = new SitesService();
