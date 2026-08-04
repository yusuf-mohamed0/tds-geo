import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchResult } from '../../services/vectorStoreClient';
import { SimilarityResult } from '../../types';

const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
  connect: async () => ({ query: mockQuery, release: () => {} }),
  end: async () => {},
  on: () => {},
} as any;

const {
  mockSearch,
  mockHealthCheck,
  mockIsHealthy,
  mockListIndices,
  mockCreateIndex,
  mockAddVectors,
} = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockHealthCheck: vi.fn(),
  mockIsHealthy: vi.fn(),
  mockListIndices: vi.fn(),
  mockCreateIndex: vi.fn(),
  mockAddVectors: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: Array.from({ length: 1536 }, (_, i) => i / 1536) }],
      }),
    },
  })),
}));

vi.mock('../../services/vectorStoreClient', () => ({
  default: {
    search: mockSearch,
    healthCheck: mockHealthCheck,
    isHealthy: true,
    listIndices: mockListIndices,
    createIndex: mockCreateIndex,
    addVectors: mockAddVectors,
    removeVector: vi.fn(),
    removeAll: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import vectorMemory from '../../services/vectorMemory';

describe('VectorMemoryService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSearch.mockReset();
    mockHealthCheck.mockReset();
    mockListIndices.mockReset();
    mockCreateIndex.mockReset();
    mockAddVectors.mockReset();
    process.env.OPENAI_API_KEY = 'sk-test';
    vectorMemory.initialize(mockPool as any);
    // initialize() creates a real Pool when the arg isn't a Pool instance,
    // so re-point the pool at the mock for tests that query the DB.
    (vectorMemory as any).pool = mockPool;
  });

  describe('generateEmbedding', () => {
    it('should return embedding vector of correct dimension', async () => {
      const embedding = await vectorMemory.generateEmbedding('test content');
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    });

    it('should handle empty text', async () => {
      const embedding = await vectorMemory.generateEmbedding('');
      expect(Array.isArray(embedding)).toBe(true);
    });
  });

  describe('storeChunk', () => {
    it('should store embedding and add vector', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      mockHealthCheck.mockResolvedValue(true);
      mockListIndices.mockResolvedValue([{ name: 'content_embeddings', dim: 1536, bit_width: 4, use_id_map: true, count: 0 }]);
      mockAddVectors.mockResolvedValue(1);

      await expect(vectorMemory.storeChunk('client-1', 'article-1', 0, 'chunk text')).resolves.toBeUndefined();
    });
  });

  describe('isDuplicate', () => {
    it('should return false when no similar content found', async () => {
      mockHealthCheck.mockResolvedValue(true);
      mockListIndices.mockResolvedValue([{ name: 'content_embeddings', dim: 1536, bit_width: 4, use_id_map: true, count: 0 }]);
      mockSearch.mockResolvedValue({ scores: [], indices: [] });

      const result = await vectorMemory.isDuplicate('client-1', 'test content');
      expect(result).toBe(false);
    });

    it('should return true when highly similar content exists', async () => {
      mockHealthCheck.mockResolvedValue(true);
      mockListIndices.mockResolvedValue([{ name: 'content_embeddings', dim: 1536, bit_width: 4, use_id_map: true, count: 0 }]);
      mockQuery.mockResolvedValue({ rows: [{ content_chunk: 'similar text' }] });
      mockSearch.mockResolvedValue({ scores: [0.95], indices: [1] });
      (vectorMemory as any).idMapping.set(1, { articleId: 'article-1', chunkIndex: 0 });

      const result = await vectorMemory.isDuplicate('client-1', 'test content');
      expect(result).toBe(true);
    });
  });

  describe('findSimilar', () => {
    it('should return similar articles', async () => {
      mockHealthCheck.mockResolvedValue(true);
      mockListIndices.mockResolvedValue([{ name: 'content_embeddings', dim: 1536, bit_width: 4, use_id_map: true, count: 0 }]);
      mockSearch.mockResolvedValue({ scores: [0.85, 0.72], indices: [1, 2] });
      mockQuery.mockResolvedValue({ rows: [{ content_chunk: 'test chunk' }] });

      const results = await vectorMemory.findSimilar('client-1', 'query text');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty when no matches found', async () => {
      mockHealthCheck.mockResolvedValue(true);
      mockListIndices.mockResolvedValue([{ name: 'content_embeddings', dim: 1536, bit_width: 4, use_id_map: true, count: 0 }]);
      mockSearch.mockResolvedValue({ scores: [], indices: [] });

      const results = await vectorMemory.findSimilar('client-1', 'unique text');
      expect(results).toEqual([]);
    });

    it('should filter results below threshold', async () => {
      mockHealthCheck.mockResolvedValue(true);
      mockListIndices.mockResolvedValue([{ name: 'content_embeddings', dim: 1536, bit_width: 4, use_id_map: true, count: 0 }]);
      mockSearch.mockResolvedValue({ scores: [0.5, 0.9], indices: [1, 2] });
      mockQuery.mockResolvedValue({ rows: [{ content_chunk: 'chunk' }] });

      const results = await vectorMemory.findSimilar('client-1', 'text', 0.85, 3);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('initialize', () => {
    it('should accept a Pool instance', () => {
      const fresh = Object.create(Object.getPrototypeOf(vectorMemory));
      expect(() => (vectorMemory as any).initialize(mockPool)).not.toThrow();
    });

    it('should lazy-initialize on getPool call', () => {
      const fresh = Object.create(Object.getPrototypeOf(vectorMemory));
      Object.assign(fresh, { pool: null, openai: null, initialized: false, idMapping: new Map(), nextVecId: 1 });
      expect(() => (fresh as any).getPool()).not.toThrow();
    });
  });
});
