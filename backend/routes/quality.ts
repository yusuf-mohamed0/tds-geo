import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, scopeQueryByClient } from '../middleware/auth';
import articleEvaluator from '../services/articleEvaluator';
import promptReflection from '../services/promptReflection';

export function createQualityRoutes(pool: Pool): Router {
  const router = Router();

  router.use(authenticate);

  // Evaluate a generated article
  router.post('/evaluate', scopeQueryByClient, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { keyword, articleId } = req.body;
      const clientId = (req as any).user?.clientId;

      if (!keyword && !articleId) {
        res.status(400).json({ error: 'Provide keyword or articleId' });
        return;
      }

      let article: { title: string; content: string; metaDescription?: string } | null = null;

      if (articleId) {
        const result = await pool.query(
          'SELECT title, content_md as content, meta_description as "metaDescription" FROM articles WHERE id = $1',
          [articleId]
        );
        if (result.rows.length === 0) {
          res.status(404).json({ error: 'Article not found' });
          return;
        }
        article = result.rows[0];
      }

      if (!article) {
        res.status(400).json({ error: 'Cannot evaluate without content. Provide articleId or content.' });
        return;
      }

      const evaluation = await articleEvaluator.evaluate(
        article,
        keyword || article.title
      );

      res.json(evaluation);
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
      const clientId = (req as any).user?.clientId;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      let query = `
        SELECT ae.article_id AS "id", a.title, ae.overall_score AS "score", ae.dimensions, ae.summary, ae.evaluated_at AS "evaluatedAt"
        FROM article_evaluations ae
        JOIN articles a ON a.id = ae.article_id
      `;
      const params: any[] = [];

      if (clientId) {
        params.push(clientId);
        query += ` WHERE ae.client_id = $1`;
      }

      params.push(limit);
      query += ` ORDER BY ae.overall_score ASC LIMIT $${params.length}`;

      const result = await pool.query(query, params);
      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
