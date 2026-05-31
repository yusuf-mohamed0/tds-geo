// ──────────────────────────────────────────────
// Analytics, Logs & SEO Tracking Routes
// ──────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorizeClientAccess } from '../middleware/auth';

export function createAnalyticsRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // ─── Client Overview Dashboard ───────────────
  router.get('/:clientId/overview', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = req.params.clientId;

      const [articleStats, keywordStats, publishStats, recentArticles, costSummary] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE status = 'published')::int as published,
                  COUNT(*) FILTER (WHERE status = 'generated')::int as pending,
                  COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
                  COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected,
                  COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
                  COALESCE(AVG(word_count)::int, 0)::int as avg_word_count,
                  COALESCE(AVG(seo_score)::decimal(5,1), 0) as avg_seo_score
           FROM articles WHERE client_id = $1`,
          [clientId]
        ),
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE last_used_at IS NULL)::int as unused,
                  COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '30 days')::int as used_30d
           FROM keywords WHERE client_id = $1 AND is_active = true`,
          [clientId]
        ),
        pool.query(
          `SELECT COUNT(*)::int as total,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int as last_30d
           FROM publishing_history WHERE client_id = $1`,
          [clientId]
        ),
        pool.query(
          `SELECT id, title, status, seo_score, word_count, created_at
           FROM articles WHERE client_id = $1
           ORDER BY created_at DESC LIMIT 5`,
          [clientId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(cost_usd)::decimal(10,2), 0) as total_cost,
                  COALESCE(SUM(tokens_in + tokens_out)::bigint, 0) as total_tokens,
                  COUNT(*)::int as api_calls
           FROM cost_tracking
           WHERE client_id = $1 AND created_at >= DATE_TRUNC('month', NOW())`,
          [clientId]
        )
      ]);

      res.json({
        articles: articleStats.rows[0],
        keywords: keywordStats.rows[0],
        publishing: publishStats.rows[0],
        recentArticles: recentArticles.rows,
        costs: costSummary.rows[0]
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Activity Logs ──────────────────────────
  router.get('/:clientId/logs', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { level, action, limit: limitStr, offset: offsetStr } = req.query;
      const limit = parseInt(limitStr as string, 10) || 50;
      const offset = parseInt(offsetStr as string, 10) || 0;

      let query = 'SELECT * FROM activity_logs WHERE client_id = $1';
      const params: any[] = [req.params.clientId];
      let paramIndex = 2;

      if (level) {
        query += ` AND level = $${paramIndex++}`;
        params.push(level);
      }
      if (action) {
        query += ` AND action = $${paramIndex++}`;
        params.push(action);
      }

      // Count
      const countResult = await pool.query(
        query.replace('SELECT *', 'SELECT COUNT(*)'), params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      query += ' ORDER BY created_at DESC';
      params.push(limit);
      query += ` LIMIT $${paramIndex++}`;
      params.push(offset);
      query += ` OFFSET $${paramIndex}`;

      const result = await pool.query(query, params);

      res.json({ data: result.rows, total, limit, offset });
    } catch (err) {
      next(err);
    }
  });

  // ─── Publishing History ─────────────────────
  router.get('/:clientId/history', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const result = await pool.query(
        `SELECT ph.*, a.title as article_title, a.seo_score, a.word_count
         FROM publishing_history ph
         LEFT JOIN articles a ON a.id = ph.article_id
         WHERE ph.client_id = $1
         ORDER BY ph.created_at DESC LIMIT $2 OFFSET $3`,
        [req.params.clientId, limit, offset]
      );

      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  });

  // ─── Cost Breakdown ─────────────────────────
  router.get('/:clientId/costs', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = req.query.period as string || 'month';

      let dateFilter: string;
      if (period === 'year') dateFilter = "created_at >= DATE_TRUNC('year', NOW())";
      else if (period === 'week') dateFilter = "created_at >= DATE_TRUNC('week', NOW())";
      else dateFilter = "created_at >= DATE_TRUNC('month', NOW())";

      const byProvider = await pool.query(
        `SELECT provider, COUNT(*)::int as calls,
                COALESCE(SUM(cost_usd)::decimal(10,2), 0) as total_cost,
                COALESCE(SUM(tokens_in + tokens_out)::bigint, 0) as total_tokens
         FROM cost_tracking
         WHERE client_id = $1 AND ${dateFilter}
         GROUP BY provider ORDER BY total_cost DESC`,
        [req.params.clientId]
      );

      const dailyBreakdown = await pool.query(
        `SELECT DATE(created_at) as date,
                COALESCE(SUM(cost_usd)::decimal(10,2), 0) as cost,
                COUNT(*)::int as calls
         FROM cost_tracking
         WHERE client_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [req.params.clientId]
      );

      const totals = await pool.query(
        `SELECT COALESCE(SUM(cost_usd)::decimal(10,2), 0) as total_cost,
                COALESCE(SUM(tokens_in + tokens_out)::bigint, 0) as total_tokens,
                COUNT(*)::int as total_calls,
                COUNT(*) FILTER (WHERE provider = 'openai')::int as openai_calls,
                COUNT(*) FILTER (WHERE provider = 'serpapi')::int as serpapi_calls
         FROM cost_tracking
         WHERE client_id = $1 AND ${dateFilter}`,
        [req.params.clientId]
      );

      res.json({
        period,
        totals: totals.rows[0],
        byProvider: byProvider.rows,
        dailyBreakdown: dailyBreakdown.rows
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── API Usage Dashboard (rich chart data) ──
  router.get('/:clientId/api-usage', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = 30 } = req.query;
      const dayCount = parseInt(days as string, 10) || 30;

      // Per-provider MTD and period totals
      const perProvider = await pool.query(`
        SELECT
          provider,
          COUNT(*)::int as calls,
          COALESCE(SUM(cost_usd)::decimal(10,4), 0) as total_cost,
          COALESCE(SUM(tokens_in)::bigint, 0) as tokens_in,
          COALESCE(SUM(tokens_out)::bigint, 0) as tokens_out,
          COALESCE(AVG(duration_ms)::int, 0) as avg_duration_ms
        FROM cost_tracking
        WHERE client_id = $1 AND created_at >= NOW() - $2::int * INTERVAL '1 day'
        GROUP BY provider
        ORDER BY total_cost DESC
      `, [req.params.clientId, dayCount]);

      // Per-model breakdown
      const perModel = await pool.query(`
        SELECT
          provider,
          COALESCE(model, 'unknown') as model,
          COUNT(*)::int as calls,
          COALESCE(SUM(cost_usd)::decimal(10,4), 0) as total_cost,
          COALESCE(SUM(tokens_in)::bigint, 0) as tokens_in,
          COALESCE(SUM(tokens_out)::bigint, 0) as tokens_out
        FROM cost_tracking
        WHERE client_id = $1 AND created_at >= NOW() - $2::int * INTERVAL '1 day'
        GROUP BY provider, model
        ORDER BY total_cost DESC
      `, [req.params.clientId, dayCount]);

      // Daily time series (cost + tokens by day)
      const dailySeries = await pool.query(`
        SELECT
          DATE(created_at) as date,
          COALESCE(SUM(cost_usd)::decimal(10,4), 0) as total_cost,
          COUNT(*)::int as total_calls,
          COALESCE(SUM(tokens_in + tokens_out)::bigint, 0) as total_tokens
        FROM cost_tracking
        WHERE client_id = $1 AND created_at >= NOW() - $2::int * INTERVAL '1 day'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [req.params.clientId, dayCount]);

      // Daily per-provider cost for stacked chart
      const dailyPerProvider = await pool.query(`
        SELECT
          DATE(created_at) as date,
          provider,
          COALESCE(SUM(cost_usd)::decimal(10,4), 0) as cost
        FROM cost_tracking
        WHERE client_id = $1 AND created_at >= NOW() - $2::int * INTERVAL '1 day'
        GROUP BY DATE(created_at), provider
        ORDER BY date, provider
      `, [req.params.clientId, dayCount]);

      // MTD totals
      const mtdTotals = await pool.query(`
        SELECT
          COUNT(*)::int as total_calls,
          COALESCE(SUM(cost_usd)::decimal(10,4), 0) as total_cost,
          COALESCE(SUM(tokens_in + tokens_out)::bigint, 0) as total_tokens,
          COALESCE(AVG(duration_ms)::int, 0) as avg_duration_ms,
          COALESCE(SUM(tokens_in)::bigint, 0) as total_tokens_in,
          COALESCE(SUM(tokens_out)::bigint, 0) as total_tokens_out
        FROM cost_tracking
        WHERE client_id = $1 AND created_at >= DATE_TRUNC('month', NOW())
      `, [req.params.clientId]);

      res.json({
        days: dayCount,
        mtd: mtdTotals.rows[0],
        perProvider: perProvider.rows,
        perModel: perModel.rows,
        dailySeries: dailySeries.rows,
        dailyPerProvider: dailyPerProvider.rows
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── SEO Analytics (if tracked) ─────────────
  router.get('/:clientId/seo', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = 30 } = req.query;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await pool.query(
        `SELECT sa.*, a.title as article_title, a.slug
         FROM seo_analytics sa
         JOIN articles a ON a.id = sa.article_id
         WHERE sa.client_id = $1 AND sa.tracked_date >= CURRENT_DATE - $2::int
         ORDER BY sa.tracked_date DESC LIMIT $3`,
        [req.params.clientId, days, limit]
      );

      // Aggregate stats
      const stats = await pool.query(
        `SELECT COALESCE(SUM(impressions), 0)::bigint as total_impressions,
                COALESCE(SUM(clicks), 0)::bigint as total_clicks,
                COALESCE(AVG(ctr)::decimal(5,4), 0) as avg_ctr,
                COALESCE(AVG(avg_position)::decimal(4,1), 0) as avg_position,
                COUNT(*) FILTER (WHERE indexed)::int as indexed_count
         FROM seo_analytics
         WHERE client_id = $1 AND tracked_date >= CURRENT_DATE - $2::int`,
        [req.params.clientId, days]
      );

      res.json({
        stats: stats.rows[0],
        recent: result.rows
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Keyword Analytics ──────────────────────
  router.get('/:clientId/keyword-analytics', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE last_used_at IS NULL)::int as unused,
                COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '7 days')::int as used_7d,
                COUNT(*) FILTER (WHERE last_used_at > NOW() - INTERVAL '30 days')::int as used_30d,
                COALESCE(AVG(search_volume)::int, 0) as avg_volume,
                COALESCE(AVG(competition)::decimal(4,2), 0) as avg_competition,
                COALESCE(AVG(relevance_score)::decimal(4,1), 0) as avg_relevance
         FROM keywords
         WHERE client_id = $1 AND is_active = true`,
        [req.params.clientId]
      );

      const topKeywords = await pool.query(
        `SELECT keyword, search_volume, competition, relevance_score, last_used_at
         FROM keywords WHERE client_id = $1 AND is_active = true
         ORDER BY relevance_score DESC, search_volume DESC LIMIT 20`,
        [req.params.clientId]
      );

      res.json({
        stats: result.rows[0],
        topKeywords: topKeywords.rows
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Queue / Job Status ─────────────────────
  router.get('/:clientId/jobs', authorizeClientAccess, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, limit: limitStr, offset: offsetStr } = req.query;
      const limit = parseInt(limitStr as string, 10) || 20;
      const offset = parseInt(offsetStr as string, 10) || 0;

      let query = 'SELECT * FROM jobs WHERE client_id = $1';
      const params: any[] = [req.params.clientId];
      let paramIndex = 2;

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      const countResult = await pool.query(
        query.replace('SELECT *', 'SELECT COUNT(*)'), params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      query += ' ORDER BY queued_at DESC';
      params.push(limit);
      query += ` LIMIT $${paramIndex++}`;
      params.push(offset);
      query += ` OFFSET $${paramIndex}`;

      const result = await pool.query(query, params);
      res.json({ data: result.rows, total, limit, offset });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
