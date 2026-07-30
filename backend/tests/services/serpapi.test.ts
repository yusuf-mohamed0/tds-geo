import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios');
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import axios from 'axios';
import serpapiService from '../../services/serpapi';

const mockAxiosGet = vi.mocked(axios.get);

describe('SerpApiService', () => {
  beforeEach(() => {
    mockAxiosGet.mockReset();
    process.env.SERPAPI_API_KEY = 'test-api-key';
  });

  describe('isConfigured', () => {
    it('should return true when API key is set', () => {
      expect(serpapiService.isConfigured()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      delete process.env.SERPAPI_API_KEY;
      expect(serpapiService.isConfigured()).toBe(false);
    });
  });

  describe('getKeywordData', () => {
    it('should return formatted keyword data on success', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          search_volume: 1200,
          competition: 'MEDIUM',
          cpc: 2.50,
          related_keywords: ['kw1', 'kw2'],
        },
      });

      const result = await serpapiService.getKeywordData('plumbing services');
      expect(result.keyword).toBe('plumbing services');
      expect(result.search_volume).toBe(1200);
      expect(result.competition).toBe(0.5);
      expect(result.cpc).toBe(2.50);
      expect(result.related_keywords).toEqual(['kw1', 'kw2']);
    });

    it('should throw when API key is not configured', async () => {
      delete process.env.SERPAPI_API_KEY;
      await expect(serpapiService.getKeywordData('test')).rejects.toThrow('not configured');
    });

    it('should handle zero search volume gracefully', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { search_volume: null, competition: null, cpc: null },
      });

      const result = await serpapiService.getKeywordData('rare term');
      expect(result.search_volume).toBe(0);
      expect(result.competition).toBe(0.5);
      expect(result.cpc).toBe(0);
    });

    it('should throw on API error', async () => {
      mockAxiosGet.mockRejectedValue(new Error('API rate limit exceeded'));
      await expect(serpapiService.getKeywordData('test')).rejects.toThrow('API rate limit exceeded');
    });

    it('should map competition strings to numeric values', async () => {
      mockAxiosGet.mockResolvedValue({ data: { competition: 'HIGH' } });
      const high = await serpapiService.getKeywordData('competitive term');
      expect(high.competition).toBe(0.8);

      mockAxiosGet.mockResolvedValue({ data: { competition: 'LOW' } });
      const low = await serpapiService.getKeywordData('low comp term');
      expect(low.competition).toBe(0.2);
    });
  });

  describe('getBulkKeywordData', () => {
    it('should fetch data for multiple keywords sequentially', async () => {
      mockAxiosGet.mockResolvedValue({
        data: { search_volume: 500, competition: 'LOW', cpc: 1.00 },
      });

      const results = await serpapiService.getBulkKeywordData(['kw1', 'kw2', 'kw3']);
      expect(results).toHaveLength(3);
      expect(results[0].keyword).toBe('kw1');
      expect(results[2].keyword).toBe('kw3');
      expect(mockAxiosGet).toHaveBeenCalledTimes(3);
    });

    it('should skip individual failures and continue', async () => {
      mockAxiosGet
        .mockResolvedValueOnce({ data: { search_volume: 100, competition: 'LOW', cpc: 0.50 } })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ data: { search_volume: 200, competition: 'MEDIUM', cpc: 1.00 } });

      const results = await serpapiService.getBulkKeywordData(['kw1', 'kw2', 'kw3']);
      expect(results).toHaveLength(2);
      expect(results[0].keyword).toBe('kw1');
      expect(results[1].keyword).toBe('kw3');
    });

    it('should return empty array for empty input', async () => {
      const results = await serpapiService.getBulkKeywordData([]);
      expect(results).toEqual([]);
    });
  });

  describe('getTrendData', () => {
    it('should return trend interest and related queries', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          interest_over_time: {
            timeline_data: [
              { value: [65] },
              { value: [70] },
              { value: [75] },
            ],
          },
          related_queries: {
            top: { queries: [{ query: 'related term' }] },
          },
        },
      });

      const trend = await serpapiService.getTrendData('test keyword');
      expect(trend.interest).toBeGreaterThanOrEqual(0);
      expect(trend.interest).toBeLessThanOrEqual(100);
      expect(trend.related).toContain('related term');
    });

    it('should return defaults on API failure', async () => {
      mockAxiosGet.mockRejectedValue(new Error('Network error'));
      const trend = await serpapiService.getTrendData('test');
      expect(trend.interest).toBe(50);
      expect(trend.related).toEqual([]);
    });

    it('should return defaults when API key is missing', async () => {
      delete process.env.SERPAPI_API_KEY;
      const trend = await serpapiService.getTrendData('test');
      expect(trend.interest).toBe(50);
      expect(trend.related).toEqual([]);
    });
  });
});
