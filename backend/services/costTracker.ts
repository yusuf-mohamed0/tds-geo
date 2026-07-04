// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Cost Tracking & Budget Control Service
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { CostEntry } from '../types';

class CostTracker {
  private pool: Pool | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
  }

  /**
   * Record a cost entry for an API call.
   */
  async recordCost(entry: Omit<CostEntry, 'id' | 'created_at'> & { metadata?: Record<string, unknown> }): Promise<void> {
    if (!this.pool) { logger.warn('CostTracker not initialized — skipping recordCost'); return; }
    try {
      await this.pool.query(
        `INSERT INTO cost_tracking (client_id, article_id, provider, model, tokens_in, tokens_out, cost_usd, duration_ms, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.client_id,
          entry.article_id || null,
          entry.provider,
          entry.model || null,
          entry.tokens_in || 0,
          entry.tokens_out || 0,
          entry.cost_usd,
          entry.duration_ms || 0,
          JSON.stringify((entry as any).metadata || {})
        ]
      );
    } catch (err) {
      logger.error('Failed to record cost', { provider: entry.provider, error: (err as Error).message });
    }
  }

  /**
   * Calculate approximate OpenAI cost based on token usage.
   */
  calculateOpenAICost(model: string, tokensIn: number, tokensOut: number): number {
    const rates: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
      'gpt-4o-mini': { input: 0.0015 / 1000, output: 0.006 / 1000 },
      'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
      'gpt-3.5-turbo': { input: 0.001 / 1000, output: 0.002 / 1000 },
      'dall-e-3': { input: 0.04, output: 0 }, // Per image
      'text-embedding-3-small': { input: 0.00002 / 1000, output: 0 }
    };

    const rate = rates[model] || rates['gpt-4o'];
    return (tokensIn * rate.input) + (tokensOut * rate.output);
  }

  /**
   * Get monthly usage for a client.
   */
  async getMonthlyUsage(clientId: string): Promise<{
    totalCost: number;
    totalTokens: number;
    articleCount: number;
    byProvider: Record<string, number>;
  }> {
    if (!this.pool) throw new Error('CostTracker not initialized');
    const result = await this.pool.query(
      `SELECT provider, SUM(cost_usd) as cost, SUM(tokens_in + tokens_out) as tokens, COUNT(*) as calls
       FROM cost_tracking
       WHERE client_id = $1
         AND created_at >= DATE_TRUNC('month', NOW())
       GROUP BY provider`,
      [clientId]
    );

    const byProvider: Record<string, number> = {};
    let totalCost = 0;
    let totalTokens = 0;

    for (const row of result.rows) {
      byProvider[row.provider] = parseFloat(row.cost) || 0;
      totalCost += parseFloat(row.cost) || 0;
      totalTokens += parseInt(row.tokens) || 0;
    }

    // Get article count this month
    const articleResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM articles
       WHERE client_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
      [clientId]
    );

    return {
      totalCost,
      totalTokens,
      articleCount: parseInt(articleResult.rows[0]?.count || '0'),
      byProvider
    };
  }

  /**
   * Check if a client has exceeded their monthly budget.
   */
  async isBudgetExceeded(clientId: string, monthlyLimit?: number): Promise<boolean> {
    const usage = await this.getMonthlyUsage(clientId);
    const limit = monthlyLimit || parseFloat(process.env.COST_MONTHLY_LIMIT || '100');

    const exceeded = usage.totalCost >= limit;
    if (exceeded) {
      logger.warn('Client monthly budget exceeded', { clientId, cost: usage.totalCost, limit });
    }

    return exceeded;
  }

  async close(): Promise<void> {
    // Pool is shared externally — no need to close it here
  }
}

export default new CostTracker();
