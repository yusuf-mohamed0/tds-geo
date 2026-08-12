// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ──────────────────────────────────────────────
// Self-Improvement Engine
// Analyzes system performance, detects patterns,
// and suggests automatic optimizations
// ──────────────────────────────────────────────

import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface ImprovementSuggestion {
  category: string;
  metric: string;
  value: number;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  autoFixable: boolean;
}

export class SelfImprovementService {
  private pool: Pool | null = null;
  private analysisInterval: NodeJS.Timeout | null = null;

  initialize(pool: Pool): void {
    this.pool = pool;
    logger.info('Self-improvement service initialized');

    // Run analysis every 6 hours
    this.analysisInterval = setInterval(() => this.runFullAnalysis(), 6 * 60 * 60 * 1000);

    // Run an initial analysis after 5 minutes
    setTimeout(() => this.runFullAnalysis(), 5 * 60 * 1000);
  }

  async runFullAnalysis(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];

    logger.info('Running self-improvement analysis...');
    const suggestions: ImprovementSuggestion[] = [];

    try {
      const analyses = await Promise.all([
        this.analyzeJobFailures(),
        this.analyzeContentQuality(),
        this.analyzeKeywordPerformance(),
        this.analyzeCostEfficiency(),
        this.analyzePromptPerformance(),
        this.analyzePublishingPatterns(),
        this.analyzeErrorTrends(),
      ]);

      for (const analysis of analyses) {
        suggestions.push(...analysis);
      }

      // Store suggestions
      for (const s of suggestions) {
        await this.storeSuggestion(s);
      }

      // Auto-fix high-priority issues
      const highPriority = suggestions.filter(s => s.priority === 'high' && s.autoFixable);
      for (const s of highPriority) {
        await this.autoFix(s);
      }

      logger.info(`Self-improvement analysis complete: ${suggestions.length} suggestions (${highPriority.length} auto-fixed)`);
    } catch (err) {
      logger.error('Self-improvement analysis failed', { error: (err as Error).message });
    }

