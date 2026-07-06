// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate, geoAnalyzeSchema, geoImproveSchema } from '../validators/index';
import geoIntelligence from '../services/geoIntelligence';

export function createGeoRoutes(): Router {
  const router = Router();

  // POST /api/geo/analyze — analyze content for GEO readiness
  router.post('/analyze', authenticate, validate(geoAnalyzeSchema), async (req: Request, res: Response) => {
    try {
      const { content } = req.body;

      const analysis = await geoIntelligence.analyze(content);
      res.json({ success: true, data: analysis });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/geo/analyze-url — analyze a full URL for GEO readiness
  router.post('/analyze-url', authenticate, async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'url is required' });
        return;
      }
      const result = await geoIntelligence.analyzeUrl(url);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `URL analysis failed: ${err.message}` });
    }
  });

  // POST /api/geo/improve — rewrite content for better GEO
  router.post('/improve', authenticate, validate(geoImproveSchema), async (req: Request, res: Response) => {
    try {
      const { content } = req.body;

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
