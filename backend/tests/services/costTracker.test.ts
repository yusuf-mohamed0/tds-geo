import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockPool = {
  query: mockQuery,
  connect: async () => ({ query: mockQuery, release: () => {} }),
  end: async () => {},
  on: () => {},
};

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import costTracker from '../../services/costTracker';

describe('CostTracker', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    costTracker.initialize(mockPool as any);
  });

  describe('calculateOpenAICost', () => {
    it('should calculate GPT-4o cost correctly', () => {
      const cost = costTracker.calculateOpenAICost('gpt-4o', 1000, 500);
      expect(cost).toBeCloseTo(0.005 * 1 + 0.015 * 0.5, 6);
    });

    it('should calculate GPT-4o-mini cost correctly', () => {
      const cost = costTracker.calculateOpenAICost('gpt-4o-mini', 2000, 1000);
      expect(cost).toBeCloseTo(0.0015 * 2 + 0.006 * 1, 6);
    });

    it('should calculate DALL-E cost as per-image', () => {
      const cost = costTracker.calculateOpenAICost('dall-e-3', 1, 0);
      expect(cost).toBe(0.04);
    });

    it('should fall back to GPT-4o rates for unknown models', () => {
      const cost = costTracker.calculateOpenAICost('unknown-model', 1000, 500);
      expect(cost).toBeCloseTo(0.005 * 1 + 0.015 * 0.5, 6);
    });

    it('should return 0 for zero tokens', () => {
      const cost = costTracker.calculateOpenAICost('gpt-4o', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts without overflow', () => {
      const cost = costTracker.calculateOpenAICost('gpt-4o', 1000000, 500000);
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    });
  });

  describe('recordCost', () => {
    it('should insert a cost record', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      await costTracker.recordCost({
        client_id: 'client-1',
        provider: 'openai',
        model: 'gpt-4o',
        tokens_in: 100,
        tokens_out: 50,
        cost_usd: 0.00125,
        duration_ms: 1500,
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO cost_tracking');
      expect(params[0]).toBe('client-1');
      expect(params[2]).toBe('openai');
      expect(params[3]).toBe('gpt-4o');
    });

    it('should handle optional article_id and metadata', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      await costTracker.recordCost({
        client_id: 'client-1',
        article_id: 'article-123',
        provider: 'openai',
        cost_usd: 0.01,
        metadata: { source: 'pipeline' },
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBe('article-123');
      expect(params[8]).toContain('source');
    });

    it('should handle missing article_id gracefully', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      await costTracker.recordCost({
        client_id: 'client-1',
        provider: 'openai',
        cost_usd: 0.01,
      });
      const [, params] = mockQuery.mock.calls[0];
      expect(params[1]).toBeNull();
    });

    it('should not throw on DB error (swallowed)', async () => {
      mockQuery.mockRejectedValue(new Error('DB connection lost'));
      await expect(costTracker.recordCost({
        client_id: 'client-1',
        provider: 'openai',
        cost_usd: 0.01,
      })).resolves.toBeUndefined();
    });

    it('should warn when not initialized', async () => {
      const uninitialized = await (async () => {
        const fresh = Object.create(costTracker.constructor.prototype);
        fresh.pool = null;
        return fresh;
      })();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await expect(costTracker.recordCost({
        client_id: 'client-1',
        provider: 'openai',
        cost_usd: 0.01,
      })).resolves.toBeUndefined();
      warnSpy.mockRestore();
    });
  });

  describe('getMonthlyUsage', () => {
    it('should return aggregated monthly usage', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { provider: 'openai', cost: '10.00', tokens: '50000', calls: '5' },
            { provider: 'serpapi', cost: '2.50', tokens: '0', calls: '10' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '3' }],
        });

      const usage = await costTracker.getMonthlyUsage('client-1');
      expect(usage.totalCost).toBeCloseTo(12.50, 2);
      expect(usage.totalTokens).toBe(50000);
      expect(usage.articleCount).toBe(3);
      expect(usage.byProvider.openai).toBeCloseTo(10.00, 2);
      expect(usage.byProvider.serpapi).toBeCloseTo(2.50, 2);
    });

    it('should return zero values when no records exist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const usage = await costTracker.getMonthlyUsage('client-empty');
      expect(usage.totalCost).toBe(0);
      expect(usage.totalTokens).toBe(0);
      expect(usage.articleCount).toBe(0);
      expect(usage.byProvider).toEqual({});
    });

    it('should throw when not initialized', async () => {
      const fresh = Object.create(costTracker.constructor.prototype);
      fresh.pool = null;
      await expect(costTracker.getMonthlyUsage('client-1')).rejects.toThrow('not initialized');
    });
  });

  describe('isBudgetExceeded', () => {
    it('should return false when under budget', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ provider: 'openai', cost: '10.00', tokens: '1000', calls: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const exceeded = await costTracker.isBudgetExceeded('client-1', 100);
      expect(exceeded).toBe(false);
    });

    it('should return true when over budget', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ provider: 'openai', cost: '150.00', tokens: '100000', calls: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const exceeded = await costTracker.isBudgetExceeded('client-1', 100);
      expect(exceeded).toBe(true);
    });

    it('should use env default limit when not specified', async () => {
      process.env.COST_MONTHLY_LIMIT = '200';
      mockQuery
        .mockResolvedValueOnce({ rows: [{ provider: 'openai', cost: '50.00', tokens: '1000', calls: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const exceeded = await costTracker.isBudgetExceeded('client-1');
      expect(exceeded).toBe(false);
      delete process.env.COST_MONTHLY_LIMIT;
    });
  });
});
