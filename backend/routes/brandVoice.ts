// ══════════════════════════════════════════════════════════════════
// Brand Voice Routes
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import brandVoice from '../services/brandVoice';

export function createBrandVoiceRoutes(pool: Pool): Router {
  const router = Router();
  brandVoice.initialize(pool);

  // Get brand voice profile
  router.get('/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const profile = await brandVoice.getProfile(req.params.clientId);
      res.json({ success: true, data: profile });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Create or update brand voice profile
  router.put('/:clientId', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const profile = await brandVoice.createOrUpdateProfile(req.params.clientId, req.body);
      res.json({ success: true, data: profile });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get content guidance
  router.get('/:clientId/guidance', authenticate, async (req: Request, res: Response) => {
    try {
      const guidance = await brandVoice.getContentGuidance(req.params.clientId);
      res.json({ success: true, data: guidance });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Store a sample embedding
  router.post('/:clientId/embeddings', authenticate, async (req: Request, res: Response) => {
    try {
      await brandVoice.storeSampleEmbedding(req.params.clientId, req.body.content_snippet, req.body.source_type);
      res.json({ success: true, message: 'Embedding stored' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Check brand consistency
  router.post('/:clientId/consistency-check', authenticate, async (req: Request, res: Response) => {
    try {
      const result = await brandVoice.checkConsistency(req.params.clientId, req.body.content);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Analyze writing fingerprint
  router.get('/:clientId/fingerprint', authenticate, async (req: Request, res: Response) => {
    try {
      const fingerprint = await brandVoice.analyzeWritingFingerprint(req.params.clientId);
      res.json({ success: true, data: fingerprint });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