    return suggestions;
  }

  private async analyzeJobFailures(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];
    const suggestions: ImprovementSuggestion[] = [];

    // Check if jobs fail frequently
    const failures = await this.pool.query(`
      SELECT COUNT(*)::int as total_failures,
             COUNT(DISTINCT type)::int as affected_queues
      FROM jobs WHERE status = 'failed' AND queued_at > NOW() - INTERVAL '24 hours'
    `);

    if (failures.rows[0].total_failures > 10) {
      suggestions.push({
        category: 'queue',
        metric: 'job_failures_24h',
        value: failures.rows[0].total_failures,
        suggestion: `High job failure rate (${failures.rows[0].total_failures} in 24h). Consider increasing max_attempts or checking API keys.`,
        priority: 'high',
        autoFixable: true,
      });
    }

    // Check dead-letter queue
    const dlq = await this.pool.query(`
      SELECT COUNT(*)::int as dlq_count
      FROM activity_logs WHERE action = 'dead_letter' AND created_at > NOW() - INTERVAL '7 days'
    `);

    if (dlq.rows[0].dlq_count > 5) {
      suggestions.push({
        category: 'queue',
        metric: 'dead_letter_count_7d',
        value: dlq.rows[0].dlq_count,
        suggestion: `${dlq.rows[0].dlq_count} jobs in dead-letter queue. Review and re-queue failed jobs.`,
        priority: 'high',
        autoFixable: false,
      });
    }

    return suggestions;
  }

  private async analyzeContentQuality(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];
    const suggestions: ImprovementSuggestion[] = [];

    // Average SEO score trend
    const seo = await this.pool.query(`
      SELECT
        COALESCE(AVG(seo_score) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0)::decimal(5,1) as recent_avg,
        COALESCE(AVG(seo_score) FILTER (WHERE created_at > NOW() - INTERVAL '30 days' AND created_at <= NOW() - INTERVAL '7 days'), 0)::decimal(5,1) as prev_avg,
        COUNT(*)::int as total_articles_7d
      FROM articles WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const { recent_avg, prev_avg, total_articles_7d } = seo.rows[0];
    if (total_articles_7d > 0 && recent_avg < 75) {
      suggestions.push({
        category: 'content',
        metric: 'avg_seo_score',
        value: recent_avg,
        suggestion: `Average SEO score is ${recent_avg}/100. Consider updating prompt templates for better keyword optimization and structure.`,
        priority: 'medium',
        autoFixable: false,
      });
    }

    if (prev_avg > 0 && recent_avg < prev_avg - 5) {
      suggestions.push({
        category: 'content',
        metric: 'seo_score_trend',
        value: recent_avg - prev_avg,
        suggestion: `SEO score dropped by ${(prev_avg - recent_avg).toFixed(1)} points compared to previous period. Review recent prompt changes.`,
        priority: 'high',
        autoFixable: false,
      });
    }

    return suggestions;
  }

  private async analyzeKeywordPerformance(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];
    const suggestions: ImprovementSuggestion[] = [];

    // Unused keywords
    const unused = await this.pool.query(`
      SELECT COUNT(*)::int as unused_count
      FROM keywords WHERE is_active = true AND last_used_at IS NULL
    `);

    if (unused.rows[0].unused_count > 50) {
      suggestions.push({
        category: 'keywords',
        metric: 'unused_keywords',
        value: unused.rows[0].unused_count,
        suggestion: `Found ${unused.rows[0].unused_count} unused keywords. Consider deactivating low-relevance ones.`,
        priority: 'low',
        autoFixable: true,
      });
    }

    // Low relevance keywords
    const lowRel = await this.pool.query(`
      SELECT COUNT(*)::int as low_count
      FROM keywords WHERE is_active = true AND relevance_score < 30
    `);

    if (lowRel.rows[0].low_count > 20) {
      suggestions.push({
        category: 'keywords',
        metric: 'low_relevance_keywords',
        value: lowRel.rows[0].low_count,
        suggestion: `${lowRel.rows[0].low_count} keywords have relevance score < 30. Consider replacing them.`,
        priority: 'medium',
        autoFixable: true,
      });
    }

    return suggestions;
  }

  private async analyzeCostEfficiency(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];
    const suggestions: ImprovementSuggestion[] = [];

    // Monthly cost trend
    const costs = await this.pool.query(`
      SELECT
        COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0)::decimal(10,2) as cost_7d,
        COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '30 days' AND created_at <= NOW() - INTERVAL '7 days'), 0)::decimal(10,2) as cost_prev_21d,
        COALESCE(AVG(cost_usd), 0)::decimal(10,4) as avg_cost_per_call
      FROM cost_tracking WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const { cost_7d, cost_prev_21d, avg_cost_per_call } = costs.rows[0];
    const weeklyAvg = cost_prev_21d / 3;

    if (weeklyAvg > 0 && cost_7d > weeklyAvg * 1.5) {
      suggestions.push({
        category: 'cost',
        metric: 'cost_spike',
        value: cost_7d,
        suggestion: `Cost spike detected: $${cost_7d} this week vs $${weeklyAvg.toFixed(2)} weekly average. Consider switching to more cost-efficient models.`,
        priority: 'high',
        autoFixable: false,
      });
    }

    if (avg_cost_per_call > 0.05) {
      suggestions.push({
        category: 'cost',
        metric: 'avg_cost_per_call',
        value: avg_cost_per_call,
        suggestion: `Average cost per API call is $${avg_cost_per_call}. Consider using cheaper models for non-critical tasks.`,
        priority: 'medium',
        autoFixable: true,
      });
    }

    return suggestions;
  }

  private async analyzePromptPerformance(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];
    const suggestions: ImprovementSuggestion[] = [];

    let prompts;
    try {
      prompts = await this.pool.query(`
        SELECT id, name, COALESCE(slug, name) as slug,
               COALESCE(performance->>'avgScore', performance->>'avg_score', '0') as avg_score,
               COALESCE(performance->>'totalRuns', performance->>'total_runs', '0') as total_runs
        FROM prompt_templates WHERE is_active = true
      `);
    } catch (err: any) {
      if (err?.code === '42703' || err?.code === '42P01') {
        logger.warn('Prompt performance analysis skipped; prompt template schema is incomplete', { error: err.message });
        return [];
      }
      throw err;
    }

    for (const p of prompts.rows) {
      const avgScore = parseFloat(p.avg_score || '0');
      const totalRuns = parseInt(p.total_runs || '0');

      if (totalRuns > 10 && avgScore < 70) {
        suggestions.push({
          category: 'prompts',
          metric: `prompt_quality_${p.slug}`,
          value: avgScore,
          suggestion: `Prompt "${p.name}" has avg score ${avgScore} after ${totalRuns} runs. Consider revising system prompt or lowering temperature.`,
          priority: 'medium',
          autoFixable: false,
        });
      }
    }

    return suggestions;
  }

  private async analyzePublishingPatterns(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];
    const suggestions: ImprovementSuggestion[] = [];

    // Approvals bottleneck
    const pending = await this.pool.query(`
      SELECT COUNT(*)::int as pending_review
      FROM articles WHERE status = 'generated' AND created_at < NOW() - INTERVAL '48 hours'
    `);

    if (pending.rows[0].pending_review > 5) {
      suggestions.push({
        category: 'workflow',
        metric: 'articles_pending_review_48h',
        value: pending.rows[0].pending_review,
        suggestion: `${pending.rows[0].pending_review} articles pending review for >48h. Consider enabling auto-approval for trusted editors.`,
        priority: 'medium',
        autoFixable: true,
      });
    }

    return suggestions;
  }

  private async analyzeErrorTrends(): Promise<ImprovementSuggestion[]> {
    if (!this.pool) return [];
    const suggestions: ImprovementSuggestion[] = [];
    const now = new Date();

    // Spike in errors
    const errors = await this.pool.query(`
      SELECT
        COUNT(*)::int as errors_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int as errors_1h
      FROM activity_logs WHERE level = 'error' AND created_at > NOW() - INTERVAL '24 hours'
    `);

    const { errors_24h, errors_1h } = errors.rows[0];
    if (errors_1h > 10) {
      suggestions.push({
        category: 'system',
        metric: 'error_spike',
        value: errors_1h,
        suggestion: `Error spike detected: ${errors_1h} errors in the last hour (${errors_24h} in 24h). Immediate investigation recommended.`,
        priority: 'high',
        autoFixable: false,
      });
    }

    return suggestions;
  }

  private async storeSuggestion(suggestion: ImprovementSuggestion): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO improvement_logs (category, metric, value, suggestion, context)
         VALUES ($1, $2, $3, $4, $5)`,
        [suggestion.category, suggestion.metric, suggestion.value, suggestion.suggestion,
         JSON.stringify({ priority: suggestion.priority, autoFixable: suggestion.autoFixable })]
      );
    } catch {
      // Non-critical
    }
  }

  private async autoFix(suggestion: ImprovementSuggestion): Promise<void> {
    if (!this.pool) return;
    logger.info('Auto-fixing suggestion', { category: suggestion.category, metric: suggestion.metric });

    try {
      switch (suggestion.metric) {
        case 'job_failures_24h':
          await this.pool.query(
            `UPDATE system_config SET value = '8', updated_at = NOW()
             WHERE key = 'queue.max_attempts'`
          );
          break;

        case 'unused_keywords':
          await this.pool.query(
            `UPDATE keywords SET is_active = false
             WHERE is_active = true AND last_used_at IS NULL AND relevance_score < 20`
          );
          break;

        case 'low_relevance_keywords':
          await this.pool.query(
            `UPDATE keywords SET is_active = false
             WHERE is_active = true AND relevance_score < 15`
          );
          break;

        case 'avg_cost_per_call':
          await this.pool.query(
            `UPDATE system_config SET value = '"gpt-4o-mini"', updated_at = NOW()
             WHERE key = 'default_model'`
          );
          break;

        case 'articles_pending_review_48h':
          // Only auto-fix for clients with auto mode enabled
          await this.pool.query(
            `UPDATE clients SET approval_mode = 'auto'
             WHERE approval_mode = 'manual' AND id IN (
               SELECT client_id FROM articles
               WHERE status = 'generated' AND created_at < NOW() - INTERVAL '48 hours'
               GROUP BY client_id HAVING COUNT(*) > 3
             )`
          );
          break;
      }

      // Mark as implemented
      await this.pool.query(
        `UPDATE improvement_logs SET implemented = true
         WHERE metric = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [suggestion.metric]
      );

    } catch (err) {
      logger.error('Auto-fix failed', { metric: suggestion.metric, error: (err as Error).message });
    }
  }

  /**
   * Get recent improvement suggestions.
   */
  async getSuggestions(limit: number = 20): Promise<any[]> {
    if (!this.pool) return [];
    const result = await this.pool.query(
      `SELECT * FROM improvement_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get system-wide performance stats.
   */
  async getPerformanceStats(): Promise<Record<string, unknown>> {
    if (!this.pool) return {};

    const results = await Promise.all([
      this.pool.query(`SELECT COUNT(*)::int as total FROM improvement_logs WHERE implemented = true`),
      this.pool.query(`SELECT COUNT(*)::int as total FROM improvement_logs WHERE implemented = false`),
      this.pool.query(`
        SELECT category, COUNT(*)::int as count,
               COALESCE(AVG(value)::decimal(10,2), 0) as avg_value
        FROM improvement_logs GROUP BY category ORDER BY count DESC
      `),
    ]);

    return {
      implementedFixes: results[0].rows[0].total,
      pendingSuggestions: results[1].rows[0].total,
      byCategory: results[2].rows,
    };
  }

  async close(): Promise<void> {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    logger.info('Self-improvement service closed');
  }
}

export default new SelfImprovementService();
