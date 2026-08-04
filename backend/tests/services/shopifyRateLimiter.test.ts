import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getQueue, resetShopifyQueues } from '../../services/shopify/client';

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function rateLimitedError(status: number, retryAfter?: string): any {
  const err: any = new Error(`HTTP ${status}`);
  err.response = {
    status,
    headers: retryAfter !== undefined ? { 'retry-after': retryAfter } : {},
  };
  return err;
}

/** Flush pending microtasks so queued promises settle deterministically. */
async function flushMicrotasks(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe('ShopifyRateLimitedQueue', () => {
  beforeEach(() => {
    resetShopifyQueues();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('queue behaviour', () => {
    it('returns a shared queue per shop', () => {
      expect(getQueue('shop-one')).toBe(getQueue('shop-one'));
      expect(getQueue('shop-one')).not.toBe(getQueue('shop-two'));
    });

    it('schedules work immediately when under the concurrency cap', async () => {
      const queue = getQueue('shop-immediate', { maxConcurrency: 2 });
      const fn = vi.fn(async () => ({ data: { ok: true }, headers: {} }));

      const result = await queue.schedule(fn);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: { ok: true }, headers: {} });
      expect(queue.inFlight).toBe(0);
      expect(queue.pendingCount).toBe(0);
    });

    it('queues bursts beyond max concurrency', async () => {
      const queue = getQueue('shop-burst', { maxConcurrency: 2 });
      const started: number[] = [];
      const gates: Array<() => void> = [];
      const makeTask = (name: number) => () => {
        started.push(name);
        return new Promise<void>((resolve) => {
          gates[name] = resolve;
        });
      };

      const promises = [0, 1, 2, 3, 4].map((i) => queue.schedule(makeTask(i)));

      // Only maxConcurrency tasks may be in flight; the rest queue up.
      expect(started).toEqual([0, 1]);
      expect(queue.inFlight).toBe(2);
      expect(queue.pendingCount).toBe(3);

      gates[0]();
      await flushMicrotasks();
      expect(started).toEqual([0, 1, 2]);

      gates[1]();
      await flushMicrotasks();
      expect(started).toEqual([0, 1, 2, 3]);

      gates[2]();
      gates[3]();
      await flushMicrotasks();
      expect(started).toEqual([0, 1, 2, 3, 4]);

      gates[4]();
      await Promise.all(promises);
      expect(queue.inFlight).toBe(0);
    });
  });

  describe('call-limit header adaptation', () => {
    it('throttles concurrency down when the bucket is nearly full', async () => {
      const queue = getQueue('shop-adapt', {
        maxConcurrency: 4,
        minConcurrency: 1,
        highWatermark: 0.75,
        lowWatermark: 0.4,
      });
      expect(queue.currentConcurrency).toBe(4);

      // 32/40 = 0.8 >= 0.75 -> halve concurrency to 2.
      await queue.schedule(async () => ({ data: {}, headers: { 'x-shopify-shop-api-call-limit': '32/40' } }));
      expect(queue.currentConcurrency).toBe(2);

      // With the ceiling lowered to 2, a burst of 3 only starts 2.
      const started: number[] = [];
      const gates: Array<() => void> = [];
      const tasks = [0, 1, 2].map((i) =>
        queue.schedule(() => {
          started.push(i);
          return new Promise<void>((resolve) => {
            gates[i] = resolve;
          });
        })
      );
      expect(started).toEqual([0, 1]);

      // Freeing one slot lets the third task start.
      gates[0]();
      await flushMicrotasks();
      expect(started).toEqual([0, 1, 2]);

      gates[1]();
      await flushMicrotasks();
      gates[2]();
      await Promise.all(tasks);
    });

    it('grows concurrency back when the bucket drains', async () => {
      const queue = getQueue('shop-grow', {
        maxConcurrency: 4,
        minConcurrency: 1,
        highWatermark: 0.75,
        lowWatermark: 0.4,
      });

      await queue.schedule(async () => ({ data: {}, headers: { 'x-shopify-shop-api-call-limit': '32/40' } }));
      expect(queue.currentConcurrency).toBe(2);

      // 8/40 = 0.2 <= 0.4 -> grow back toward the cap.
      await queue.schedule(async () => ({ data: {}, headers: { 'x-shopify-shop-api-call-limit': '8/40' } }));
      expect(queue.currentConcurrency).toBe(3);
    });
  });

  describe('429 retry handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('retries with exponential backoff and eventually succeeds', async () => {
      const queue = getQueue('shop-backoff', { maxRetries: 3, backoffBaseMs: 100 });
      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitedError(429))
        .mockRejectedValueOnce(rateLimitedError(429))
        .mockResolvedValueOnce({ data: { ok: true }, headers: {} });

      const promise = queue.schedule(fn);
      await flushMicrotasks();
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100); // backoff 100 * 2^0
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(200); // backoff 100 * 2^1
      expect(fn).toHaveBeenCalledTimes(3);

      await expect(promise).resolves.toEqual({ data: { ok: true }, headers: {} });
    });

    it('honors the Retry-After header before retrying', async () => {
      const queue = getQueue('shop-retryafter', { maxRetries: 3, backoffBaseMs: 50 });
      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitedError(429, '5'))
        .mockResolvedValueOnce({ data: { ok: true }, headers: {} });

      const promise = queue.schedule(fn);
      await flushMicrotasks();
      expect(fn).toHaveBeenCalledTimes(1);

      // Retry-After is 5s (5000ms) — the first 4s must not trigger a retry.
      await vi.advanceTimersByTimeAsync(4000);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000); // now at 5s
      expect(fn).toHaveBeenCalledTimes(2);

      await expect(promise).resolves.toEqual({ data: { ok: true }, headers: {} });
    });

    it('gives up after bounded retries and rejects', async () => {
      const queue = getQueue('shop-exhaust', { maxRetries: 2, backoffBaseMs: 100 });
      const fn = vi.fn().mockRejectedValue(rateLimitedError(429));

      // Attach a handler up-front so the eventual rejection is never unhandled.
      const outcome = queue.schedule(fn).then(
        () => ({ rejected: false }),
        (err: any) => ({ rejected: true, status: err?.response?.status })
      );
      await flushMicrotasks();

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);

      expect(await outcome).toEqual({ rejected: true, status: 429 });
      // 1 initial attempt + 2 retries (maxRetries = 2) = 3 total calls.
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not retry non-429 errors', async () => {
      const queue = getQueue('shop-bad', { maxRetries: 3 });
      const err = rateLimitedError(400);
      const fn = vi.fn().mockRejectedValue(err);

      await expect(queue.schedule(fn)).rejects.toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throttles concurrency down on a 429 and grows back after success', async () => {
      const queue = getQueue('shop-throttle', {
        maxConcurrency: 4,
        maxRetries: 2,
        backoffBaseMs: 100,
        highWatermark: 0.75,
        lowWatermark: 0.4,
      });
      expect(queue.currentConcurrency).toBe(4);

      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitedError(429))
        .mockResolvedValueOnce({ data: { ok: true }, headers: { 'x-shopify-shop-api-call-limit': '5/40' } });

      const promise = queue.schedule(fn);
      await flushMicrotasks();

      // Concurrency halved while Shopify pushes back.
      expect(queue.currentConcurrency).toBe(2);

      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBeTruthy();

      // 5/40 = 0.125 <= 0.4 -> grows back toward the cap.
      expect(queue.currentConcurrency).toBe(3);
    });
  });
});
