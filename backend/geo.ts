import { Router, Request, Response } from 'express';
import { authenticate, authorize } from './middleware/auth';
import geoIntelligence from './services/geoIntelligence';

export function createGeoRoutes(): Router {
  const router = Router();

  // POST /api/geo/analyze — analyze content for GEO readiness
  router.post('/analyze', authenticate, async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      if (!content || content.length < 100) {
        return res.status(400).json({
          success: false,
          error: 'Content is required (min 100 characters)',
        });
      }

      const analysis = await geoIntelligence.analyze(content);
      res.json({ success: true, data: analysis });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/geo/improve — rewrite content for better GEO
  router.post('/improve', authenticate, async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      if (!content || content.length < 100) {
        return res.status(400).json({
          success: false,
          error: 'Content is required (min 100 characters)',
        });
      }

      const improved = await geoIntelligence.improveContent(content);
      const analysis = await geoIntelligence.analyze(improved);

      res.json({
        success: true,
        data: {
          original_length: content.length,
          improved_length: improved.length,
          improved_content: improved,
          analysis,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
