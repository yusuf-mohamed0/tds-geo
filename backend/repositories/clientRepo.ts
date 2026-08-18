// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Client Repository
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { encrypt } from '../services/credentialEncryption';

export interface ClientRecord {
  id: string;
  name: string;
  slug: string;
  shopify_shop: string;
  shopify_token: string;
  shopify_api_version: string;
  brand_voice: string | null;
  service_area: string | null;
  timezone: string;
  publish_frequency: string;
  preferred_publish_hour: number;
  approval_mode: 'auto' | 'manual';
  monthly_token_limit: number;
  monthly_cost_limit: number;
  keyword_categories: string[];
  blacklist_keywords: string[];
  cta_template: string | null;
  target_audience: string | null;
  locale: string;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export function createClientRepo(pool: Pool) {
  async function findById(id: string): Promise<ClientRecord | null> {
    const result = await pool.query(
      'SELECT * FROM clients WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0] || null;
  }

  async function findBySlug(slug: string): Promise<ClientRecord | null> {
    const result = await pool.query(
      'SELECT * FROM clients WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  }

  async function findAll(includeInactive = false): Promise<ClientRecord[]> {
    const result = await pool.query(
      `SELECT * FROM clients ${includeInactive ? '' : 'WHERE is_active = true'} ORDER BY name`
    );
    return result.rows;
  }

  async function create(data: Partial<ClientRecord>): Promise<ClientRecord> {
    const result = await pool.query(
      `INSERT INTO clients (name, slug, shopify_shop, shopify_token, shopify_api_version,
        brand_voice, service_area, timezone, publish_frequency, preferred_publish_hour,
        approval_mode, monthly_token_limit, monthly_cost_limit, keyword_categories,
        blacklist_keywords, cta_template, target_audience, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        data.name, data.slug, data.shopify_shop, encrypt(data.shopify_token || ''),
        data.shopify_api_version || '2025-07', data.brand_voice || null,
        data.service_area || null, data.timezone || 'UTC',
        data.publish_frequency || 'daily', data.preferred_publish_hour || 10,
        data.approval_mode || 'auto', data.monthly_token_limit || 1000000,
        data.monthly_cost_limit || 100.00,
        data.keyword_categories || [], data.blacklist_keywords || [],
        data.cta_template || null, data.target_audience || null,
        JSON.stringify(data.settings || {})
      ]
    );
    logger.info('Client created', { clientId: result.rows[0].id, name: data.name });
    return result.rows[0];
  }

  async function update(id: string, data: Partial<ClientRecord>): Promise<ClientRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      name: 'name', slug: 'slug', shopify_shop: 'shopify_shop',
      shopify_token: 'shopify_token', shopify_api_version: 'shopify_api_version',
      brand_voice: 'brand_voice', service_area: 'service_area',
      timezone: 'timezone', publish_frequency: 'publish_frequency',
      preferred_publish_hour: 'preferred_publish_hour',
      approval_mode: 'approval_mode', monthly_token_limit: 'monthly_token_limit',
      monthly_cost_limit: 'monthly_cost_limit', is_active: 'is_active',
      cta_template: 'cta_template', target_audience: 'target_audience'
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${column} = $${paramIndex++}`);
        let value = (data as any)[key];
        if (column === 'shopify_token') value = encrypt(value || '');
        values.push(value);
      }
    }

    if (data.keyword_categories) {
      fields.push(`keyword_categories = $${paramIndex++}`);
      values.push(data.keyword_categories);
    }
    if (data.blacklist_keywords) {
      fields.push(`blacklist_keywords = $${paramIndex++}`);
      values.push(data.blacklist_keywords);
    }
    if (data.settings) {
      fields.push(`settings = settings || $${paramIndex++}`);
      values.push(JSON.stringify(data.settings));
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await pool.query(
      `UPDATE clients SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async function deactivate(id: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE clients SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  }

  return { findById, findBySlug, findAll, create, update, deactivate };
}

export type ClientRepo = ReturnType<typeof createClientRepo>;
