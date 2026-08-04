// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import axios, { AxiosInstance } from 'axios';
import { ShopifyConfig } from '../../types';
import { logger } from '../../utils/logger';

export function buildClient(shopConfig: ShopifyConfig): { client: AxiosInstance; shopName: string } {
  const shop = shopConfig.shop || process.env.SHOPIFY_DEFAULT_SHOP || '';
  const accessToken = shopConfig.accessToken || process.env.SHOPIFY_DEFAULT_ACCESS_TOKEN || '';
  const apiVersion = shopConfig.apiVersion || process.env.SHOPIFY_DEFAULT_API_VERSION || '2025-07';

  if (!shop || !accessToken) {
    throw new Error('Shopify shop URL and access token are required');
  }

  const client = axios.create({
    baseURL: `https://${shop}/admin/api/${apiVersion}`,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return { client, shopName: shop };
}

// ════════════════════════════════════════════════════════════
// Rate-limited Shopify Admin API request queue
//
// Per-shop bounded queue that protects every Shopify API call
// from bursting:
//   - caps concurrent in-flight requests (burst protection)
//   - adapts concurrency from the X-Shopify-Shop-Api-Call-Limit
//     response header (format: current/max) — throttles down when
//     the bucket is nearly full and grows back when it drains
//   - retries 429 responses, honoring the Retry-After header and
//     otherwise falling back to exponential backoff, with a
//     bounded number of retries
//
// All Shopify Admin API calls in services/shopify/* route through
// `getQueue(shopName).schedule(fn)` so they share this protection.
// ════════════════════════════════════════════════════════════

export interface RateLimitOptions {
  /** Max concurrent in-flight Shopify API requests per shop. Default 4. */
  maxConcurrency?: number;
  /** Max retries for a single 429-rate-limited request. Default 3. */
  maxRetries?: number;
  /** Base delay (ms) for exponential backoff: base * 2^attempt. Default 200. */
  backoffBaseMs?: number;
  /** Lower bound for adaptive concurrency. Default 1. */
  minConcurrency?: number;
  /** Bucket usage fraction (current/max) at/above which concurrency is throttled down. Default 0.75. */
  highWatermark?: number;
  /** Bucket usage fraction at/below which concurrency is allowed to grow. Default 0.4. */
  lowWatermark?: number;
}

interface PendingTask {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

interface RateLimitedError {
  response?: {
    status?: number;
    headers?: Record<string, unknown>;
  };
}

const DEFAULT_OPTIONS: Required<RateLimitOptions> = {
  maxConcurrency: 4,
  maxRetries: 3,
  backoffBaseMs: 200,
  minConcurrency: 1,
  highWatermark: 0.75,
  lowWatermark: 0.4,
};

export class ShopifyRateLimitedQueue {
  readonly shopName: string;
  private readonly options: Required<RateLimitOptions>;
  private active = 0;
  private pending: PendingTask[] = [];
  private adaptiveConcurrency: number;

  constructor(shopName: string, options: RateLimitOptions = {}) {
    this.shopName = shopName;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.adaptiveConcurrency = this.options.maxConcurrency;
  }

  /** Number of requests currently in flight. */
  get inFlight(): number {
    return this.active;
  }

  /** Current adaptive concurrency ceiling. */
  get currentConcurrency(): number {
    return this.adaptiveConcurrency;
  }

  /** Number of requests waiting for a concurrency slot. */
  get pendingCount(): number {
    return this.pending.length;
  }

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.adaptiveConcurrency && this.pending.length > 0) {
      const task = this.pending.shift() as PendingTask;
      this.active += 1;
      void this.run(task);
    }
  }

  private async run(task: PendingTask): Promise<void> {
    try {
      const response = await this.executeWithRetry(task.fn, 0);
      this.adaptConcurrency(response);
      task.resolve(response);
    } catch (err) {
      task.reject(err);
    } finally {
      this.active -= 1;
      this.drain();
    }
  }

  private async executeWithRetry(fn: () => Promise<unknown>, attempt: number): Promise<unknown> {
    try {
      return await fn();
    } catch (err) {
      if (!this.isRateLimited(err) || attempt >= this.options.maxRetries) {
        throw err;
      }

      const delayMs = this.retryDelay(err, attempt);

      // Throttle down while Shopify is pushing back on us.
      this.adaptiveConcurrency = Math.max(
        this.options.minConcurrency,
        Math.ceil(this.adaptiveConcurrency / 2)
      );

      logger.warn('Shopify API request rate-limited; retrying', {
        shop: this.shopName,
        attempt: attempt + 1,
        maxRetries: this.options.maxRetries,
        retryAfterMs: delayMs,
      });

      await this.sleep(delayMs);
      return this.executeWithRetry(fn, attempt + 1);
    }
  }

  private isRateLimited(err: unknown): boolean {
    return (err as RateLimitedError)?.response?.status === 429;
  }

  private retryDelay(err: unknown, attempt: number): number {
    const backoff = this.options.backoffBaseMs * Math.pow(2, attempt);
    const retryAfter = (err as RateLimitedError)?.response?.headers?.['retry-after'];
    if (retryAfter !== undefined && retryAfter !== null) {
      const seconds = parseInt(String(retryAfter), 10);
      if (!Number.isNaN(seconds) && seconds >= 0) {
        return Math.max(seconds * 1000, backoff);
      }
    }
    return backoff;
  }

  private adaptConcurrency(response: unknown): void {
    const headers = (response as { headers?: Record<string, unknown> })?.headers;
    if (!headers) return;

    const limitHeader = headers['x-shopify-shop-api-call-limit'];
    if (limitHeader === undefined || limitHeader === null) return;

    const match = /^(\d+)\s*\/\s*(\d+)$/.exec(String(limitHeader).trim());
    if (!match) return;

    const current = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    if (max <= 0) return;

    const usage = current / max;

    if (usage >= this.options.highWatermark) {
      // Bucket nearly full — halve concurrency to back off.
      this.adaptiveConcurrency = Math.max(
        this.options.minConcurrency,
        Math.floor(this.adaptiveConcurrency / 2)
      );
    } else if (usage <= this.options.lowWatermark && this.adaptiveConcurrency < this.options.maxConcurrency) {
      // Bucket mostly empty — allow more concurrency up to the cap.
      this.adaptiveConcurrency = Math.min(
        this.options.maxConcurrency,
        this.adaptiveConcurrency + 1
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

const queues = new Map<string, ShopifyRateLimitedQueue>();

/** Returns the shared rate-limited queue for a shop (created on first use). */
export function getQueue(shopName: string, options?: RateLimitOptions): ShopifyRateLimitedQueue {
  let queue = queues.get(shopName);
  if (!queue) {
    queue = new ShopifyRateLimitedQueue(shopName, options);
    queues.set(shopName, queue);
  }
  return queue;
}

/** Test helper: forgets cached per-shop queues. */
export function resetShopifyQueues(): void {
  queues.clear();
}
