import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, scopeQueryByClient } from '../middleware/auth';
import promptReflection from '../services/promptReflection';
import qualityScorer from '../services/qualityScorer';

interface ArticleForQualityAudit {
  id: string;
  client_id: string;
  title: string;
  content: string;
  meta_description: string | null;
  meta_title: string | null;
  keyword: string | null;
}

export function createQualityRoutes(pool: Pool): Router {
  const router = Router();
  const qualityThreshold = parseInt(process.env.QUALITY_GATE_THRESHOLD || '65', 10);

  const requestedClientId = (req: Request): string | undefined => {
    const user = (req as any).user;
    if (user?.clientId && user.role !== 'admin' && user.role !== 'super_admin') return user.clientId;
    return req.query.clientId as string | undefined;
  };

  const evaluateAndStore = async (article: ArticleForQualityAudit) => {
    const score = await qualityScorer.scoreArticle(
      article.content,
      article.keyword || article.title,
      article.meta_title || undefined,
      article.meta_description || undefined,
    );
    const summary = score.suggestions.join(' ');

    await pool.query(
      `INSERT INTO article_evaluations (article_id, client_id, overall_score, dimensions, summary, evaluated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (article_id) DO UPDATE SET
         overall_score = EXCLUDED.overall_score,
         dimensions = EXCLUDED.dimensions,
         summary = EXCLUDED.summary,
         evaluated_at = NOW()`,
      [article.id, article.client_id, score.overall, JSON.stringify(score.breakdown), summary],
    );
    await pool.query('UPDATE articles SET quality_score = $1, updated_at = NOW() WHERE id = $2', [score.overall, article.id]);

    return { score: score.overall, dimensions: score.breakdown, summary };
  };

  router.use(authenticate);

  // Evaluate a generated article
  router.post('/evaluate', scopeQueryByClient, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { articleId } = req.body;
      const clientId = requestedClientId(req);

      if (!articleId) {
        res.status(400).json({ error: 'articleId is required' });
        return;
      }

      const params: string[] = [articleId];
      let query = `SELECT a.id, a.client_id, a.title, a.content_md AS content, a.meta_description, a.meta_title, k.keyword
                   FROM articles a LEFT JOIN keywords k ON k.id = a.keyword_id
                   WHERE a.id = $1`;
      if (clientId) {
        params.push(clientId);
        query += ` AND a.client_id = $${params.length}`;
      }
      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      const evaluation = await evaluateAndStore(result.rows[0]);
      res.json(evaluation);
    } catch (err) {
      next(err);
    }
  });

  // Run the deterministic quality audit for every accessible article and persist the results.
  router.post('/evaluate-all', authorize('admin', 'super_admin'), scopeQueryByClient, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = requestedClientId(req);
      const params: string[] = [];
      let query = `SELECT a.id, a.client_id, a.title, a.content_md AS content, a.meta_description, a.meta_title, k.keyword
                   FROM articles a
                   JOIN clients c ON c.id = a.client_id AND c.is_active = true
                   LEFT JOIN keywords k ON k.id = a.keyword_id
                   WHERE a.content_md IS NOT NULL AND BTRIM(a.content_md) <> ''`;
      if (clientId) {
        params.push(clientId);
        query += ` AND a.client_id = $1`;
      }

      const result = await pool.query(query, params);
      for (const article of result.rows as ArticleForQualityAudit[]) {
        await evaluateAndStore(article);
      }

      res.json({ evaluated: result.rows.length, threshold: qualityThreshold });
    } catch (err) {
      next(err);
    }
  });

  // Full GEPA reflection cycle — evaluate + reflect + auto-improve prompt
  router.post('/reflect', authorize('admin', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { articleId } = req.body;
      const clientId = (req as any).user?.clientId;

      if (!articleId) {
        res.status(400).json({ error: 'articleId is required' });
        return;
      }

      const result = await pool.query(
        `SELECT a.title, a.content_md as content, a.meta_description as "metaDescription", k.keyword
         FROM articles a
         LEFT JOIN keywords k ON k.id = a.keyword_id
         WHERE a.id = $1`,
        [articleId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Article not found' });
        return;
      }

      const article = result.rows[0];
      const cycleResult = await promptReflection.runFullCycle(
        pool,
        articleId,
        clientId || 'system',
        article,
        article.keyword || article.title
      );

      res.json(cycleResult);
    } catch (err) {
      next(err);
    }
  });

  // Get recent evaluations for an article
  router.get('/evaluations/:articleId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query(
        `SELECT overall_score, dimensions, summary, evaluated_at
         FROM article_evaluations
         WHERE article_id = $1
         ORDER BY evaluated_at DESC
         LIMIT 10`,
        [req.params.articleId]
      );

      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  });

  // List lowest-scoring articles
  router.get('/low-quality', scopeQueryByClient, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = requestedClientId(req);
      const limit = parseInt(req.query.limit as string, 10) || 20;

      let query = `
        SELECT ae.article_id AS "id", a.title, ae.overall_score AS "score", ae.dimensions, ae.summary, ae.evaluated_at AS "evaluatedAt"
        FROM article_evaluations ae
        JOIN articles a ON a.id = ae.article_id
      `;
      const params: any[] = [qualityThreshold];
      const conditions = ['ae.overall_score < $1'];

      if (clientId) {
        params.push(clientId);
        conditions.push(`ae.client_id = $${params.length}`);
      }

      params.push(limit);
      query += ` WHERE ${conditions.join(' AND ')} ORDER BY ae.overall_score ASC LIMIT $${params.length}`;

      const result = await pool.query(query, params);
      res.json({ data: result.rows, threshold: qualityThreshold });
    } catch (err) {
      next(err);
    }
  });

  router.get('/summary', scopeQueryByClient, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientId = requestedClientId(req);
      const params: any[] = [qualityThreshold];
      let query = `SELECT COUNT(a.id)::int AS total_articles,
                          COUNT(ae.article_id)::int AS evaluated_articles,
                          COUNT(ae.article_id) FILTER (WHERE ae.overall_score >= $1)::int AS healthy_articles,
                          COUNT(ae.article_id) FILTER (WHERE ae.overall_score < $1)::int AS low_quality_articles,
                          COUNT(a.id) FILTER (WHERE ae.article_id IS NULL)::int AS pending_articles
                   FROM articles a
                   JOIN clients c ON c.id = a.client_id AND c.is_active = true
                   LEFT JOIN article_evaluations ae ON ae.article_id = a.id`;
      if (clientId) {
        params.push(clientId);
        query += ` WHERE a.client_id = $${params.length}`;
      }

      const result = await pool.query(query, params);
      res.json({ ...result.rows[0], threshold: qualityThreshold });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
