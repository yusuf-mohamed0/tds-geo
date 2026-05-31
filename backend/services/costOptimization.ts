// ══════════════════════════════════════════════════════════════════
// Cost Optimization System
// Model routing, adaptive generation, caching, token budgeting,
// retry budgeting, cheap-model preprocessing, premium-model escalation
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { ModelRouterResult, ModelRoutingConfig, TokenBudget } from '../types';

interface TaskRequirements {
  taskType: string;
  estimatedTokens: number;
  requiresReasoning: boolean;
  requiresImageGeneration: boolean;
  requiredQuality: 'draft' | 'standard' | 'premium';
  estimatedComplexity: number;
}

interface ModelCapability {
  model: string;
  provider: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
  maxTokens: number;
  supportsReasoning: boolean;
  supportsImages: boolean;
  quality: number;
  speedScore: number;
}

class CostOptimizationService {
  private pool: Pool | null = null;

  // Model pricing (updated regularly)
  private readonly modelCatalog: ModelCapability[] = [
    { model: 'gpt-4o', provider: 'openai', inputCostPer1K: 0.005, outputCostPer1K: 0.015, maxTokens: 16384, supportsReasoning: true, supportsImages: true, quality: 95, speedScore: 70 },
    { model: 'gpt-4o-mini', provider: 'openai', inputCostPer1K: 0.0015, outputCostPer1K: 0.006, maxTokens: 16384, supportsReasoning: true, supportsImages: true, quality: 85, speedScore: 85 },
    { model: 'gpt-4', provider: 'openai', inputCostPer1K: 0.03, outputCostPer1K: 0.06, maxTokens: 8192, supportsReasoning: true, supportsImages: false, quality: 90, speedScore: 50 },
    { model: 'gpt-3.5-turbo', provider: 'openai', inputCostPer1K: 0.001, outputCostPer1K: 0.002, maxTokens: 16384, supportsReasoning: false, supportsImages: false, quality: 70, speedScore: 95 },
    { model: 'deepseek-v4-flash', provider: 'deepseek', inputCostPer1K: 0.0003, outputCostPer1K: 0.001, maxTokens: 32768, supportsReasoning: false, supportsImages: false, quality: 80, speedScore: 95 },
    { model: 'deepseek-v3', provider: 'deepseek', inputCostPer1K: 0.0005, outputCostPer1K: 0.001, maxTokens: 65536, supportsReasoning: true, supportsImages: false, quality: 90, speedScore: 80 },
    { model: 'text-embedding-3-small', provider: 'openai', inputCostPer1K: 0.00002, outputCostPer1K: 0, maxTokens: 8191, supportsReasoning: false, supportsImages: false, quality: 85, speedScore: 100 }
  ];

  private static instance: CostOptimizationService;

