// ──────────────────────────────────────────────
// Article Repository
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface ArticleRecord {
  id: string;
  client_id: string;
  keyword_id: string | null;
  title: string;
  slug: string;
  content_md: string;
  content_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[];
  word_count: number;
  pipeline_stage: string;
  status: string;
  editorial_status: string | null;
  seo_score: number | null;
  ai_evaluation_score: number | null;
  readability_score: number | null;
  quality_score: number | null;
  eat_score: number | null;
  source: string;
  created_at: Date;
  updated_at: Date;
}

export function createArticleRepo(pool: Pool) {
  async function findById(id: string): Promise<ArticleRecord | null> {
    const result = await pool.query(
      `SELECT a.*, k.keyword FROM articles a
       LEFT JOIN keywords k ON k.id = a.keyword_id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async function findBySlug(slug: string): Promise<ArticleRecord | null> {
    const result = await pool.query('SELECT * FROM articles WHERE slug = $1', [slug]);
    return result.rows[0] || null;
  }

  async function findByClient(clientId: string, options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ rows: ArticleRecord[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;
    const params: any[] = [clientId];
    const conditions = ['client_id = $1'];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM articles WHERE ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM articles WHERE ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { rows: result.rows, total };
  }

  async function findPendingReview(): Promise<ArticleRecord[]> {
    const result = await pool.query(
      `SELECT * FROM articles WHERE status IN ('generated', 'reviewed')
       ORDER BY created_at ASC`
    );
    return result.rows;
  }

  async function create(data: Partial<ArticleRecord>): Promise<ArticleRecord> {
    const result = await pool.query(
      `INSERT INTO articles (client_id, keyword_id, title, slug, content_md, content_html,
        meta_title, meta_description, tags, word_count, status, editorial_status, source, pipeline_stage, seo_score, ai_evaluation_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        data.client_id, data.keyword_id || null, data.title, data.slug,
        data.content_md, data.content_html || null, data.meta_title || null,
        data.meta_description || null, data.tags || [],
        data.word_count || 0, data.status || 'draft', data.editorial_status || 'draft',
        data.source || 'ai_generated', data.pipeline_stage || 'draft',
        data.seo_score || null, data.ai_evaluation_score || null
      ]
    );
    return result.rows[0];
  }

  async function update(id: string, data: Partial<ArticleRecord>): Promise<ArticleRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      title: 'title', content_md: 'content_md', content_html: 'content_html',
      meta_title: 'meta_title', meta_description: 'meta_description',
      tags: 'tags', word_count: 'word_count', status: 'status',
      pipeline_stage: 'pipeline_stage', seo_score: 'seo_score',
      ai_evaluation_score: 'ai_evaluation_score', editorial_status: 'editorial_status',
      readability_score: 'readability_score', quality_score: 'quality_score',
      eat_score: 'eat_score', source: 'source'
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${column} = $${paramIndex++}`);
        values.push((data as any)[key]);
      }
    }

    if (fields.length === 0) return null;

    values.push(id);
    const result = await pool.query(
      `UPDATE articles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  async function updateStatus(id: string, status: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE articles SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [status, id]
    );
    return result.rows.length > 0;
  }

  async function updatePipelineStage(id: string, stage: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE articles SET pipeline_stage = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [stage, id]
    );
    return result.rows.length > 0;
  }

  return { findById, findBySlug, findByClient, findPendingReview, create, update, updateStatus, updatePipelineStage };
}

export type ArticleRepo = ReturnType<typeof createArticleRepo>;
