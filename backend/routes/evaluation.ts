// ══════════════════════════════════════════════════════════════════
// AI Evaluation Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import aiEvaluation from '../services/aiEvaluation';

export function createEvaluationRoutes(pool: Pool): Router {
  const router = Router();
  aiEvaluation.initialize(pool);

  // Evaluate content quality
  router.post('/evaluate-content', authenticate, async (req: Request, res: Response) => {
    try {
      const { content, keyword } = req.body;
      if (!content || !keyword) return res.status(400).json({ success: false, error: 'Content and keyword required' });

      const result = await aiEvaluation.evaluateContent(content, keyword);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generate comprehensive quality report
  router.post('/quality-report', authenticate, async (req: Request, res: Response) => {
    try {
      const { content, keyword, brand_voice_text } = req.body;
      if (!content || !keyword) return res.status(400).json({ success: false, error: 'Content and keyword required' });

      const report = await aiEvaluation.generateQualityReport(content, keyword, brand_voice_text);
      res.json({ success: true, data: report });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Evaluation history
  router.get('/history/:targetType/:targetId', authenticate, async (req: Request, res: Response) => {
    try {
      const history = await aiEvaluation.getEvaluationHistory(req.params.targetType, req.params.targetId);
      res.json({ success: true, data: history });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Benchmark management
  router.post('/benchmarks', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const dataset = await aiEvaluation.createBenchmark(req.body);
      res.json({ success: true, data: dataset });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/benchmarks/:datasetId/test-cases', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const testCase = await aiEvaluation.addTestCase({ ...req.body, dataset_id: req.params.datasetId });
      res.json({ success: true, data: testCase });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/benchmarks/:datasetId/run', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const results = await aiEvaluation.runBenchmark(req.params.datasetId);
      res.json({ success: true, data: results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // A/B testing
  router.post('/ab-tests', authenticate, authorize('editor'), async (req: Request, res: Response) => {
    try {
      const test = await aiEvaluation.createAbTest(req.body);
      res.json({ success: true, data: test });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.patch('/ab-tests/:testId/complete', authenticate, authorize('editor'), async (req: Request, res: Response) => {
    try {
      await aiEvaluation.completeAbTest(req.params.testId, req.body.winner, req.body.metrics || {});
      res.json({ success: true, message: 'A/B test completed' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
