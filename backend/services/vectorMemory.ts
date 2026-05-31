// ──────────────────────────────────────────────
// Vector Memory / RAG Service
// Semantic dedup, similarity search, contextual memory
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { SimilarityResult } from '../types';

class VectorMemoryService {
  private pool: Pool | null = null;
  private openai: OpenAI | null = null;
  private vectorAvailable: boolean | null = null; // null=untested, true/false=cached

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

    logger.info('Vector memory service initialized');
  }

  private getPool(): Pool {
    if (!this.pool) this.initialize();
    return this.pool!;
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
      dimensions: 1536
    });

    return response.data[0].embedding;
  }

  /**
   * Store content chunk with its embedding.
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

      // Store in database (requires pgvector extension)
      // Use a safe cast: if pgvector is not installed, the query will fail gracefully
      await pool.query(
        `INSERT INTO content_embeddings (client_id, article_id, chunk_index, content_chunk, embedding)
         VALUES ($1, $2, $3, $4, ($5)::vector)
         ON CONFLICT DO NOTHING`,
        [clientId, articleId, chunkIndex, content, JSON.stringify(embedding)]
      );
      this.vectorAvailable = true;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('type') || msg.includes('vector') || msg.includes('does not exist')) {
        this.vectorAvailable = false;
      }
      logger.warn('Failed to store embedding chunk', {
        articleId,
        chunkIndex,
        error: msg
      });
    }
  }

  /**
   * Store all chunks of an article.
   */
  async storeArticleChunks(clientId: string, articleId: string, content: string): Promise<void> {
    // Split content into chunks of ~500 words
    const words = content.split(/\s+/);
    const chunkSize = 500;
    const overlap = 50;

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      const chunkIndex = Math.floor(i / (chunkSize - overlap));
      await this.storeChunk(clientId, articleId, chunkIndex, chunk);
    }

    logger.info(`Stored ${Math.ceil(words.length / (chunkSize - overlap))} embedding chunks for article`, { articleId });
  }

  /**
   * Find semantically similar content.
   */
  async findSimilar(
    clientId: string,
    content: string,
    threshold: number = 0.85,
    limit: number = 5
  ): Promise<SimilarityResult[]> {
    // If vector is unavailable, return empty
    if (this.vectorAvailable === false) return [];

    const pool = this.getPool();

    try {
      const embedding = await this.generateEmbedding(content);
      const embeddingJson = JSON.stringify(embedding);

      // Cosine similarity search via pgvector
      const result = await pool.query(
        `SELECT ce.article_id, ce.chunk_index, ce.content_chunk,
                1 - (ce.embedding <=> $2::vector) as similarity
         FROM content_embeddings ce
         WHERE ce.client_id = $1
           AND 1 - (ce.embedding <=> $2::vector) > $3
         ORDER BY similarity DESC
         LIMIT $4`,
        [clientId, embeddingJson, threshold, limit]
      );

      return result.rows.map(row => ({
        articleId: row.article_id,
        chunkIndex: row.chunk_index,
        content: row.content_chunk,
        similarity: parseFloat(row.similarity)
      }));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('type') || msg.includes('vector') || msg.includes('does not exist')) {
        this.vectorAvailable = false;
      }
      logger.warn('Similarity search failed', { clientId, error: msg });
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
    if (this.pool) await this.pool.end();
  }
}

export default new VectorMemoryService();
