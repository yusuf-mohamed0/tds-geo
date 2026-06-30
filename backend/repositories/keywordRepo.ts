// ──────────────────────────────────────────────
// Keyword Repository
// ──────────────────────────────────────────────

import { Pool } from 'pg';

export interface KeywordRecord {
  id: string;
  client_id: string;
  keyword: string;
  cluster_id: string | null;
  search_volume: number;
  competition: number;
  cpc: number;
  trend_score: number;
  relevance_score: number;
  keyword_type: string;
  intent: string;
  source: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function createKeywordRepo(pool: Pool) {
  async function findById(id: string): Promise<KeywordRecord | null> {
    const result = await pool.query('SELECT * FROM keywords WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async function findByKeyword(clientId: string, keyword: string): Promise<KeywordRecord | null> {
    const result = await pool.query(
      'SELECT * FROM keywords WHERE client_id = $1 AND LOWER(keyword) = LOWER($2)',
      [clientId, keyword]
    );
    return result.rows[0] || null;
  }

  async function findBest(clientId: string, options: {
    minVolume?: number;
    maxCompetition?: number;
    limit?: number;
    excludeUsedDays?: number;
  } = {}): Promise<KeywordRecord[]> {
    const { minVolume = 100, maxCompetition = 0.7, limit = 5, excludeUsedDays = 90 } = options;

    const result = await pool.query(
      `SELECT * FROM keywords
       WHERE client_id = $1 AND is_active = true
         AND search_volume >= $2 AND competition <= $3
         AND (last_used_at IS NULL OR last_used_at < NOW() - ($4 || ' days')::INTERVAL)
       ORDER BY relevance_score DESC, search_volume DESC
       LIMIT $5`,
      [clientId, minVolume, maxCompetition, String(excludeUsedDays), limit]
    );
    return result.rows;
  }

  async function findUnused(clientId: string, limit = 20): Promise<KeywordRecord[]> {
    const result = await pool.query(
      `SELECT * FROM keywords
       WHERE client_id = $1 AND is_active = true AND last_used_at IS NULL
       ORDER BY relevance_score DESC LIMIT $2`,
      [clientId, limit]
    );
    return result.rows;
  }

  async function findByCluster(clusterId: string): Promise<KeywordRecord[]> {
    const result = await pool.query(
      'SELECT * FROM keywords WHERE cluster_id = $1 AND is_active = true ORDER BY relevance_score DESC',
      [clusterId]
    );
    return result.rows;
  }

  async function create(data: Partial<KeywordRecord>): Promise<KeywordRecord> {
    const result = await pool.query(
      `INSERT INTO keywords (client_id, keyword, cluster_id, search_volume, competition,
        cpc, trend_score, relevance_score, keyword_type, intent, source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (client_id, keyword) DO UPDATE SET
         search_volume = EXCLUDED.search_volume,
         competition = EXCLUDED.competition,
         cpc = EXCLUDED.cpc,
         trend_score = EXCLUDED.trend_score,
         relevance_score = EXCLUDED.relevance_score,
         updated_at = NOW()
       RETURNING *`,
      [
        data.client_id, data.keyword, data.cluster_id || null,
        data.search_volume || 0, data.competition || 0, data.cpc || 0,
        data.trend_score || 0, data.relevance_score || 0,
        data.keyword_type || 'long_tail', data.intent || 'informational',
        data.source || 'manual', JSON.stringify(data.metadata || {})
      ]
    );
    return result.rows[0];
  }

  async function markUsed(keywordId: string): Promise<void> {
    await pool.query('UPDATE keywords SET last_used_at = NOW(), updated_at = NOW() WHERE id = $1', [keywordId]);
  }

  async function getStats(clientId: string): Promise<Record<string, unknown>> {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE last_used_at IS NULL) as unused,
        COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '30 days') as used_30d,
        AVG(search_volume)::DECIMAL(10,2) as avg_volume,
        AVG(competition)::DECIMAL(5,2) as avg_competition,
        AVG(relevance_score)::DECIMAL(5,1) as avg_relevance,
        COUNT(*) FILTER (WHERE keyword_type = 'short_tail') as short_tail,
        COUNT(*) FILTER (WHERE keyword_type = 'long_tail') as long_tail,
        COUNT(*) FILTER (WHERE keyword_type = 'local') as local_keywords
       FROM keywords WHERE client_id = $1 AND is_active = true`,
      [clientId]
    );
    return result.rows[0] || {};
  }

  async function findSimilar(clientId: string, keyword: string, threshold = 0.7): Promise<KeywordRecord[]> {
    // Use pg_trgm for trigram similarity matching
    const result = await pool.query(
      `SELECT *, similarity(keyword, $2) as sim
       FROM keywords
       WHERE client_id = $1 AND is_active = true
         AND similarity(keyword, $2) > $3
         AND LOWER(keyword) != LOWER($2)
       ORDER BY sim DESC LIMIT 5`,
      [clientId, keyword, threshold]
    );
    return result.rows;
  }

  return { findById, findByKeyword, findBest, findUnused, findByCluster, create, markUsed, getStats, findSimilar };
}

export type KeywordRepo = ReturnType<typeof createKeywordRepo>;
