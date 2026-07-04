// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// KOZMO Core — Global Memory Store
//
// Semantic memory layer across ALL connected sites.
// Stores site context, article history, entity relationships,
// brand voice, and performance metrics.
//
// Uses pgvector for entity embeddings and PostgreSQL for
// relational knowledge graph queries.
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import {
  Article,
  BrandVoiceProfile,
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
} from '../types';

export interface SiteMemory {
  client_id: string;
  site_name: string;
  site_url: string;
  site_description: string;
  brand_voice: BrandVoiceProfile | null;
  categories: string[];
  settings: Record<string, unknown>;
  article_count: number;
  last_article_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ArticleMemory {
  id: string;
  client_id: string;
  article_id: string;
  title: string;
  word_count: number;
  seo_score: number | null;
  read_time_seconds: number | null;
  traffic_estimate: number | null;
  keywords: string[];
  entities: string[];
  published_at: Date | null;
  created_at: Date;
}

export interface GlobalMemoryStats {
  total_sites: number;
  total_articles: number;
  total_entities: number;
  total_relations: number;
  articles_24h: number;
}

class GlobalMemoryService {
  private pool: Pool | null = null;
  private initialized = false;

  initialize(pool: Pool): void {
    this.pool = pool;
    this.initialized = true;
    logger.info('Global Memory Store initialized');
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('GlobalMemoryService not initialized');
    return this.pool;
  }

  // ── Site Memory ─────────────────────────────

  async getSite(clientId: string): Promise<SiteMemory | null> {
    const pool = this.getPool();
    const result = await pool.query(
      `SELECT c.id as client_id, c.name as site_name, c.slug,
              COALESCE(c.settings->>'site_description', '') as site_description,
              c.brand_voice,
              c.settings,
              (SELECT COUNT(*) FROM articles WHERE client_id = c.id) as article_count,
              (SELECT MAX(created_at) FROM articles WHERE client_id = c.id) as last_article_at,
              c.created_at, c.updated_at
       FROM clients c WHERE c.id = $1`,
      [clientId]
    );
    if (result.rows.length === 0) return null;
    return this.mapSite(result.rows[0]);
  }