  static getInstance(): CostOptimizationService {
    if (!CostOptimizationService.instance) {
      CostOptimizationService.instance = new CostOptimizationService();
    }
    return CostOptimizationService.instance;
  }

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Cost Optimization System initialized');
  }

  // ══════════════════════════════════════════════════════════════
  // MODEL ROUTER
  // ══════════════════════════════════════════════════════════════

  async routeTask(
    clientId: string,
    taskRequirements: TaskRequirements
  ): Promise<ModelRouterResult> {
    // Check client-specific routing config
    const clientConfig = await this.getClientRoutingConfig(clientId, taskRequirements.taskType);

    if (clientConfig && clientConfig.is_active) {
      const preferredModel = this.modelCatalog.find(m => m.model === clientConfig.preferred_model);
      if (preferredModel) {
        return {
          model: preferredModel.model,
          provider: preferredModel.provider,
          estimatedCost: this.estimateCost(preferredModel, taskRequirements.estimatedTokens),
          maxTokens: clientConfig.max_tokens_per_call || preferredModel.maxTokens,
          reason: `Client routing config: ${clientConfig.preferred_model}`
        };
      }
    }

    // Adaptive model selection based on task requirements
    let candidates = [...this.modelCatalog];

    // Filter by capability requirements
    if (taskRequirements.requiresImageGeneration) {
      candidates = candidates.filter(m => m.supportsImages);
    }
    if (taskRequirements.requiresReasoning) {
      candidates = candidates.filter(m => m.supportsReasoning);
    }

    if (candidates.length === 0) {
      candidates = [this.modelCatalog[0]]; // Fallback to GPT-4o
    }

    // Score and rank based on quality, speed, and cost
    const scored = candidates.map(m => {
      const costScore = this.calculateCostScore(m, taskRequirements.estimatedTokens);
      const qualityScore = (taskRequirements.requiredQuality === 'premium') ? m.quality * 0.6 + costScore * 0.4
        : (taskRequirements.requiredQuality === 'draft') ? m.speedScore * 0.6 + costScore * 0.4
        : m.quality * 0.4 + m.speedScore * 0.3 + costScore * 0.3;
      return { ...m, compositeScore: qualityScore };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const best = scored[0];

    return {
      model: best.model,
      provider: best.provider,
      estimatedCost: this.estimateCost(best, taskRequirements.estimatedTokens),
      maxTokens: best.maxTokens,
      reason: `Optimized: ${best.provider}/${best.model} (quality: ${best.quality}, speed: ${best.speedScore}, cost: $${(best.inputCostPer1K * taskRequirements.estimatedTokens / 1000).toFixed(6)})`
    };
  }

  /**
   * Cheap preprocessing: use a fast/cheap model for initial processing,
   * then escalate to premium for final generation.
   */
  async cheapThenPremium<T>(
    clientId: string,
    taskType: string,
    preprocessingWork: string,
    finalWork: string,
    preprocessFn: (model: string) => Promise<T>,
    finalFn: (model: string, preprocessResult: T) => Promise<T>
  ): Promise<T> {
    const cheapConfig = await this.routeTask(clientId, {
      taskType: `${taskType}_preprocess`,
      estimatedTokens: 500,
      requiresReasoning: false,
      requiresImageGeneration: false,
      requiredQuality: 'draft',
      estimatedComplexity: 1
    });

    const preprocessResult = await preprocessFn(cheapConfig.model);

    const premiumConfig = await this.routeTask(clientId, {
      taskType: `${taskType}_final`,
      estimatedTokens: 2000,
      requiresReasoning: true,
      requiresImageGeneration: false,
      requiredQuality: 'premium',
      estimatedComplexity: 3
    });

    return finalFn(premiumConfig.model, preprocessResult);
  }

  // ══════════════════════════════════════════════════════════════
  // TOKEN BUDGET MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async checkBudget(clientId: string, estimatedTokens: number): Promise<{
    allowed: boolean;
    budget?: TokenBudget;
    reason?: string;
  }> {
    if (!this.pool) return { allowed: true };

    const budgets = await this.pool.query(
      `SELECT * FROM token_budgets
       WHERE client_id = $1 AND is_active = true
         AND NOW() BETWEEN period_start AND period_end
       ORDER BY budget_period ASC
       LIMIT 1`,
      [clientId]
    );

    if (budgets.rows.length === 0) return { allowed: true };

    const budget = budgets.rows[0];
    const tokenLimit = parseInt(budget.token_limit);
    const tokensUsed = parseInt(budget.tokens_used);
    const costUsed = parseFloat(budget.cost_used);
    const costLimit = budget.cost_limit ? parseFloat(budget.cost_limit) : null;

    if (tokensUsed + estimatedTokens > tokenLimit) {
      return {
        allowed: false,
        budget: budget,
        reason: `Token budget exceeded: ${tokensUsed + estimatedTokens} > ${tokenLimit}`
      };
    }

    // Estimate cost of this call
    const avgCostPerToken = costUsed / Math.max(1, tokensUsed);
    const estimatedCost = estimatedTokens * avgCostPerToken;

    if (costLimit && (costUsed + estimatedCost > costLimit)) {
      return {
        allowed: false,
        budget: budget,
        reason: `Cost budget exceeded: $${(costUsed + estimatedCost).toFixed(2)} > $${costLimit.toFixed(2)}`
      };
    }

    return { allowed: true, budget };
  }

  async recordTokenUsage(
    clientId: string,
    model: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number
  ): Promise<void> {
    if (!this.pool) return;

    try {
      // Update token budgets
      await this.pool.query(
        `UPDATE token_budgets
         SET tokens_used = tokens_used + $2,
             cost_used = cost_used + $3
         WHERE client_id = $1
           AND is_active = true
           AND NOW() BETWEEN period_start AND period_end`,
        [clientId, tokensIn + tokensOut, costUsd]
      );

      // Update cost estimates cache
      const totalTokens = tokensIn + tokensOut;
      await this.pool.query(
        `INSERT INTO cost_estimates (task_signature, estimated_tokens, estimated_cost, actual_tokens, actual_cost, sample_count)
         VALUES ($1, $2, $3, $4, $5, 1)
         ON CONFLICT (task_signature) DO UPDATE
         SET actual_tokens = (cost_estimates.actual_tokens * cost_estimates.sample_count + $4) / (cost_estimates.sample_count + 1),
             actual_cost = (cost_estimates.actual_cost * cost_estimates.sample_count + $5) / (cost_estimates.sample_count + 1),
             sample_count = cost_estimates.sample_count + 1,
             confidence = LEAST(0.95, cost_estimates.confidence + 0.05),
             updated_at = NOW()`,
        [`${model}:${tokensIn}:${tokensOut}`, totalTokens, costUsd, totalTokens, costUsd]
      );
    } catch (err) {
      logger.warn('Failed to record token usage', { error: (err as Error).message });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ROUTING CONFIG MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  async getClientRoutingConfig(clientId: string, taskType: string): Promise<ModelRoutingConfig | null> {
    if (!this.pool) return null;
    const result = await this.pool.query(
      'SELECT * FROM model_routing_config WHERE client_id = $1 AND task_type = $2',
      [clientId, taskType]
    );
    return result.rows[0] || null;
  }

  async setRoutingConfig(config: Omit<ModelRoutingConfig, 'id' | 'created_at'>): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO model_routing_config (client_id, task_type, preferred_model, fallback_model, max_cost_per_call, max_tokens_per_call, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (client_id, task_type)
       DO UPDATE SET preferred_model = $3, fallback_model = $4, max_cost_per_call = $5, max_tokens_per_call = $6, priority = $7, is_active = $8`,
      [config.client_id, config.task_type, config.preferred_model, config.fallback_model, config.max_cost_per_call, config.max_tokens_per_call, config.priority, config.is_active]
    );
  }

  // ══════════════════════════════════════════════════════════════
  // COST REPORTING
  // ══════════════════════════════════════════════════════════════

  async getCostReport(clientId: string, days: number = 30): Promise<{
    totalCost: number;
    byModel: Record<string, number>;
    byProvider: Record<string, number>;
    estimatedSavings: number;
    recommendations: string[];
  }> {
    if (!this.pool) {
      return { totalCost: 0, byModel: {}, byProvider: {}, estimatedSavings: 0, recommendations: [] };
    }

    const result = await this.pool.query(
      `SELECT provider, model, SUM(cost_usd) as cost, SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_calls,
              COUNT(*) as total_calls
       FROM ai_latency_records
       WHERE client_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY provider, model
       ORDER BY cost DESC`,
      [clientId]
    );

    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let totalCost = 0;

    for (const row of result.rows) {
      const cost = parseFloat(row.cost) || 0;
      totalCost += cost;
      byModel[row.model] = (byModel[row.model] || 0) + cost;
      byProvider[row.provider] = (byProvider[row.provider] || 0) + cost;
    }

    // Calculate potential savings from model optimization
    const savings = this.calculatePotentialSavings(byModel);

    return {
      totalCost,
      byModel,
      byProvider,
      estimatedSavings: savings.amount,
      recommendations: savings.recommendations
    };
  }

  private calculatePotentialSavings(byModel: Record<string, number>): {
    amount: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let amount = 0;

    // If spending a lot on GPT-4, suggest GPT-4o as cheaper alternative
    if (byModel['gpt-4'] && byModel['gpt-4'] > 10) {
      const savings = byModel['gpt-4'] * 0.7; // ~70% cheaper with GPT-4o
      amount += savings;
      recommendations.push(`Switch from gpt-4 to gpt-4o to save ~$${savings.toFixed(2)}/month`);
    }

    // If spending on GPT-4o for simple tasks, suggest GPT-4o-mini
    if (byModel['gpt-4o'] && byModel['gpt-4o'] > 20) {
      const savings = byModel['gpt-4o'] * 0.5;
      amount += savings;
      recommendations.push(`Use gpt-4o-mini for simple tasks to save ~$${savings.toFixed(2)}/month`);
    }

    // If using OpenAI for everything, suggest DeepSeek for some tasks
    if (byModel['gpt-4o'] && byModel['gpt-4o'] > 50) {
      const savings = byModel['gpt-4o'] * 0.3;
      amount += savings;
      recommendations.push(`Route some tasks to DeepSeek to save ~$${savings.toFixed(2)}/month`);
    }

    return { amount, recommendations };
  }

  // ══════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════

  private estimateCost(model: ModelCapability, estimatedTokens: number): number {
    // Assume roughly 75% input, 25% output tokens
    const inputTokens = Math.round(estimatedTokens * 0.75);
    const outputTokens = estimatedTokens - inputTokens;
    return (inputTokens / 1000) * model.inputCostPer1K + (outputTokens / 1000) * model.outputCostPer1K;
  }

  private calculateCostScore(model: ModelCapability, estimatedTokens: number): number {
    const estimatedCost = this.estimateCost(model, estimatedTokens);
    // Normalize: lower cost = higher score (invert, target range 0-100)
    const maxCost = 0.05; // 5 cents max for normalization
    return Math.max(0, 100 - (estimatedCost / maxCost) * 100);
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}

export default CostOptimizationService;
