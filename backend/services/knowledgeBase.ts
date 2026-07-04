// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import vectorMemoryService from './vectorMemory';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export interface DocumentChunk {
  content: string;
  index: number;
}

export class KnowledgeBaseService {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
  }

  private getPool(): Pool {
    if (!this.pool) throw new Error('KnowledgeBaseService not initialized');
    return this.pool;
  }

  // ─── Knowledge Base CRUD ─────────────────────

  async createBase(clientId: string, name: string, description?: string): Promise<any> {
    const result = await this.getPool().query(
      `INSERT INTO knowledge_bases (client_id, name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [clientId, name, description || '']
    );
    return result.rows[0];
  }

  async listBases(clientId: string): Promise<any[]> {
    const result = await this.getPool().query(
      'SELECT * FROM knowledge_bases WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );
    return result.rows;
  }

  async deleteBase(id: string, clientId: string): Promise<boolean> {
    const result = await this.getPool().query(
      'DELETE FROM knowledge_bases WHERE id = $1 AND client_id = $2',
      [id, clientId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ─── Document Management ─────────────────────

  async storeDocument(
    kbId: string,
    clientId: string,
    filename: string,
    content: string,
    fileType?: string
  ): Promise<any> {
    const result = await this.getPool().query(
      `INSERT INTO kb_documents (knowledge_base_id, client_id, filename, file_type, file_size, content, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [kbId, clientId, filename, fileType || 'text', content.length, content]
    );
    return result.rows[0];
  }

  async listDocuments(kbId: string): Promise<any[]> {
    const result = await this.getPool().query(
      'SELECT id, filename, file_type, file_size, chunk_count, status, created_at, updated_at FROM kb_documents WHERE knowledge_base_id = $1 ORDER BY created_at DESC',
      [kbId]
    );
    return result.rows;
  }

  async deleteDocument(id: string, clientId: string): Promise<boolean> {
    // Clean up embeddings first
    await this.getPool().query(
      'DELETE FROM content_embeddings WHERE kb_document_id = $1',
      [id]
    );
    const result = await this.getPool().query(
      'DELETE FROM kb_documents WHERE id = $1 AND client_id = $2',
      [id, clientId]
    );
    return (result.rowCount || 0) > 0;
  }

  // ─── Chunking ────────────────────────────────

  chunkDocument(content: string, strategy: string = 'semantic'): DocumentChunk[] {
    if (strategy === 'paragraph') return this.chunkByParagraph(content);
    if (strategy === 'fixed') return this.chunkByFixed(content);
    return this.chunkSemantic(content);
  }

  private chunkByParagraph(content: string): DocumentChunk[] {
    return content.split(/\n\s*\n/).filter(p => p.trim().length > 20).map((p, i) => ({
      content: p.trim(),
      index: i,
    }));
  }

  private chunkByFixed(content: string): DocumentChunk[] {
    const words = content.split(/\s+/);
    const chunks: DocumentChunk[] = [];
    let i = 0;
    while (i < words.length) {
      const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
      chunks.push({ content: chunk, index: chunks.length });
      i += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
  }

  private chunkSemantic(content: string): DocumentChunk[] {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const para of paragraphs) {
      const wordCount = (currentChunk + ' ' + para).split(/\s+/).length;
      if (wordCount > CHUNK_SIZE && currentChunk) {
        chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
        // Overlap: keep last ~50 words
        const words = currentChunk.split(/\s+/);
        currentChunk = words.slice(-CHUNK_OVERLAP).join(' ') + ' ' + para;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + para;
      }
    }
    if (currentChunk.trim()) {
      chunks.push({ content: currentChunk.trim(), index: chunkIndex });
    }
    return chunks;
  }

  // ─── Embed + Store Chunks ────────────────────

  async processDocument(docId: string): Promise<void> {
    const doc = await this.getPool().query(
      'SELECT * FROM kb_documents WHERE id = $1',
      [docId]
    );
    if (!doc.rows.length) return;

    const { id, knowledge_base_id, client_id, content } = doc.rows[0];

    await this.getPool().query(
      'UPDATE kb_documents SET status = $1 WHERE id = $2',
      ['processing', id]
    );

    try {
      const kb = await this.getPool().query(
        'SELECT chunk_strategy FROM knowledge_bases WHERE id = $1',
        [knowledge_base_id]
      );
      const strategy = kb.rows[0]?.chunk_strategy || 'semantic';
      const chunks = this.chunkDocument(content, strategy);

      // Generate embeddings for each chunk and store
      for (const chunk of chunks) {
        let embedding: number[] | null = null;
        try {
          embedding = await vectorMemoryService.generateEmbedding(chunk.content);
        } catch {
          // Graceful degradation without embeddings
        }

        await this.getPool().query(
          `INSERT INTO content_embeddings (client_id, article_id, chunk_index, content_chunk, embedding, source, kb_document_id, metadata)
           VALUES ($1, NULL, $2, $3, $4::vector, 'kb_document', $5, $6)`,
          [
            client_id,
            chunk.index,
            chunk.content,
            embedding ? `[${embedding.join(',')}]` : null,
            id,
            JSON.stringify({ filename: doc.rows[0].filename }),
          ]
        );
      }

      await this.getPool().query(
        'UPDATE kb_documents SET status = $1, chunk_count = $2 WHERE id = $3',
        ['ready', chunks.length, id]
      );
      logger.info('Knowledge base document processed', { docId: id, chunks: chunks.length });
    } catch (err: any) {
      await this.getPool().query(
        'UPDATE kb_documents SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', err.message, id]
      );
      logger.error('Knowledge base document processing failed', { docId: id, error: err.message });
    }
  }

  // ─── RAG Recall ─────────────────────────────

  async findRelevantContent(
    clientId: string,
    query: string,
    limit: number = 5
  ): Promise<{ content: string; score: number; source: string }[]> {
    // Try vector similarity search first
    try {
      const queryEmbedding = await vectorMemoryService.generateEmbedding(query);
      if (queryEmbedding) {
        const result = await this.getPool().query(
          `SELECT content_chunk, 1 - (embedding <=> $1::vector) as score, source
           FROM content_embeddings
           WHERE client_id = $2
             AND (source = 'kb_document' OR source = 'article')
           ORDER BY embedding <=> $1::vector
           LIMIT $3`,
          [`[${queryEmbedding.join(',')}]`, clientId, limit]
        );
        if (result.rows.length > 0) {
          return result.rows.map(r => ({
            content: r.content_chunk,
            score: Math.round((r.score || 0) * 100),
            source: r.source,
          }));
        }
      }
    } catch {
      // Fallback to text search
    }

    // Text search fallback
    const result = await this.getPool().query(
      `SELECT content_chunk, source
       FROM content_embeddings
       WHERE client_id = $1
         AND content_chunk ILIKE $2
       LIMIT $3`,
      [clientId, `%${query.split(' ').filter(w => w.length > 3).join('%')}%`, limit]
    );
    return result.rows.map(r => ({
      content: r.content_chunk,
      score: 50,
      source: r.source,
    }));
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
export default knowledgeBaseService;
