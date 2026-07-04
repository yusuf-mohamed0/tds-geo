// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// Worker Performance Scoring Engine
// Composite scoring, tier assignment, promotion & demotion
// ══════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { WorkerTier, PromotionEventType, WorkerScore, PerformanceThreshold } from '../types';

interface ScoreDimensions {
  reliability: number;
  throughput: number;
  latency: number;
  costEfficiency: number;
  quality: number;
}

interface CompositeResult {
  compositeScore: number;
  dimensions: ScoreDimensions;
  tier: WorkerTier;
  tierConfidence: number;
}

class WorkerScoringEngine {
  private pool: Pool | null = null;
  private scoringInterval: NodeJS.Timeout | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Worker Scoring Engine initialized');

    // Run scoring evaluation every 6 hours
    this.scoringInterval = setInterval(() => this.evaluateAllWorkers(), 6 * 60 * 60 * 1000);

    // Run an initial evaluation after 2 minutes
    setTimeout(() => this.evaluateAllWorkers(), 2 * 60 * 1000);
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════

  /**
   * Record a score snapshot for a single worker after a job completes.
   * This provides real-time scoring data that feeds into the periodic evaluation.
   */
  async recordJobCompletion(
    workerName: string,
    jobType: string,
    metrics: {
      processingMs: number;
      success: boolean;
      costUsd?: number;
      qualityScore?: number;
    }
  ): Promise<void> {
    if (!this.pool) return;
    // The observability service already handles raw metric storage in worker_performance.
    // This engine operates on the aggregated data during periodic evaluations.
    // Real-time recording is handled by the worker_performance table insertion.
  }

  /**
   * Perform a full evaluation of all active workers.
   * Computes composite scores, assigns tiers, and triggers promotions/demotions.
   */
  async evaluateAllWorkers(): Promise<{
    evaluated: number;
    promoted: number;
    demoted: number;
    flagged: number;
  }> {
    if (!this.pool) return { evaluated: 0, promoted: 0, demoted: 0, flagged: 0 };

    logger.info('Worker Scoring Engine: Starting full evaluation');

    try {
      // 1. Get distinct worker names from the raw performance table
      const workers = await this.pool.query(`
        SELECT DISTINCT worker_name, job_type
        FROM worker_performance
        WHERE recorded_at >= NOW() - INTERVAL '7 days'
        ORDER BY worker_name
      `);

      let promoted = 0;
      let demoted = 0;
      let flagged = 0;

      for (const worker of workers.rows) {
        const result = await this.evaluateWorker(worker.worker_name, worker.job_type);

        if (result.event === 'promotion') promoted++;
        else if (result.event === 'demotion') demoted++;
        else if (result.event === 'flagged') flagged++;
      }

      logger.info('Worker Scoring Engine: Evaluation complete', {
        evaluated: workers.rows.length,
        promoted,
        demoted,
        flagged
      });

      return {
        evaluated: workers.rows.length,
        promoted,
        demoted,
        flagged
      };
    } catch (err) {
      logger.error('Worker Scoring Engine: Evaluation failed', { error: (err as Error).message });
      return { evaluated: 0, promoted: 0, demoted: 0, flagged: 0 };
    }
  }

  /**
   * Evaluate a single worker by name.
   * Computes composite score, checks promotion/demotion criteria, and saves results.
   */
  async evaluateWorker(
    workerName: string,
    jobType: string
  ): Promise<{
    compositeScore: number;
    tier: WorkerTier;
    event: 'none' | 'promotion' | 'demotion' | 'flagged';
    eventReason?: string;
  }> {
    if (!this.pool) {
      return { compositeScore: 50, tier: 'standard', event: 'none' };
    }

    try {
      // 2. Get raw metrics for this worker over the evaluation period
      const metrics = await this.getWorkerMetrics(workerName, jobType);
      if (!metrics || metrics.total_jobs === 0) {
        return { compositeScore: 50, tier: 'standard', event: 'none' };
      }

      // 3. Compute dimension scores
      const dimensions = this.computeDimensionScores(metrics);

      // 4. Load thresholds for composite weighting
      const thresholds = await this.getThresholds();
      const weights = this.getWeightsForTier(thresholds, 'standard');

      // 5. Compute composite score
      const composite = this.computeComposite(dimensions, weights);

      // 6. Determine tier assignment
      const tierResult = this.determineTier(composite.compositeScore, thresholds);

      // 7. Save the score snapshot
      await this.saveScoreSnapshot(workerName, jobType, metrics, dimensions, composite);

      // 8. Check and apply promotion/demotion
      const hierarchyResult = await this.checkHierarchyChange(
        workerName, jobType, tierResult.tier, composite.compositeScore, thresholds
      );

      return {
        compositeScore: composite.compositeScore,
        tier: tierResult.tier,
        event: hierarchyResult.event,
        eventReason: hierarchyResult.reason
      };
    } catch (err) {
      logger.error(`Worker Scoring Engine: Failed to evaluate ${workerName}`, {
        error: (err as Error).message
      });
      return { compositeScore: 50, tier: 'standard', event: 'none' };
    }
  }