  async updateSite(clientId: string, data: Partial<SiteMemory>): Promise<void> {
    const pool = this.getPool();
    const settings: Record<string, unknown> = {};

    if (data.site_description) settings.site_description = data.site_description;
    if (data.categories) settings.categories = data.categories;

    if (Object.keys(settings).length > 0) {
      await pool.query(
        `UPDATE clients SET settings = settings || $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [clientId, JSON.stringify(settings)]
      );
    }
  }

  // ── Article History ─────────────────────────

  async recordArticle(clientId: string, article: Article): Promise<void> {
    const pool = this.getPool();

    // Extract entities from the article content
    const entities = await this.extractEntityNames(article.content_md || '');

    await pool.query(
      `INSERT INTO article_memory (client_id, article_id, title, word_count,
        seo_score, keywords, entities, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (article_id) DO UPDATE SET
         title = EXCLUDED.title,
         word_count = EXCLUDED.word_count,
         seo_score = EXCLUDED.seo_score,
         keywords = EXCLUDED.keywords,
         entities = EXCLUDED.entities,
         updated_at = NOW()`,
      [
        clientId,
        article.id,
        article.title,
        article.word_count,
        article.seo_score,
        article.tags || [],
        entities,
        article.status === 'published' ? new Date() : null,
      ]
    );
  }

  async getArticleHistory(clientId: string, limit = 20): Promise<ArticleMemory[]> {
    const pool = this.getPool();
    const result = await pool.query(
      `SELECT * FROM article_memory WHERE client_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [clientId, limit]
    );
    return result.rows.map(r => ({
      id: r.id,
      client_id: r.client_id,
      article_id: r.article_id,
      title: r.title,
      word_count: r.word_count,
      seo_score: r.seo_score,
      read_time_seconds: r.read_time_seconds,
      traffic_estimate: r.traffic_estimate,
      keywords: r.keywords || [],
      entities: r.entities || [],
      published_at: r.published_at,
      created_at: r.created_at,
    }));
  }

  // ── Knowledge Graph ─────────────────────────

  async storeEntity(entity: Omit<KnowledgeGraphEntity, 'id' | 'created_at'>): Promise<string> {
    const pool = this.getPool();
    const result = await pool.query(
      `INSERT INTO knowledge_graph_entities (client_id, entity_name, entity_type,
        description, metadata, source, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (client_id, entity_name) DO UPDATE SET
         entity_type = EXCLUDED.entity_type,
         description = COALESCE(EXCLUDED.description, knowledge_graph_entities.description),
         confidence = GREATEST(knowledge_graph_entities.confidence, EXCLUDED.confidence),
         updated_at = NOW()
       RETURNING id`,
      [
        entity.client_id,
        entity.entity_name,
        entity.entity_type,
        entity.description || null,
        JSON.stringify(entity.metadata),
        entity.source,
        entity.confidence,
      ]
    );
    return result.rows[0].id;
  }

  async storeRelationship(
    rel: Omit<KnowledgeGraphRelationship, 'id' | 'created_at'>
  ): Promise<string> {
    const pool = this.getPool();
    const result = await pool.query(
      `INSERT INTO knowledge_graph_relationships (client_id, source_entity_id, target_entity_id,
        relationship_type, strength, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id, source_entity_id, target_entity_id, relationship_type)
       DO UPDATE SET strength = GREATEST(knowledge_graph_relationships.strength, EXCLUDED.strength),
                     updated_at = NOW()
       RETURNING id`,
      [
        rel.client_id,
        rel.source_entity_id,
        rel.target_entity_id,
        rel.relationship_type,
        rel.strength,
        JSON.stringify(rel.metadata),
      ]
    );
    return result.rows[0].id;
  }

  async findRelatedEntities(
    clientId: string,
    entityName: string,
    limit = 10
  ): Promise<Array<{ entity: KnowledgeGraphEntity; relation: string; strength: number }>> {
    const pool = this.getPool();
    const result = await pool.query(
      `SELECT e.*, r.relationship_type, r.strength
       FROM knowledge_graph_entities e
       JOIN knowledge_graph_relationships r ON r.target_entity_id = e.id OR r.source_entity_id = e.id
       WHERE e.client_id = $1
         AND e.entity_name ILIKE $2
       ORDER BY r.strength DESC
       LIMIT $3`,
      [clientId, `%${entityName}%`, limit]
    );
    return result.rows.map(r => ({
      entity: r,
      relation: r.relationship_type,
      strength: r.strength,
    }));
  }

  async getEntityGraph(clientId: string): Promise<{
    entities: KnowledgeGraphEntity[];
    relations: KnowledgeGraphRelationship[];
  }> {
    const pool = this.getPool();
    const [entities, relations] = await Promise.all([
      pool.query(
        'SELECT * FROM knowledge_graph_entities WHERE client_id = $1 ORDER BY confidence DESC',
        [clientId]
      ),
      pool.query(
        'SELECT * FROM knowledge_graph_relationships WHERE client_id = $1 ORDER BY strength DESC',
        [clientId]
      ),
    ]);
    return {
      entities: entities.rows,
      relations: relations.rows,
    };
  }

  private async extractEntityNames(content: string): Promise<string[]> {
    const words = content.split(/\s+/);
    const candidates = new Set<string>();
    let i = 0;
    while (i < words.length - 1) {
      const w = words[i].replace(/[^a-zA-Z]/g, '');
      const next = words[i + 1]?.replace(/[^a-zA-Z]/g, '');
      // Detect capitalized multi-word phrases (likely entities)
      if (w.length >= 3 && /^[A-Z]/.test(w) && next && /^[A-Z]/.test(next)) {
        candidates.add(`${w} ${next}`);
      }
      i++;
    }
    return Array.from(candidates).slice(0, 20);
  }

  // ── Performance ─────────────────────────────

  async recordPerformance(
    clientId: string,
    metrics: {
      article_id: string;
      read_time_seconds?: number;
      traffic_estimate?: number;
    }
  ): Promise<void> {
    const pool = this.getPool();
    await pool.query(
      `UPDATE article_memory
       SET read_time_seconds = COALESCE($2, read_time_seconds),
           traffic_estimate = COALESCE($3, traffic_estimate),
           updated_at = NOW()
       WHERE client_id = $1 AND article_id = $4`,
      [
        clientId,
        metrics.read_time_seconds || null,
        metrics.traffic_estimate || null,
        metrics.article_id,
      ]
    );
  }

  // ── Stats ───────────────────────────────────

  async getStats(): Promise<GlobalMemoryStats> {
    const pool = this.getPool();
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM clients WHERE is_active = true) as total_sites,
        (SELECT COUNT(*) FROM articles) as total_articles,
        (SELECT COUNT(*) FROM knowledge_graph_entities) as total_entities,
        (SELECT COUNT(*) FROM knowledge_graph_relationships) as total_relations,
        (SELECT COUNT(*) FROM articles WHERE created_at >= NOW() - INTERVAL '24 hours') as articles_24h
    `);
    return result.rows[0];
  }

  private mapSite(row: any): SiteMemory {
    return {
      client_id: row.client_id,
      site_name: row.site_name,
      site_url: row.slug || '',
      site_description: row.site_description || '',
      brand_voice: row.brand_voice || null,
      categories: (row.settings?.categories as string[]) || [],
      settings: row.settings || {},
      article_count: parseInt(row.article_count) || 0,
      last_article_at: row.last_article_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export default new GlobalMemoryService();
