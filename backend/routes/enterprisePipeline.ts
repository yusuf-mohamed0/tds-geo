// ══════════════════════════════════════════════════════════════════
// Enterprise Pipeline Orchestrator Routes
// Combines all upgraded systems into a unified content operations pipeline
// ══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize } from '../middleware/auth';
import { clientRateLimit } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import openaiService from '../services/openai';
import seoService from '../services/seo';
import seoIntelligence from '../services/seoIntelligence';
import factCheckService from '../services/factCheckService';
import brandVoice from '../services/brandVoice';
import editorialWorkflow from '../services/editorialWorkflow';
import contentIntelligence from '../services/contentIntelligence';
import aiEvaluation from '../services/aiEvaluation';
import pexelsService from '../services/pexelsService';
import enterpriseSecurity from '../services/enterpriseSecurity';
import CostOptimizationService from '../services/costOptimization';
import observability from '../services/observability';

export function createEnterprisePipelineRoutes(pool: Pool): Router {
  const router = Router();

  // Initialize all services
  seoIntelligence.initialize(pool);
  factCheckService.initialize(pool);
  brandVoice.initialize(pool);
  editorialWorkflow.initialize(pool);
  contentIntelligence.initialize(pool);
  aiEvaluation.initialize(pool);
  pexelsService.initialize(pool);
  enterpriseSecurity.initialize(pool);
  CostOptimizationService.getInstance().initialize(pool);
  observability.initialize(pool);

  // ════════════════════════════════════════════════════
  // FULL ENTERPRISE PIPELINE
  // ════════════════════════════════════════════════════

  router.post('/run', clientRateLimit({ windowMs: 60_000, max: 5, name: 'enterprise-run', message: 'Pipeline run limit reached. Max 5 per minute.' }), authenticate, authorize('editor', 'admin'), async (req: Request, res: Response) => {
    const traceId = observability.startSpan({ name: 'enterprise_pipeline' });

    try {
      const { client_id, keyword, brand_voice_override } = req.body;
      if (!client_id || !keyword) {
        return res.status(400).json({ success: false, error: 'client_id and keyword are required' });
      }

      const result: Record<string, any> = {
        pipeline: 'enterprise',
        clientId: client_id,
        keyword,
        stages: {},
        startedAt: new Date().toISOString()
      };

      // ── Stage 1: Search Intent & SERP Analysis ──
      const intentSpan = observability.startSpan({ name: 'pipeline.serp_analysis' });
      try {
        const [intent, serp] = await Promise.all([
          seoIntelligence.classifySearchIntent(keyword),
          seoIntelligence.analyzeSERP(keyword)
        ]);
        result.stages.serp_analysis = { intent, serpFeatures: serp.serpFeatures, entityLandscape: serp.entityLandscape };
        logger.info(`SERP analysis complete for "${keyword}"`, { intent: intent.intent });
      } catch (err: any) {
        result.stages.serp_analysis = { error: err.message };
      } finally {
        observability.endSpan(intentSpan);
      }

      // ── Stage 2: Brand Voice Enhancement ──
      const bvSpan = observability.startSpan({ name: 'pipeline.brand_voice' });
      let brandGuidance = '';
      try {
        const guidance = await brandVoice.getContentGuidance(client_id);
        brandGuidance = JSON.stringify(guidance);
        result.stages.brand_voice = { hasProfile: true, forbiddenPhrases: guidance.forbiddenPhrases.length };
      } catch (err: any) {
        result.stages.brand_voice = { hasProfile: false, error: err.message };
      } finally {
        observability.endSpan(bvSpan);
      }

      // ── Stage 3: Content Generation ──
      const genSpan = observability.startSpan({ name: 'pipeline.content_generation' });
      let generatedContent: any = null;
      try {
        generatedContent = await openaiService.generateBlogPost({
          keyword,
          tone: 'professional',
          clientSettings: { brandVoice: brandGuidance }
        });
        result.stages.generation = {
          title: generatedContent.title,
          wordCount: generatedContent.content.split(/\s+/).length,
          model: generatedContent.metadata?.model || 'unknown'
        };
      } catch (err: any) {
        result.stages.generation = { error: err.message };
        // Don't fail the whole pipeline — mark as failed
        result.success = false;
      } finally {
        observability.endSpan(genSpan);
      }

      if (generatedContent) {
        const fullContent = generatedContent.content;

        // ── Stage 4: SEO Intelligence Analysis ──
        const seoSpan = observability.startSpan({ name: 'pipeline.seo_analysis' });
        try {
          const [seoAnalysis, topicalAuthority] = await Promise.all([
            seoIntelligence.analyzeContentSEO(fullContent, keyword),
            seoIntelligence.analyzeTopicalAuthority(fullContent, keyword, result.stages.serp_analysis?.entityLandscape || [])
          ]);
          result.stages.seo_analysis = { score: seoAnalysis.score, topicalAuthority, suggestions: seoAnalysis.suggestions };
        } catch (err: any) {
          result.stages.seo_analysis = { error: err.message };
        } finally {
          observability.endSpan(seoSpan);
        }

        // ── Stage 5: Fact Checking ──
        const fcSpan = observability.startSpan({ name: 'pipeline.fact_checking' });
        try {
          const factCheckResult = await factCheckService.verifyArticle('', client_id, fullContent);
          result.stages.fact_checking = {
            totalClaims: factCheckResult.factChecks.length,
            citations: factCheckResult.citations.length,
            overallConfidence: factCheckResult.overallConfidence,
            requiresHumanReview: factCheckResult.requiresHumanReview
          };
        } catch (err: any) {
          result.stages.fact_checking = { error: err.message };
        } finally {
          observability.endSpan(fcSpan);
        }

        // ── Stage 6: Content Quality Evaluation ──
        const evalSpan = observability.startSpan({ name: 'pipeline.quality_evaluation' });
        try {
          const qaReport = await aiEvaluation.generateQualityReport(fullContent, keyword, brandGuidance);
          result.stages.quality_evaluation = {
            overall: qaReport.qualityScore.overall,
            dimensions: qaReport.qualityScore.dimensions,
            rankingPotential: qaReport.estimatedRankingPotential
          };
        } catch (err: any) {
          result.stages.quality_evaluation = { error: err.message };
        } finally {
          observability.endSpan(evalSpan);
        }

        // ── Stage 7: Image Selection ──
        const imgSpan = observability.startSpan({ name: 'pipeline.image_selection' });
        try {
          const images = await pexelsService.findImagesForArticle(
            client_id,
            generatedContent.title,
            keyword,
            []
          );
          result.stages.images = {
            featuredImage: images.featuredImage.url,
            sectionImages: images.sectionImages.length
          };
        } catch (err: any) {
          result.stages.images = { error: err.message };
        } finally {
          observability.endSpan(imgSpan);
        }

        // ── Stage 8: Cannibalization Check ──
        const cannSpan = observability.startSpan({ name: 'pipeline.cannibalization_check' });
        try {
          const cannibalization = await contentIntelligence
            .detectCannibalization(client_id, '', generatedContent.title, fullContent)
            .catch(() => []);
          result.stages.cannibalization = {
            overlaps: cannibalization.length,
            recommendation: cannibalization.length > 0 ? 'review' : 'ok'
          };
        } catch (err: any) {
          result.stages.cannibalization = { error: err.message };
        } finally {
          observability.endSpan(cannSpan);
        }
      }

      result.completedAt = new Date().toISOString();

      // Audit log
      await enterpriseSecurity.logAudit({
        client_id,
        user_id: (req as any).user?.userId,
        action: 'enterprise_pipeline_run',
        resource_type: 'pipeline',
        details: { keyword, stagesCompleted: Object.keys(result.stages).length },
        severity: 'info',
        outcome: 'success'
      } as any);

      // Persist pipeline run to database for history tracking
      try {
        const hasOverAllSuccess = result.success !== false;
        const startTime = new Date(result.startedAt).getTime();
        const endTime = new Date(result.completedAt).getTime();
        const durationMs = endTime - startTime;
        const title = result.stages.generation?.title || null;

        const insertResult = await pool.query(
          `INSERT INTO pipeline_runs (client_id, keyword, title, success, stages, duration_ms, pipeline_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, created_at`,
          [
            client_id, keyword, title, hasOverAllSuccess,
            JSON.stringify(result.stages), durationMs,
            JSON.stringify({ completedAt: result.completedAt })
          ]
        );
        result.id = insertResult.rows[0].id;
        result.created_at = insertResult.rows[0].created_at;
      } catch (dbErr: any) {
        logger.warn('Failed to persist pipeline run', { error: dbErr.message });
      }

      observability.endSpan(traceId);

      res.json({ success: true, data: result });
    } catch (err: any) {
      observability.endSpan(traceId, 'error', err.message);
      logger.error('Enterprise pipeline failed', { error: err.message });

      // Persist failed pipeline run for history
      try {
        const { client_id, keyword } = req.body;
        if (client_id && keyword) {
          await pool.query(
            `INSERT INTO pipeline_runs (client_id, keyword, success, stages, pipeline_data)
             VALUES ($1, $2, false, '{}'::jsonb, $3)`,
            [client_id, keyword, JSON.stringify({ error: err.message })]
          );
        }
      } catch (dbErr: any) {
        // Silently ignore DB persist failures on error path
      }

      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ════════════════════════════════════════════════════
  // OPTIMIZED CHEAP-TO-PREMIUM GENERATION
  // ════════════════════════════════════════════════════

  router.post('/optimized-generate', clientRateLimit({ windowMs: 60_000, max: 10, name: 'optimized-generate', message: 'Optimized generate limit reached. Max 10 per minute.' }), authenticate, authorize('editor', 'admin'), async (req: Request, res: Response) => {
    try {
      const { client_id, keyword, task_type } = req.body;
      const costOpt = CostOptimizationService.getInstance();

      // Use cheap model for outline, premium for full content
      const result = await costOpt.cheapThenPremium<string[]>(
        client_id || (req as any).user.clientId,
        task_type || 'blog_generation',
        'outline_generation',
        'content_generation',
        async (cheapModel) => {
          const outline = await openaiService.generateOutline(keyword, `Blog about ${keyword}`);
          return outline;
        },
        async (premiumModel, outline) => {
          const content = await openaiService.generateBlogPost({
            keyword,
            tone: 'professional',
            minWords: 1200,
            maxWords: 2500
          });
          return [content.title, content.content, content.metaTitle, content.metaDescription];
        }
      );

      res.json({ success: true, data: { title: result[0], content: result[1], metaTitle: result[2], metaDescription: result[3] } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ════════════════════════════════════════════════════
  // ENTITY EXTRACTION & KNOWLEDGE GRAPH BUILD
  // ════════════════════════════════════════════════════

  router.post('/build-knowledge-graph', authenticate, async (req: Request, res: Response) => {
    try {
      const { client_id, content } = req.body;
      const entities = await contentIntelligence.extractEntities(content, client_id);
      res.json({ success: true, data: { entities, count: entities.length } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ════════════════════════════════════════════════════
  // PIPELINE HISTORY & STATUS
  // ════════════════════════════════════════════════════

  router.get('/history/:clientId', authenticate, async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const user = (req as any).user;

      // Client-scoped users can only view their own pipeline history
      if (user.clientId && user.clientId !== clientId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const result = await pool.query(
        `SELECT id, client_id, keyword, title, success, stages, duration_ms, created_at
         FROM pipeline_runs
         WHERE client_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [clientId]
      );

      // Transform stages object into array format expected by the frontend
      const data = result.rows.map(row => {
        const stagesObj = row.stages || {};
        const stages = Object.entries(stagesObj).map(([name, data]: [string, any]) => ({
          name,
          status: data.error ? 'failed' : 'completed',
          ...(data || {})
        }));

        return {
          id: row.id,
          keyword: row.keyword,
          title: row.title,
          success: row.success,
          duration: row.duration_ms ? `${(row.duration_ms / 1000).toFixed(1)}s` : '—',
          stages,
          created_at: row.created_at
        };
      });

      res.json({ success: true, data });
    } catch (err: any) {
      logger.error('Failed to fetch pipeline history', { error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/status/:pipelineId', authenticate, async (req: Request, res: Response) => {
    try {
      const { pipelineId } = req.params;

      const result = await pool.query(
        `SELECT id, client_id, keyword, title, success, stages, duration_ms, created_at
         FROM pipeline_runs
         WHERE id = $1`,
        [pipelineId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Pipeline run not found' });
      }

      const row = result.rows[0];
      const stagesObj = row.stages || {};
      const stages = Object.entries(stagesObj).map(([name, data]: [string, any]) => ({
        name,
        status: data.error ? 'failed' : 'completed',
        ...(data || {})
      }));

      res.json({
        success: true,
        data: {
          id: row.id,
          keyword: row.keyword,
          title: row.title,
          success: row.success,
          duration: row.duration_ms ? `${(row.duration_ms / 1000).toFixed(1)}s` : '—',
          stages,
          created_at: row.created_at
        }
      });
    } catch (err: any) {
      logger.error('Failed to fetch pipeline status', { error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
