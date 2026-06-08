// ──────────────────────────────────────────────
// Vector Memory / RAG Service
// Semantic dedup, similarity search, contextual memory
// Uses turbovec (Python) for fast vector search
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { SimilarityResult } from '../types';
import vectorStore from './vectorStoreClient';

const INDEX_NAME = 'content_embeddings';
const VECTOR_DIM = 1536;

/** In-memory mapping from turbovec vector ID → DB record location. */
interface IdMapEntry {
  articleId: string;
  chunkIndex: number;
}

class VectorMemoryService {
  private pool: Pool | null = null;
  private openai: OpenAI | null = null;
  private initialized = false;

  /** Maps turbovec vector IDs → articleId + chunkIndex for lookup after search. */
  private readonly idMapping = new Map<number, IdMapEntry>();
  private nextVecId = 1;

  initialize(poolOrConnectionString?: Pool | string): void {
    if (poolOrConnectionString instanceof Pool) {
      this.pool = poolOrConnectionString;
    } else {
      this.pool = new Pool({
        connectionString: poolOrConnectionString || process.env.DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 30000
      });
    }

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    logger.info('Vector memory service initialized (turbovec backend)');
  }

  private getPool(): Pool {
    if (!this.pool) this.initialize();
    return this.pool!;
  }

  /**
   * Ensure the turbovec index exists (lazy init).
   */
  private async ensureIndex(): Promise<void> {
    if (this.initialized) return;

    try {
      const healthy = await vectorStore.healthCheck();
      if (!healthy) {
        logger.warn('turbovec vector store not available — vector features disabled');
        return;
      }

      const indices = await vectorStore.listIndices();
      const exists = indices.some(i => i.name === INDEX_NAME);

      if (!exists) {
        await vectorStore.createIndex(INDEX_NAME, VECTOR_DIM, 4, true);
        logger.info('Created turbovec index', { name: INDEX_NAME, dim: VECTOR_DIM });
      }

      this.initialized = true;
    } catch (err) {
      logger.warn('Failed to initialize turbovec index', { error: (err as Error).message });
    }
  }

  /**
   * Generate embedding vector for text using OpenAI.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI not configured for embeddings');
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
      dimensions: VECTOR_DIM
    });

    return response.data[0].embedding;
  }

  /**
   * Store content chunk with its embedding in turbovec + DB fallback.
   */
  async storeChunk(
    clientId: string,
    articleId: string,
    chunkIndex: number,
    content: string
  ): Promise<void> {
    const pool = this.getPool();

    try {
      const embedding = await this.generateEmbedding(content);

      // Always store in PostgreSQL as JSONB
      await pool.query(
        `INSERT INTO content_embeddings (client_id, article_id, chunk_index, content_chunk, embedding)
         VALUES ($1, $2, $3, $4, ($5)::jsonb)
         ON CONFLICT DO NOTHING`,
        [clientId, articleId, chunkIndex, content, JSON.stringify(embedding)]
      );

      // Add to turbovec for fast vector search
      await this.ensureIndex();
      if (vectorStore.isHealthy) {
        const vecId = this.nextVecId++;
        this.idMapping.set(vecId, { articleId, chunkIndex });
        await vectorStore.addVectors(INDEX_NAME, [embedding], [vecId]);
      }
    } catch (err) {
      logger.warn('Failed to store embedding chunk', {
        articleId,
        chunkIndex,
        error: (err as Error).message
      });
    }
  }

  /**
   * Store all chunks of an article.
   */
  async storeArticleChunks(clientId: string, articleId: string, content: string): Promise<void> {
    const words = content.split(/\s+/);
    const chunkSize = 500;
    const overlap = 50;

    let count = 0;
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      const chunkIndex = Math.floor(i / (chunkSize - overlap));
      await this.storeChunk(clientId, articleId, chunkIndex, chunk);
      count++;
    }

    logger.info(`Stored ${count} embedding chunks for article`, { articleId });
  }

  /**
   * Find semantically similar content via turbovec (primary) or DB (fallback).
   */
  async findSimilar(
    clientId: string,
    content: string,
    threshold: number = 0.85,
    limit: number = 5
  ): Promise<SimilarityResult[]> {
    await this.ensureIndex();

    if (!vectorStore.isHealthy) {
      logger.warn('turbovec not available — skipping similarity search');
      return [];
    }

    try {
      const embedding = await this.generateEmbedding(content);
      const result = await vectorStore.search(INDEX_NAME, embedding, limit);

      if (!result.scores.length) return [];

      const pool = this.getPool();
      const results: SimilarityResult[] = [];

      for (let i = 0; i < result.scores.length; i++) {
        if (result.scores[i] < threshold) continue;

        const entry = this.idMapping.get(result.indices[i]);
        if (!entry) {
          // ID from a previous session (mapping lost on restart) — skip
          continue;
        }

        const dbResult = await pool.query(
          `SELECT content_chunk FROM content_embeddings
           WHERE article_id = $1 AND chunk_index = $2
           LIMIT 1`,
          [entry.articleId, entry.chunkIndex]
        );

        if (dbResult.rows.length > 0) {
          results.push({
            articleId: entry.articleId,
            chunkIndex: entry.chunkIndex,
            content: dbResult.rows[0].content_chunk,
            similarity: result.scores[i]
          });
        }
      }

      return results;
    } catch (err) {
      logger.warn('turbovec search failed, skipping similarity search', {
        error: (err as Error).message
      });
      return [];
    }
  }

  /**
   * Check if content is semantically duplicate of existing articles.
   */
  async isDuplicate(clientId: string, content: string, threshold: number = 0.92): Promise<boolean> {
    const similar = await this.findSimilar(clientId, content, threshold, 1);
    return similar.length > 0;
  }

  /**
   * Find related content for contextual retrieval.
   */
  async findRelated(clientId: string, query: string, limit: number = 3): Promise<SimilarityResult[]> {
    return this.findSimilar(clientId, query, 0.7, limit);
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export default new VectorMemoryService();