  /**
   * Get the current hierarchy (ranks) of all workers.
   */
  async getHierarchy(): Promise<any[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(`
      SELECT wh.*, wps.composite_score as latest_score,
             wps.reliability_score, wps.throughput_score,
             wps.latency_score, wps.cost_efficiency_score, wps.quality_score
      FROM worker_hierarchy wh
      LEFT JOIN LATERAL (
        SELECT composite_score, reliability_score, throughput_score,
               latency_score, cost_efficiency_score, quality_score
        FROM worker_performance_scores
        WHERE worker_name = wh.worker_name
        ORDER BY recorded_at DESC
        LIMIT 1
      ) wps ON true
      WHERE wh.is_active = true
      ORDER BY wh.current_score DESC
    `);
    return result.rows;
  }

  /**
   * Get performance score history for a specific worker.
   */
  async getWorkerHistory(workerName: string, limit: number = 30): Promise<any[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT * FROM worker_performance_scores
       WHERE worker_name = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [workerName, limit]
    );
    return result.rows;
  }

  /**
   * Get promotion/demotion history.
   */
  async getPromotionHistory(limit: number = 50): Promise<any[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT * FROM promotion_demotion_history
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get current performance thresholds.
   */
  async getThresholdsConfig(): Promise<any[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM performance_thresholds ORDER BY min_score DESC'
    );
    return result.rows;
  }

  /**
   * Update performance thresholds for a tier.
   */
  async updateThreshold(
    tierName: WorkerTier,
    updates: Record<string, unknown>
  ): Promise<void> {
    if (!this.pool) return;

    const allowedFields = [
      'min_score', 'max_score', 'promotion_threshold', 'demotion_threshold',
      'periods_for_promotion', 'periods_for_demotion', 'requires_approval',
      'default_title', 'weight_reliability', 'weight_throughput',
      'weight_latency', 'weight_cost', 'weight_quality', 'is_active'
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = NOW()`);
    values.push(tierName);

    await this.pool.query(
      `UPDATE performance_thresholds
       SET ${setClauses.join(', ')}
       WHERE tier_name = $${paramIndex}`,
      values
    );

    logger.info('Thresholds updated', { tierName, updates });
  }

  /**
   * Manually set a worker's tier (admin override).
   */
  async manuallySetTier(
    workerName: string,
    jobType: string,
    newTier: WorkerTier,
    reason: string,
    adminUserId?: string
  ): Promise<void> {
    if (!this.pool) return;

    const current = await this.pool.query(
      'SELECT current_tier, current_score FROM worker_hierarchy WHERE worker_name = $1',
      [workerName]
    );

    const fromTier: WorkerTier = current.rows[0]?.current_tier || 'standard';
    const fromScore = current.rows[0]?.current_score || 50;
    const thresholds = await this.getThresholds();
    const tierConfig = thresholds.find(t => t.tier_name === newTier);
    const toScore = tierConfig ? (tierConfig.min_score + tierConfig.max_score) / 2 : 50;

    // Record promotion/demotion event
    const eventType: PromotionEventType = this.isHigherTier(newTier, fromTier) ? 'promotion' : 'demotion';

    await this.pool.query(
      `INSERT INTO promotion_demotion_history
       (worker_name, job_type, event_type, from_tier, to_tier, from_score, to_score, reason, auto_applied, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9)`,
      [workerName, jobType, eventType, fromTier, newTier, fromScore, toScore,
       reason, JSON.stringify({ admin_user_id: adminUserId || 'unknown' })]
    );

    // Update hierarchy
    const title = await this.getTitleForTier(newTier, jobType);
    await this.pool.query(
      `INSERT INTO worker_hierarchy (worker_name, job_type, current_tier, title, current_score, last_promotion_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (worker_name) DO UPDATE SET
         current_tier = EXCLUDED.current_tier,
         title = EXCLUDED.title,
         current_score = EXCLUDED.current_score,
         ${eventType === 'promotion' ? 'last_promotion_at = NOW(), total_promotions = worker_hierarchy.total_promotions + 1' : 'last_demotion_at = NOW(), total_demotions = worker_hierarchy.total_demotions + 1'},
         updated_at = NOW()`,
      [workerName, jobType, newTier, title, toScore]
    );

    logger.info(`Worker ${workerName} manually ${eventType} to ${newTier}`, { reason });
  }

  /**
   * Get all worker hierarchy entries grouped by tier (for org chart view).
   */
  async getHierarchyByTier(): Promise<Record<string, any[]>> {
    const hierarchy = await this.getHierarchy();
    const byTier: Record<string, any[]> = {
      elite: [],
      senior: [],
      standard: [],
      junior: [],
      probation: []
    };

    for (const worker of hierarchy) {
      const tier = (worker.current_tier || 'standard') as string;
      if (byTier[tier]) {
        byTier[tier].push(worker);
      } else {
        byTier.standard.push(worker);
      }
    }

    return byTier;
  }

  // ══════════════════════════════════════════════════════════════
  // INTERNAL METHODS
  // ══════════════════════════════════════════════════════════════

  private async getWorkerMetrics(
    workerName: string,
    jobType: string,
    hours: number = 168 // 7 days
  ): Promise<{
    total_jobs: number;
    failed_jobs: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    throughput_per_min: number;
  } | null> {
    if (!this.pool) return null;

    const result = await this.pool.query(`
      SELECT
        COALESCE(SUM(jobs_processed), 0)::int as total_jobs,
        COALESCE(SUM(jobs_failed), 0)::int as failed_jobs,
        COALESCE(AVG(avg_processing_ms), 0)::decimal(10,2) as avg_latency_ms,
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY p95_processing_ms), 0)::decimal(10,2) as p95_latency_ms,
        COALESCE(AVG(throughput_per_min), 0)::decimal(10,4) as throughput_per_min
      FROM worker_performance
      WHERE worker_name = $1
        AND job_type = $2
        AND recorded_at >= NOW() - ($3::text || ' hours')::interval
    `, [workerName, jobType, String(hours)]);

    return result.rows[0] || null;
  }

  private computeDimensionScores(metrics: {
    total_jobs: number;
    failed_jobs: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    throughput_per_min: number;
  }): ScoreDimensions {
    // Reliability: success rate mapped to 0-100
    const successRate = metrics.total_jobs > 0
      ? (metrics.total_jobs - metrics.failed_jobs) / metrics.total_jobs
      : 0.5;
    const reliability = Math.round(Math.min(100, successRate * 100));

    // Throughput: jobs per minute mapped to 0-100 (0.5 jobs/min = 50, 2+ jobs/min = 100)
    const throughput = Math.round(Math.min(100, (metrics.throughput_per_min / 2) * 100));

    // Latency: lower is better (500ms = 90, 2000ms = 70, 10000ms = 30, 30000ms+ = 10)
    const latencyScore = Math.round(
      Math.max(0, Math.min(100, 100 - (metrics.avg_latency_ms / 30000) * 90))
    );

    // Cost efficiency: baseline estimate from latency (placeholder until we integrate cost data)
    const costEfficiency = Math.round(
      Math.max(0, Math.min(100, 100 - (metrics.avg_latency_ms / 60000) * 80))
    );

    // Quality: start with a baseline, will be updated with AI evaluation scores
    const quality = 50;

    return {
      reliability,
      throughput,
      latency: latencyScore,
      costEfficiency,
      quality
    };
  }

  private getWeightsForTier(
    thresholds: PerformanceThreshold[],
    _currentTier: WorkerTier
  ): { reliability: number; throughput: number; latency: number; cost: number; quality: number } {
    const defaultWeights = { reliability: 0.30, throughput: 0.15, latency: 0.15, cost: 0.15, quality: 0.25 };

    if (thresholds.length === 0) return defaultWeights;

    // Use standard tier weights as default
    const standard = thresholds.find(t => t.tier_name === 'standard');
    if (!standard) return defaultWeights;

    return {
      reliability: Number(standard.weight_reliability) || 0.30,
      throughput: Number(standard.weight_throughput) || 0.15,
      latency: Number(standard.weight_latency) || 0.15,
      cost: Number(standard.weight_cost) || 0.15,
      quality: Number(standard.weight_quality) || 0.25
    };
  }

  private computeComposite(
    dimensions: ScoreDimensions,
    weights: { reliability: number; throughput: number; latency: number; cost: number; quality: number }
  ): CompositeResult {
    const composite = Math.round(
      dimensions.reliability * weights.reliability +
      dimensions.throughput * weights.throughput +
      dimensions.latency * weights.latency +
      dimensions.costEfficiency * weights.cost +
      dimensions.quality * weights.quality
    );

    return {
      compositeScore: Math.min(100, Math.max(0, composite)),
      dimensions,
      tier: 'standard',
      tierConfidence: 0.5
    };
  }

  private determineTier(
    compositeScore: number,
    thresholds: PerformanceThreshold[]
  ): { tier: WorkerTier; confidence: number } {
    // Sort thresholds by min_score descending (elite = highest)
    const sorted = [...thresholds].sort((a, b) => b.min_score - a.min_score);

    for (const t of sorted) {
      if (compositeScore >= t.min_score && compositeScore <= t.max_score) {
        // Calculate confidence: how far into the tier band we are
        const band = t.max_score - t.min_score;
        const position = band > 0 ? (compositeScore - t.min_score) / band : 0.5;
        const confidence = Math.round((0.5 + position * 0.5) * 100) / 100;

        return { tier: t.tier_name as WorkerTier, confidence: Math.min(1, Math.max(0, confidence)) };
      }
    }

    return { tier: 'probation', confidence: 0.1 };
  }

  private async checkHierarchyChange(
    workerName: string,
    jobType: string,
    newTier: WorkerTier,
    newScore: number,
    thresholds: PerformanceThreshold[]
  ): Promise<{ event: 'none' | 'promotion' | 'demotion' | 'flagged'; reason?: string }> {
    if (!this.pool) return { event: 'none' };

    // Get current hierarchy entry
    const current = await this.pool.query(
      'SELECT * FROM worker_hierarchy WHERE worker_name = $1',
      [workerName]
    );

    if (current.rows.length === 0) {
      // New worker — create hierarchy entry
      const title = await this.getTitleForTier(newTier, jobType);
      await this.pool.query(
        `INSERT INTO worker_hierarchy
         (worker_name, job_type, current_tier, title, current_score, highest_score, lowest_score, score_trend, last_score_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'stable', NOW())`,
        [workerName, jobType, newTier, title, newScore, newScore, newScore]
      );
      return { event: 'none', reason: 'New worker registered' };
    }

    const entry = current.rows[0];
    const currentTier = entry.current_tier as WorkerTier;
    const currentScore = parseFloat(entry.current_score) || 50;
    const highestScore = Math.max(parseFloat(entry.highest_score) || 50, newScore);
    const lowestScore = Math.min(parseFloat(entry.lowest_score) || 50, newScore);
    const periodsAtTier = entry.periods_at_tier || 1;

    // Determine score trend
    const scoreDiff = newScore - currentScore;
    const trend = scoreDiff > 5 ? 'rising' : scoreDiff < -5 ? 'declining' : 'stable';

    // Get thresholds for current and potential tiers
    const currentThreshold = thresholds.find(t => t.tier_name === currentTier);
    const nextTierUp = this.getNextTierUp(currentTier, thresholds);
    const nextTierDown = this.getNextTierDown(currentTier, thresholds);

    let event: 'none' | 'promotion' | 'demotion' | 'flagged' = 'none';
    let eventReason: string | undefined;

    // Check for promotion
    if (nextTierUp && newScore >= nextTierUp.promotion_threshold) {
      const requiredPeriods = nextTierUp.periods_for_promotion;
      if (periodsAtTier >= requiredPeriods) {
        // PROMOTE!
        const title = await this.getTitleForTier(nextTierUp.tier_name as WorkerTier, jobType);
        await this.applyPromotion(workerName, jobType, currentTier, nextTierUp.tier_name as WorkerTier,
          newScore, `Score ${newScore} exceeded ${nextTierUp.tier_name} threshold for ${requiredPeriods} periods`);
        await this.updateHierarchy(workerName, jobType, nextTierUp.tier_name as WorkerTier, title, newScore,
          highestScore, lowestScore, trend, 'promotion');
        event = 'promotion';
        eventReason = `Promoted to ${nextTierUp.tier_name} (score: ${newScore})`;
      }
    }
    // Check for demotion
    else if (nextTierDown && newScore <= nextTierDown.demotion_threshold) {
      const requiredPeriods = nextTierDown.periods_for_demotion;
      if (periodsAtTier >= requiredPeriods) {
        // DEMOTE
        const title = await this.getTitleForTier(nextTierDown.tier_name as WorkerTier, jobType);
        await this.applyDemotion(workerName, jobType, currentTier, nextTierDown.tier_name as WorkerTier,
          newScore, `Score ${newScore} fell below ${currentTier} threshold for ${requiredPeriods} periods`);
        await this.updateHierarchy(workerName, jobType, nextTierDown.tier_name as WorkerTier, title, newScore,
          highestScore, lowestScore, trend, 'demotion');
        event = 'demotion';
        eventReason = `Demoted to ${nextTierDown.tier_name} (score: ${newScore})`;
      }
    }
    // Check if probation-tier worker needs flagging
    else if (currentTier === 'probation' && newScore < 20 && periodsAtTier >= 5) {
      // Flag for human review
      await this.flagForReview(workerName, jobType, newScore,
        `Probation worker with score ${newScore} for ${periodsAtTier} periods — needs human review`);
      event = 'flagged';
      eventReason = `Flagged for human review (score: ${newScore})`;
    }

    // Update hierarchy entry
    const newPeriodsAtTier = event === 'promotion' || event === 'demotion' ? 1 : periodsAtTier + 1;
    await this.pool.query(
      `UPDATE worker_hierarchy SET
        current_score = $2, highest_score = $3, lowest_score = $4,
        score_trend = $5, periods_at_tier = $6, last_score_at = NOW(), updated_at = NOW()
       WHERE worker_name = $1`,
      [workerName, newScore, highestScore, lowestScore, trend, newPeriodsAtTier]
    );

    return { event, reason: eventReason };
  }

  private async updateHierarchy(
    workerName: string, jobType: string, newTier: WorkerTier, title: string,
    score: number, highest: number, lowest: number, trend: string, changeType: 'promotion' | 'demotion'
  ): Promise<void> {
    if (!this.pool) return;

    const promoField = changeType === 'promotion' ? 'total_promotions' : 'total_demotions';
    const timeField = changeType === 'promotion' ? 'last_promotion_at' : 'last_demotion_at';

    await this.pool.query(
      `UPDATE worker_hierarchy SET
        current_tier = $2, title = $3, current_score = $4,
        highest_score = $5, lowest_score = $6, score_trend = $7,
        periods_at_tier = 1, ${promoField} = ${promoField} + 1,
        ${timeField} = NOW(), last_score_at = NOW(), updated_at = NOW()
       WHERE worker_name = $1`,
      [workerName, newTier, title, score, highest, lowest, trend]
    );
  }

  private async applyPromotion(
    workerName: string, jobType: string, fromTier: WorkerTier, toTier: WorkerTier,
    score: number, reason: string
  ): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO promotion_demotion_history
       (worker_name, job_type, event_type, from_tier, to_tier, from_score, to_score, reason, trigger_metric, auto_applied)
       VALUES ($1, $2, 'promotion', $3, $4, $5, $6, $7, 'composite_score', true)`,
      [workerName, jobType, fromTier, toTier, score, score, reason]
    );

    logger.info(`WORKER PROMOTION: ${workerName} — ${fromTier} → ${toTier}`, { score, reason });
  }

  private async applyDemotion(
    workerName: string, jobType: string, fromTier: WorkerTier, toTier: WorkerTier,
    score: number, reason: string
  ): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO promotion_demotion_history
       (worker_name, job_type, event_type, from_tier, to_tier, from_score, to_score, reason, trigger_metric, auto_applied)
       VALUES ($1, $2, 'demotion', $3, $4, $5, $6, $7, 'composite_score', true)`,
      [workerName, jobType, fromTier, toTier, score, score, reason]
    );

    logger.warn(`WORKER DEMOTION: ${workerName} — ${fromTier} → ${toTier}`, { score, reason });
  }

  private async flagForReview(
    workerName: string, jobType: string, score: number, reason: string
  ): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO promotion_demotion_history
       (worker_name, job_type, event_type, from_tier, to_tier, from_score, to_score, reason, trigger_metric, auto_applied)
       VALUES ($1, $2, 'flag_review', 'probation', 'probation', $3, $3, $4, 'composite_score', false)`,
      [workerName, jobType, score, reason]
    );

    // Also create a system alert for human review
    try {
      await this.pool.query(
        `INSERT INTO system_alerts (alert_name, severity, status, message, details, metric_value, threshold_value)
         VALUES ($1, 'warning', 'active', $2, $3, $4, 20)`,
        [
          `worker_probation_${workerName}`,
          `Worker "${workerName}" has been on probation with score ${score} — needs human review`,
          JSON.stringify({ worker_name: workerName, job_type: jobType, score }),
          score
        ]
      );
    } catch {
      // Non-critical
    }

    logger.warn(`WORKER FLAGGED: ${workerName} — needs human review`, { score, reason });
  }

  private async saveScoreSnapshot(
    workerName: string, jobType: string, metrics: any,
    dimensions: ScoreDimensions, composite: CompositeResult
  ): Promise<void> {
    if (!this.pool) return;

    await this.pool.query(
      `INSERT INTO worker_performance_scores
       (worker_name, job_type, total_jobs, failed_jobs, avg_latency_ms, p95_latency_ms,
        throughput_per_min, reliability_score, throughput_score, latency_score,
        cost_efficiency_score, quality_score, composite_score, current_tier,
        tier_confidence, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        workerName, jobType,
        metrics.total_jobs, metrics.failed_jobs,
        metrics.avg_latency_ms, metrics.p95_latency_ms,
        metrics.throughput_per_min,
        dimensions.reliability, dimensions.throughput, dimensions.latency,
        dimensions.costEfficiency, dimensions.quality,
        composite.compositeScore,
        composite.tier, composite.tierConfidence,
        new Date(Date.now() - 7 * 86400000), // 7 days ago
        new Date()
      ]
    );
  }

  private async getThresholds(): Promise<PerformanceThreshold[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      'SELECT * FROM performance_thresholds WHERE is_active = true ORDER BY min_score DESC'
    );
    return result.rows as PerformanceThreshold[];
  }

  private async getTitleForTier(tier: WorkerTier, jobType: string): Promise<string> {
    if (!this.pool) return `${tier} Worker`;

    const result = await this.pool.query(
      'SELECT default_title FROM performance_thresholds WHERE tier_name = $1',
      [tier]
    );

    const baseTitle = result.rows[0]?.default_title || tier;

    // Map job types to readable roles
    const roleMap: Record<string, string> = {
      'content-generation': 'Content Generator',
      'keyword-research': 'Keyword Researcher',
      'shopify-publish': 'Shopify Publisher',
      'image-generation': 'Image Generator',
      'seo-analysis': 'SEO Analyst',
      'internal-linking': 'Internal Linker',
      'webhook-delivery': 'Webhook Deliverer',
      'fact-check': 'Fact Checker',
      'brand-voice': 'Brand Voice Analyst',
      'seo-intelligence': 'SEO Intelligence Analyst',
      'multi-cms-publish': 'CMS Publisher',
      'pexels-image': 'Image Fetcher',
      'editorial-workflow': 'Editorial Processor',
      'content-intelligence': 'Content Intelligence Analyst',
      'ai-evaluation': 'AI Evaluator',
      'client-scan': 'Client Scanner',
      'batch-client-scan': 'Batch Scanner',
      'default': 'Job Processor'
    };

    const role = roleMap[jobType] || roleMap.default || 'Worker';
    return `${baseTitle} ${role}`;
  }

  private getNextTierUp(
    currentTier: WorkerTier,
    thresholds: PerformanceThreshold[]
  ): PerformanceThreshold | undefined {
    const sorted = [...thresholds].sort((a, b) => b.min_score - a.min_score);
    const currentIndex = sorted.findIndex(t => t.tier_name === currentTier);
    if (currentIndex > 0) {
      return sorted[currentIndex - 1];
    }
    return undefined; // Already at top
  }

  private getNextTierDown(
    currentTier: WorkerTier,
    thresholds: PerformanceThreshold[]
  ): PerformanceThreshold | undefined {
    const sorted = [...thresholds].sort((a, b) => b.min_score - a.min_score);
    const currentIndex = sorted.findIndex(t => t.tier_name === currentTier);
    if (currentIndex < sorted.length - 1) {
      return sorted[currentIndex + 1];
    }
    return undefined; // Already at bottom
  }

  private isHigherTier(tier: WorkerTier, compareTo: WorkerTier): boolean {
    const order: WorkerTier[] = ['elite', 'senior', 'standard', 'junior', 'probation'];
    return order.indexOf(tier) < order.indexOf(compareTo);
  }

  async close(): Promise<void> {
    if (this.scoringInterval) {
      clearInterval(this.scoringInterval);
      this.scoringInterval = null;
    }
    logger.info('Worker Scoring Engine closed');
  }
}

export default new WorkerScoringEngine();
