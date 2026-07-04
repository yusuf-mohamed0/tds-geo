// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Advanced Content Intelligence Service
// Semantic duplicate detection, cannibalization detection,
// topic saturation analysis, knowledge graph, entity mapping
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import openaiService from './openai';
import vectorMemory from './vectorMemory';
import {
  KnowledgeGraphEntity, KnowledgeGraphRelationship,
  ContentCannibalization, TopicSaturation
} from '../types';

class ContentIntelligenceService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Content Intelligence Service initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // CANNIBALIZATION DETECTION
  // ══════════════════════════════════════════════════════════════

  async detectCannibalization(
    clientId: string,
    articleId: string,
    articleTitle: string,
    articleContent: string
  ): Promise<ContentCannibalization[]> {
    if (!this.pool) return [];

    // Get all other active articles for this client
    const existingArticles = await this.pool.query(
      `SELECT id, title, content_md, keyword_id FROM articles
       WHERE client_id = $1 AND id != $2 AND status != 'archived' AND status != 'failed'`,
      [clientId, articleId]
    );

    if (existingArticles.rows.length === 0) return [];

    const cannibalizationResults: ContentCannibalization[] = [];
    const baseWords = articleContent.toLowerCase().split(/\s+/);
    const baseWordSet = new Set<string>(baseWords);

    for (const existing of existingArticles.rows) {
      const existingContent = existing.content_md || '';
      const existingWords = existingContent.toLowerCase().split(/\s+/);
      const existingWordSet = new Set<string>(existingWords);

      // Jaccard similarity
      const intersection = new Set(Array.from(baseWordSet).filter(w => existingWordSet.has(w) && w.length > 2));
      const union = new Set([...Array.from(baseWordSet), ...Array.from(existingWordSet)].filter(w => w.length > 2));

      const similarity = union.size > 0 ? intersection.size / union.size : 0;

      if (similarity > 0.4) {
        // Determine overlap type via LLM
        const overlapType = await this.classifyOverlap(articleTitle, existing.title);

        const cannibalization: ContentCannibalization = {
          id: '',
          client_id: clientId,
          article_a_id: articleId,
          article_b_id: existing.id,
          similarity_score: parseFloat(similarity.toFixed(2)),
          overlap_type: overlapType,
          overlap_details: {
            jaccardSimilarity: similarity,
            sharedTopics: [...intersection].slice(0, 10)
          },
          recommendation: similarity > 0.7 ? 'merge' : similarity > 0.5 ? 'differentiate' : 'monitor',
          detected_at: new Date(),
          resolved_at: undefined
        };

        cannibalizationResults.push(cannibalization);

        // Store in DB
        try {
          await this.pool.query(
            `INSERT INTO content_cannibalization (client_id, article_a_id, article_b_id, similarity_score, overlap_type, overlap_details, recommendation)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (article_a_id, article_b_id) DO UPDATE
             SET similarity_score = $4, overlap_type = $5, overlap_details = $6, recommendation = $7, resolved_at = NULL`,
            [clientId, articleId, existing.id, similarity, overlapType,
             JSON.stringify(cannibalization.overlap_details), cannibalization.recommendation]
          );
        } catch (err) {
          logger.warn('Failed to store cannibalization record', { error: (err as Error).message });
        }
      }
    }

    logger.info(`Cannibalization check complete for article ${articleId}: ${cannibalizationResults.length} overlaps found`);
    return cannibalizationResults;
  }

  private async classifyOverlap(titleA: string, titleB: string): Promise<'keyword' | 'topic' | 'entity' | 'semantic'> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `Given two article titles, classify the type of overlap.
Respond with ONE word only: "keyword", "topic", "entity", or "semantic".`
        },
        {
          role: 'user',
          content: `Title A: "${titleA}"\nTitle B: "${titleB}"`
        }
      ], { temperature: 0.1 });

      if (result && ['keyword', 'topic', 'entity', 'semantic'].includes(result.trim().toLowerCase())) {
        return result.trim().toLowerCase() as any;
      }
    } catch { /* noop */ }
    return 'semantic';
  }

  // ══════════════════════════════════════════════════════════════
  // TOPIC SATURATION ANALYSIS
  // ══════════════════════════════════════════════════════════════

  async analyzeTopicSaturation(clientId: string, topic: string): Promise<TopicSaturation> {
    if (!this.pool) {
      return { id: '', client_id: clientId, topic, article_count: 0, saturation_score: 0, recommendation: 'continue', created_at: new Date() };
    }

    // Find articles related to this topic
    const articles = await this.pool.query(
      `SELECT id, title, tags, created_at FROM articles
       WHERE client_id = $1
         AND (title ILIKE $2 OR $3 = ANY(tags))
         AND status NOT IN ('archived', 'failed')`,
      [clientId, `%${topic}%`, topic]
    );

    const articleCount = articles.rows.length;
    const lastArticleAt = articleCount > 0 ? articles.rows[0].created_at : undefined;

    // Saturation score based on article count and recency
    const saturationScore = Math.min(100, Math.round((articleCount / 10) * 100));

    let recommendation: 'continue' | 'reduce' | 'stop' | 'diversify' = 'continue';
    if (saturationScore > 80) recommendation = 'stop';
    else if (saturationScore > 60) recommendation = 'reduce';
    else if (articleCount > 3) recommendation = 'diversify';

    // Store in DB
    try {
      await this.pool.query(
        `INSERT INTO topic_saturation (client_id, topic, article_count, saturation_score, last_article_at, recommendation)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (client_id, topic) DO UPDATE
         SET article_count = $3, saturation_score = $4, last_article_at = $5, recommendation = $6`,
        [clientId, topic, articleCount, saturationScore, lastArticleAt, recommendation]
      );
    } catch (err) {
      logger.warn('Failed to store topic saturation', { error: (err as Error).message });
    }

    return {
      id: '',
      client_id: clientId,
      topic,
      article_count: articleCount,
      saturation_score: saturationScore,
      last_article_at: lastArticleAt,
      recommendation,
      created_at: new Date()
    };
  }

  async getSaturatedTopics(clientId: string): Promise<TopicSaturation[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT * FROM topic_saturation
       WHERE client_id = $1 AND recommendation IN ('reduce', 'stop')
       ORDER BY saturation_score DESC`,
      [clientId]
    );
    return result.rows;
  }

  // ══════════════════════════════════════════════════════════════
  // KNOWLEDGE GRAPH MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async extractEntities(content: string, clientId: string): Promise<KnowledgeGraphEntity[]> {
    try {
      const result = await openaiService.chat([
        {
          role: 'system',
          content: `You are a knowledge graph entity extractor.
Extract key entities, concepts, and terms from the content that would be useful for SEO topical authority.

Respond with a JSON array:
[{"name": "entity name", "type": "CONCEPT|TERM|LOCATION|ORGANIZATION|PERSON|PRODUCT|SERVICE", "description": "brief description", "confidence": 0.0-1.0}]`
        },
        {
          role: 'user',
          content: content.slice(0, 8000)
        }
      ], { temperature: 0.2 });

      if (result) {
        const entities = JSON.parse(result);
        if (Array.isArray(entities)) {
          const stored: KnowledgeGraphEntity[] = [];
          for (const entity of entities) {
            const e = await this.storeEntity({
              client_id: clientId,
              entity_name: entity.name,
              entity_type: entity.type,
              description: entity.description,
              source: 'extracted',
              confidence: entity.confidence || 0.5
            });
            stored.push(e);
          }
          return stored;
        }
      }
    } catch (err) {
      logger.warn('Entity extraction failed', { error: (err as Error).message });
    }
    return [];
  }

  async storeEntity(entity: {
    client_id: string;
    entity_name: string;
    entity_type: string;
    description?: string;
    source: string;
    confidence: number;
  }): Promise<KnowledgeGraphEntity> {
    if (!this.pool) throw new Error('ContentIntelligence not initialized');
    const result = await this.pool.query(
      `INSERT INTO knowledge_graph_entities (client_id, entity_name, entity_type, description, source, confidence)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id, entity_name)
       DO UPDATE SET description = COALESCE($4, knowledge_graph_entities.description),
                     entity_type = CASE WHEN knowledge_graph_entities.entity_type = 'CONCEPT' THEN $3 ELSE knowledge_graph_entities.entity_type END,
                     confidence = GREATEST(knowledge_graph_entities.confidence, $6)
       RETURNING *`,
      [entity.client_id, entity.entity_name, entity.entity_type, entity.description || null, entity.source, entity.confidence]
    );
    return result.rows[0];
  }

  async createRelationship(rel: {
    clientId: string;
    sourceEntityId: string;
    targetEntityId: string;
    relationshipType: string;
    strength: number;
  }): Promise<KnowledgeGraphRelationship> {
    if (!this.pool) throw new Error('ContentIntelligence not initialized');

    const result = await this.pool.query(
      `INSERT INTO knowledge_graph_relationships (client_id, source_entity_id, target_entity_id, relationship_type, strength, metadata)
       VALUES ($1, $2, $3, $4, $5, '{}')
       ON CONFLICT (source_entity_id, target_entity_id, relationship_type)
       DO UPDATE SET strength = LEAST(1.0, knowledge_graph_relationships.strength + 0.1)
       RETURNING *`,
      [rel.clientId, rel.sourceEntityId, rel.targetEntityId, rel.relationshipType, rel.strength]
    );
    return result.rows[0];
  }

  async getKnowledgeGraph(clientId: string): Promise<{
    entities: KnowledgeGraphEntity[];
    relationships: KnowledgeGraphRelationship[];
  }> {
    if (!this.pool) return { entities: [], relationships: [] };
    const [entities, relationships] = await Promise.all([
      this.pool.query(
        'SELECT * FROM knowledge_graph_entities WHERE client_id = $1 ORDER BY confidence DESC LIMIT 200',
        [clientId]
      ),
      this.pool.query(
        'SELECT * FROM knowledge_graph_relationships WHERE client_id = $1 ORDER BY strength DESC LIMIT 500',
        [clientId]
      )
    ]);
    return { entities: entities.rows, relationships: relationships.rows };
  }

  // ══════════════════════════════════════════════════════════════
  // INTERNAL LINKING INTELLIGENCE
  // ══════════════════════════════════════════════════════════════

  async findLinkingOpportunities(
    clientId: string,
    content: string,
    excludeArticleId?: string
  ): Promise<Array<{
    targetArticleId: string;
    targetTitle: string;
    reason: string;
    anchorText: string;
    relevance: number;
  }>> {
    if (!this.pool) return [];

    const articles = await this.pool.query(
      `SELECT id, title, content_md, tags FROM articles
       WHERE client_id = $1 AND id != $2 AND status = 'published'
       ORDER BY created_at DESC
       LIMIT 50`,
      [clientId, excludeArticleId || '']
    );

    const opportunities: Array<{
      targetArticleId: string;
      targetTitle: string;
      reason: string;
      anchorText: string;
      relevance: number;
    }> = [];

    for (const article of articles.rows) {
      const title: string = (article.title || '').toLowerCase();
      const words = title.split(/\s+/).filter((w: string) => w.length > 3);

      // Check if any meaningful words from the article title appear in the content
      const matches = words.filter((w: string) => content.toLowerCase().includes(w));
      if (matches.length >= 2) {
        opportunities.push({
          targetArticleId: article.id,
          targetTitle: article.title,
          reason: `Shared keywords: ${matches.join(', ')}`,
          anchorText: article.title,
          relevance: matches.length / words.length
        });
      }
    }

    return opportunities.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  }

  // ══════════════════════════════════════════════════════════════
  // ENTITY RELATIONSHIP MAPPING
  // ══════════════════════════════════════════════════════════════

  async buildContentGraph(articleId: string): Promise<{
    entities: KnowledgeGraphEntity[];
    relationships: KnowledgeGraphRelationship[];
  }> {
    if (!this.pool) return { entities: [], relationships: [] };

    // Get the article
    const article = await this.pool.query(
      'SELECT client_id, content_md, title FROM articles WHERE id = $1',
      [articleId]
    );

    if (article.rows.length === 0) return { entities: [], relationships: [] };
    const { client_id, content_md, title } = article.rows[0];

    // Extract entities from the article
    const allContent = `${title}\n\n${content_md || ''}`;
    const entities = await this.extractEntities(allContent, client_id);

    // Build relationships between entities found in this article
    const relationships: KnowledgeGraphRelationship[] = [];
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const rel = await this.createRelationship({
          clientId: client_id,
          sourceEntityId: entities[i].id || entities[i].entity_name,
          targetEntityId: entities[j].id || entities[j].entity_name,
          relationshipType: 'co_occurs_with',
          strength: 0.5
        });
        relationships.push(rel);
      }
    }

    return { entities, relationships };
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default new ContentIntelligenceService();
