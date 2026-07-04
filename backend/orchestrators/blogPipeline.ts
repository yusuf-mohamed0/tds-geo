// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Enterprise Blog Pipeline Orchestrator
// Central orchestration service that controls the
// full enterprise-grade AI SEO content pipeline
// ══════════════════════════════════════════════

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { createArticleRepo, ArticleRepo } from '../repositories/articleRepo';
import { createClientRepo, ClientRepo } from '../repositories/clientRepo';
import { createKeywordRepo, KeywordRepo } from '../repositories/keywordRepo';
import { createLogRepo, LogRepo } from '../repositories/logRepo';
import { convert } from '../utils/markdownToHtml';
import { QueueNames, addJob } from '../utils/queue';
import { Article } from '../types';
import { v4 as uuidv4 } from 'uuid';

// ─── Core Service Imports ────────────────────
import openaiService from '../services/openai';
import serpapiService from '../services/serpapi';
import shopifyService from '../services/shopify';
import keywordService from '../services/keywords';
import seoService from '../services/seo';
import qualityScorer from '../services/qualityScorer';
import internalLinksService from '../services/internalLinks';
import vectorMemoryService from '../services/vectorMemory';
import costTracker from '../services/costTracker';
import webhookService from '../services/webhooks';

// ─── Enterprise Service Imports ──────────────
import seoIntelligence from '../services/seoIntelligence';
import factCheckService from '../services/factCheckService';
import brandVoiceService from '../services/brandVoice';
import editorialWorkflowService from '../services/editorialWorkflow';
import contentIntelligence from '../services/contentIntelligence';
import aiEvaluationService from '../services/aiEvaluation';
import pexelsService from '../services/pexelsService';
import multiCmsPublisher from '../services/multiCmsPublisher';
import contentSafetyService from '../services/contentSafety';
import CostOptimizationService from '../services/costOptimization';
import observabilityService from '../services/observability';
import enterpriseSecurity from '../services/enterpriseSecurity';
import resilienceService from '../services/circuitBreaker';

// ─── Pipeline Result Type ────────────────────

export interface PipelineStageResult {
  stageName: string;
  success: boolean;
  durationMs: number;
  error?: string;
  data?: Record<string, unknown>;
}

export interface EnterprisePipelineResult {
  success: boolean;
  articleId?: string;
  title?: string;
  keyword?: string;
  wordCount?: number;
  seoScore?: number;
  qualityScore?: number;
  factCheckConfidence?: number;
  brandVoiceScore?: number;
  requiresHumanReview?: boolean;
  editorialStatus?: string;
  published?: boolean;
  publishUrl?: string;
  duration: string;
  stages: PipelineStageResult[];
  traceId?: string;
  error?: string;
}

// ══════════════════════════════════════════════
// Enterprise Orchestrator Class
// ══════════════════════════════════════════════

export class EnterprisePipelineOrchestrator {
  private repo: ArticleRepo;
  private clientRepo: ClientRepo;
  private keywordRepo: KeywordRepo;
  private log: LogRepo;
  private pool: Pool;
  private costOptimization: CostOptimizationService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.repo = createArticleRepo(pool);
    this.clientRepo = createClientRepo(pool);
    this.keywordRepo = createKeywordRepo(pool);
    this.log = createLogRepo(pool);
    this.costOptimization = CostOptimizationService.getInstance();

    // Initialize enterprise services
    seoIntelligence.initialize(pool);
    factCheckService.initialize(pool);
    brandVoiceService.initialize(pool);
    editorialWorkflowService.initialize(pool);
    contentIntelligence.initialize(pool);
    aiEvaluationService.initialize(pool);
    pexelsService.initialize(pool);
    multiCmsPublisher.initialize(pool);
    this.costOptimization.initialize(pool);
    observabilityService.initialize(pool);
    enterpriseSecurity.initialize(pool);
    resilienceService.initialize(pool);
  }

  // ══════════════════════════════════════════════
  // FULL ENTERPRISE PIPELINE
  // ══════════════════════════════════════════════

  async runFullPipeline(
    clientId: string,
    keyword: string,
    options: {
      publish?: boolean;
      blogId?: number | string;
      tone?: string;
      minWords?: number;
      maxWords?: number;
      bypassDedup?: boolean;
      usePexels?: boolean;
      brandVoiceOverride?: string;
      useCostOptimization?: boolean;
      traceId?: string;
    } = {}
  ): Promise<EnterprisePipelineResult> {
    const startTime = Date.now();
    const stages: PipelineStageResult[] = [];
    const traceId = options.traceId || uuidv4().replace(/-/g, '');
    const workflowLogId = await this.log.startWorkflow({
      clientId,
      workflowType: 'enterprise_pipeline',
      stage: 'started',
      status: 'running',
      metadata: { traceId, keyword }
    });

    // ── Observability: Start pipeline trace ──
    const pipelineSpan = observabilityService.startSpan({
      name: 'enterprise_pipeline',
      traceId,
      attributes: { clientId, keyword }
    });

    try {
      // ── Stage 0: Validate ──────────────────────
      const client = await this.clientRepo.findById(clientId);
      if (!client) throw new Error(`Client ${clientId} not found or inactive`);

      // ════════════════════════════════════════════
      // STAGE 1: Keyword Discovery & Enrichment
      // ════════════════════════════════════════════
      let kwResult = await this.runStage('keyword_discovery', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.keyword_discovery', traceId });
        try {
          const existing = await this.keywordRepo.findByKeyword(clientId, keyword);
          if (existing) {
            await this.keywordRepo.markUsed(existing.id);
            return { keywordId: existing.id, keyword, source: 'existing' };
          }

          let serpData;
          try {
            serpData = await serpapiService.getKeywordData(keyword);
          } catch { serpData = null; }

          const saved = await this.keywordRepo.create({
            client_id: clientId,
            keyword,
            search_volume: serpData?.search_volume || 0,
            competition: serpData?.competition || 0.5,
            cpc: serpData?.cpc || 0,
            trend_score: serpData?.trend_score || 50,
            relevance_score: serpData ? this.calcRelevance(keyword, serpData) : 60,
            source: serpData ? 'serpapi' : 'manual'
          });

          await this.keywordRepo.markUsed(saved.id);
          return { keywordId: saved.id, keyword, source: serpData ? 'serpapi' : 'estimated' };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 2: Search Intent Classification
      // ════════════════════════════════════════════
      let searchIntent = 'informational';
      let serpLandscape: string[] = [];
      await this.runStage('search_intent', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.search_intent', traceId });
        try {
          const intent = await seoIntelligence.classifySearchIntent(keyword);
          searchIntent = intent.intent;
          return { intent: intent.intent, confidence: intent.confidence, suggestedFormat: intent.suggestedContentFormat };
        } catch (err) {
          return { intent: 'informational', error: (err as Error).message };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 3: SERP & Entity Analysis
      // ════════════════════════════════════════════
      await this.runStage('serp_entity_analysis', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.serp_analysis', traceId });
        try {
          const serp = await seoIntelligence.analyzeSERP(keyword);
          serpLandscape = serp.entityLandscape || [];
          return {
            searchIntent: serp.searchIntent,
            features: serp.serpFeatures,
            entities: serp.entityLandscape.slice(0, 10)
          };
        } catch (err) {
          return { error: (err as Error).message };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 4: Semantic Dedup
      // ════════════════════════════════════════════
      if (!options.bypassDedup) {
        await this.runStage('semantic_dedup', stages, async () => {
          const span = observabilityService.startSpan({ name: 'pipeline.dedup', traceId });
          try {
            const isDuplicate = await vectorMemoryService.isDuplicate(clientId, keyword);
            if (isDuplicate) {
              const similar = await this.keywordRepo.findSimilar(clientId, keyword);
              if (similar.length >= 2) {
                return { duplicate: true, similarKeywords: similar.map(k => k.keyword), skipped: true };
              }
            }
            return { duplicate: false };
          } finally {
            observabilityService.endSpan(span);
          }
        });

        const lastStage = stages[stages.length - 1];
        if (lastStage.data?.skipped) {
          lastStage.success = false;
          lastStage.error = 'Semantic duplicate detected — keyword covered recently';
          await this.log.completeWorkflow(workflowLogId, { status: 'skipped', errorMessage: lastStage.error });
          observabilityService.endSpan(pipelineSpan, 'ok');
          return this.buildFailureResult(startTime, stages, lastStage.error);
        }
      }

      // ════════════════════════════════════════════
      // STAGE 5: Brand Voice Enhancement
      // ════════════════════════════════════════════
      let brandGuidance = '';
      let forbiddenPhrases: string[] = [];
      let preferredTerms: Record<string, string> = {};
      await this.runStage('brand_voice', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.brand_voice', traceId });
        try {
          const guidance = await brandVoiceService.getContentGuidance(clientId);
          forbiddenPhrases = guidance.forbiddenPhrases;
          preferredTerms = guidance.preferredTerminology;
          brandGuidance = JSON.stringify(guidance);
          return {
            hasProfile: true,
            phraseCount: forbiddenPhrases.length,
            termCount: Object.keys(preferredTerms).length
          };
        } catch (err) {
          return { hasProfile: false, error: (err as Error).message };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 6: Content Generation (Staged)
      // ════════════════════════════════════════════
      let articleTitle = '';
      let contentMd = '';
      let metaTitle = '';
      let metaDescription = '';
      let tags: string[] = [];
      let contentWordCount = 0;

      // ── 6a: Title Generation ──
      const titleResult = await this.runStage('title_generation', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.title_gen', traceId });
        try {
          const title = await openaiService.generateTitle(keyword, client.brand_voice || undefined);
          return { title };
        } finally {
          observabilityService.endSpan(span);
        }
      });
      articleTitle = (titleResult.data?.title as string) || '';

      // ── 6b: Outline Generation ──
      await this.runStage('outline_generation', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.outline', traceId });
        try {
          const outline = await openaiService.generateOutline(
            keyword, articleTitle,
            (client as any).blacklist_keywords || []
          );
          return { outline, headingCount: outline.length };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ── 6c: Full Article Generation (with Cost Optimization) ──
      const articleResult = await this.runStage('article_generation', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.article_gen', traceId });
        try {
          let generationModel = process.env.OPENAI_MODEL || 'gpt-4o';

          // Optionally use cost optimization to select model
          if (options.useCostOptimization) {
            const routerResult = await this.costOptimization.routeTask(clientId, {
              taskType: 'blog_generation',
              estimatedTokens: options.maxWords ? options.maxWords * 2 : 4000,
              requiresReasoning: false,
              requiresImageGeneration: false,
              requiredQuality: 'premium',
              estimatedComplexity: 3
            });
            generationModel = routerResult.model;
          }

          const article = await openaiService.generateBlogPost({
            keyword,
            tone: options.tone || client.brand_voice || 'educational',
            minWords: options.minWords || 1200,
            maxWords: options.maxWords || 2500,
            clientSettings: {
              ...(client.settings || {}),
              brandVoiceGuidance: brandGuidance,
              forbiddenPhrases,
              preferredTerminology: preferredTerms
            }
          });

          contentMd = article.content;
          metaTitle = article.metaTitle;
          metaDescription = article.metaDescription;
          tags = article.tags;
          contentWordCount = article.content.split(/\s+/).length;

          // Track cost
          const meta = (article as any).metadata;
          if (meta?.tokensIn) {
            const cost = costTracker.calculateOpenAICost(generationModel, meta.tokensIn, meta.tokensOut);
            await costTracker.recordCost({
              client_id: clientId,
              provider: 'openai',
              model: generationModel,
              tokens_in: meta.tokensIn || 0,
              tokens_out: meta.tokensOut || 0,
              cost_usd: cost
            });

            // Also record in cost optimization
            await this.costOptimization.recordTokenUsage(clientId, generationModel, meta.tokensIn || 0, meta.tokensOut || 0, cost);

            // Record observability metric
            observabilityService.recordAILatency({
              client_id: clientId,
              provider: 'openai',
              model: generationModel,
              operation: 'blog_generation',
              prompt_tokens: meta.tokensIn || 0,
              completion_tokens: meta.tokensOut || 0,
              total_tokens: (meta.tokensIn || 0) + (meta.tokensOut || 0),
              latency_ms: 0,
              cost_usd: cost,
              success: true,
              metadata: { articleTitle }
            });
          }

          return {
            wordCount: contentWordCount,
            model: generationModel
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 7: SEO Enhancement & Analysis
      // ════════════════════════════════════════════
      let seoScore = 0;
      await this.runStage('seo_enhancement', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.seo', traceId });
        try {
          const enhanced = await openaiService.enhanceSEO(contentMd, keyword);
          if (enhanced && enhanced !== contentMd) contentMd = enhanced;

          // Use new SEO intelligence for comprehensive analysis
          const [legacyAnalysis, semanticAnalysis] = await Promise.all([
            seoService.analyzeContent(contentMd, keyword),
            seoIntelligence.analyzeContentSEO(contentMd, keyword).catch(() => null)
          ]);

          seoScore = semanticAnalysis?.score || legacyAnalysis.score;

          return {
            score: seoScore,
            legacyScore: legacyAnalysis.score,
            semanticScore: semanticAnalysis?.score,
            suggestions: (semanticAnalysis?.suggestions || legacyAnalysis.suggestions).slice(0, 5)
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 8: Quality Gate with AI Evaluation
      // ════════════════════════════════════════════
      let qualityScore = 0;
      let qualityGatePassed = true;
      const qualityGateResult = await this.runStage('quality_gate', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.quality_gate', traceId });
        try {
          const qualityThreshold = parseInt(process.env.QUALITY_GATE_THRESHOLD || '65', 10);

          // Use AI evaluation for comprehensive scoring
          const evalResult = await aiEvaluationService.evaluateContent(contentMd, keyword);
          qualityScore = evalResult.overall;
          qualityGatePassed = qualityScore >= qualityThreshold;

          // If quality is below threshold, try improvement suggestions
          if (!qualityGatePassed && evalResult.feedback) {
            logger.info('Quality gate triggered', {
              keyword,
              qualityScore,
              threshold: qualityThreshold,
              feedback: evalResult.feedback.slice(0, 200)
            });

            // Attempt one regeneration with quality feedback incorporated
            const improvedArticle = await openaiService.generateBlogPost({
              keyword,
              tone: options.tone || client.brand_voice || 'educational',
              minWords: options.minWords || 1200,
              maxWords: options.maxWords || 2500,
              clientSettings: {
                ...(client.settings || {}),
                qualityFeedback: evalResult.feedback.slice(0, 500)
              }
            });

            contentMd = improvedArticle.content;
            metaTitle = improvedArticle.metaTitle;
            metaDescription = improvedArticle.metaDescription;
            tags = improvedArticle.tags;
            contentWordCount = improvedArticle.content.split(/\s+/).length;

            // Re-evaluate
            const improvedEval = await aiEvaluationService.evaluateContent(contentMd, keyword);
            qualityScore = improvedEval.overall;
            qualityGatePassed = qualityScore >= qualityThreshold;

            // Regenerate SEO
            const regenSeo = await seoIntelligence.analyzeContentSEO(contentMd, keyword).catch(() => null);
            if (regenSeo) seoScore = regenSeo.score;
          }

          return {
            initialScore: qualityScore,
            threshold: qualityThreshold,
            passed: qualityGatePassed,
            regenerated: false,
            dimensions: evalResult.dimensions,
            feedback: evalResult.feedback.slice(0, 300)
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 9: Fact Checking Pipeline
      // ════════════════════════════════════════════
      let factCheckConfidence = 1;
      let requiresHumanReview = false;
      let claimCount = 0;
      let citationCount = 0;

      await this.runStage('fact_checking', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.fact_check', traceId });
        try {
          // Run fact checking on generated content
          const result = await factCheckService.verifyArticle('new', clientId, contentMd);
          factCheckConfidence = result.overallConfidence;
          requiresHumanReview = result.requiresHumanReview;
          claimCount = result.factChecks.length;
          citationCount = result.citations.length;

          // If low confidence or high-risk claims detected, flag for human review
          if (requiresHumanReview) {
            logger.warn('Fact check flagged for human review', {
              claims: claimCount,
              overallConfidence: factCheckConfidence
            });
          }

          return {
            confidence: factCheckConfidence,
            requiresReview: requiresHumanReview,
            claimsChecked: claimCount,
            citationsGenerated: citationCount
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 10: Brand Voice Consistency Check
      // ════════════════════════════════════════════
      let brandVoiceScore = 100;
      let brandViolations: string[] = [];

      await this.runStage('brand_consistency', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.brand_check', traceId });
        try {
          const consistency = await brandVoiceService.checkConsistency(clientId, contentMd);
          brandVoiceScore = consistency.score;
          brandViolations = consistency.violations;

          return {
            score: brandVoiceScore,
            violations: brandViolations.slice(0, 5),
            violationCount: brandViolations.length
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 11: Content Intelligence (Cannibalization)
      // ════════════════════════════════════════════
      let cannibalizationOverlaps = 0;

      await this.runStage('cannibalization_check', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.cannibalization', traceId });
        try {
          const overlaps = await contentIntelligence.detectCannibalization(
            clientId, 'pending', articleTitle, contentMd
          );
          cannibalizationOverlaps = overlaps.length;

          if (overlaps.length > 0) {
            logger.info('Cannibalization detected', {
              overlaps: overlaps.length,
              topOverlap: overlaps[0]?.recommendation
            });
          }

          return {
            overlapsFound: cannibalizationOverlaps,
            recommendations: overlaps.slice(0, 3).map(o => o.recommendation)
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 12: Content Safety Check
      // ════════════════════════════════════════════
      await this.runStage('content_safety', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.safety', traceId });
        try {
          const safetyResult = await contentSafetyService.checkContent(contentMd);
          return safetyResult as unknown as Record<string, unknown>;
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 13: Markdown → HTML Conversion
      // ════════════════════════════════════════════
      let contentHtml: string;
      await this.runStage('html_conversion', stages, async () => {
        contentHtml = convert(contentMd);
        return { htmlLength: contentHtml.length };
      });

      // ════════════════════════════════════════════
      // STAGE 14: Internal Linking
      // ════════════════════════════════════════════
      await this.runStage('internal_linking', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.internal_links', traceId });
        try {
          const [legacyOpportunities, intelligenceLinks] = await Promise.all([
            internalLinksService.findLinkOpportunities(contentMd, articleTitle, clientId),
            contentIntelligence.findLinkingOpportunities(clientId, contentMd).catch(() => [])
          ]);

          const allOpportunities = [...legacyOpportunities];
          if (allOpportunities.length > 0) {
            contentMd = internalLinksService.injectLinks(contentMd, allOpportunities);
            contentHtml = convert(contentMd);
          }

          return {
            legacyLinks: legacyOpportunities.length,
            intelligenceLinks: intelligenceLinks.length,
            totalInjected: allOpportunities.length
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 15: Pexels Image Selection
      // ════════════════════════════════════════════
      let pexelsFeaturedImage = '';

      await this.runStage('pexels_images', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.pexels', traceId });
        try {
          if (options.usePexels !== false) {
            const images = await pexelsService.findImagesForArticle(
              clientId, articleTitle, keyword, []
            );
            pexelsFeaturedImage = images.featuredImage.url;

            // Store featured image
            if (images.featuredImage.pexelsId !== 0) {
              await this.pool.query(
                `INSERT INTO article_images (article_id, client_id, image_url, alt_text, metadata, source, position)
                 VALUES ($1, $2, $3, $4, $5, 'pexels', 0)
                 ON CONFLICT DO NOTHING`,
                ['pending', clientId, images.featuredImage.url, images.featuredImage.altText,
                 JSON.stringify({
                   photographer: images.featuredImage.photographer,
                   photographerUrl: images.featuredImage.photographerUrl,
                   pexelsId: images.featuredImage.pexelsId
                 })]
              );
            }

            return {
              featuredImage: images.featuredImage.url,
              sectionImages: images.sectionImages.length,
              altText: images.featuredImage.altText
            };
          }
          return { featuredImage: null, sectionImages: 0 };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 16: FAQ & Schema Generation
      // ════════════════════════════════════════════
      await this.runStage('faq_schema', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.faq', traceId });
        try {
          const faqSection = await openaiService.generateFAQ(keyword, 3);
          if (faqSection) contentMd += '\n\n---\n\n' + faqSection;
          return { faqIncluded: !!faqSection };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 17: CTA Insertion
      // ════════════════════════════════════════════
      await this.runStage('cta_insertion', stages, async () => {
        const ctaText = (client as any).cta_template || process.env.CTA_DEFAULT_TEXT || 'Contact us today for professional service';
        const ctaUrl = process.env.CTA_DEFAULT_URL || '/contact';
        contentMd = this.insertCTA(contentMd, ctaText, ctaUrl);
        return { ctaText, ctaUrl };
      });

      // ════════════════════════════════════════════
      // STAGE 18: Store Article
      // ════════════════════════════════════════════
      let savedArticle: any;
      const slug = seoService.generateSlug(articleTitle);

      await this.runStage('article_storage', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.store', traceId });
        try {
          savedArticle = await this.repo.create({
            client_id: clientId,
            keyword_id: (kwResult.data as any)?.keywordId,
            title: articleTitle,
            slug,
            content_md: contentMd,
            content_html: contentHtml,
            meta_title: metaTitle,
            meta_description: metaDescription,
            tags,
            word_count: contentWordCount,
            status: 'generated',
            editorial_status: requiresHumanReview ? 'generated' : 'generated',
            pipeline_stage: 'enterprise_complete',
            seo_score: seoScore,
            ai_evaluation_score: qualityScore
          });

          // Update the image records with the real article ID
          await this.pool.query(
            'UPDATE article_images SET article_id = $1 WHERE article_id = $2 AND client_id = $3',
            [savedArticle.id, 'pending', clientId]
          );

          // Save JSON backup to /outputs
          try {
            const fs = require('fs');
            const path = require('path');
            const outputsDir = path.resolve(process.cwd(), 'outputs');
            if (!fs.existsSync(outputsDir)) {
              fs.mkdirSync(outputsDir, { recursive: true });
            }
            const backup = {
              id: savedArticle.id,
              client_id: clientId,
              keyword,
              title: articleTitle,
              slug,
              content_md: contentMd,
              content_html: contentHtml,
              meta_title: metaTitle,
              meta_description: metaDescription,
              tags,
              word_count: contentWordCount,
              seo_score: seoScore,
              quality_score: qualityScore,
              fact_check_confidence: factCheckConfidence,
              brand_voice_score: brandVoiceScore,
              requires_human_review: requiresHumanReview,
              pipeline_stage: 'enterprise_complete',
              status: 'generated',
              trace_id: traceId,
              created_at: new Date().toISOString(),
              api_url: `/api/articles/${savedArticle.id}`
            };
            fs.writeFileSync(
              path.join(outputsDir, `${savedArticle.id}.json`),
              JSON.stringify(backup, null, 2),
              'utf-8'
            );
          } catch { /* non-critical */ }

          return { articleId: savedArticle.id };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 19: Vector Embedding (Memory)
      // ════════════════════════════════════════════
      await this.runStage('vector_embedding', stages, async () => {
        await vectorMemoryService.storeArticleChunks(clientId, savedArticle.id, contentMd);
        return { stored: true };
      });

      // ════════════════════════════════════════════
      // STAGE 20: Enterprise Quality Evaluation
      // ════════════════════════════════════════════
      await this.runStage('quality_evaluation', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.quality_eval', traceId });
        try {
          const qaReport = await aiEvaluationService.generateQualityReport(contentMd, keyword, brandGuidance);
          return {
            overall: qaReport.qualityScore.overall,
            rankingPotential: qaReport.estimatedRankingPotential,
            actionableSteps: qaReport.actionableSteps.slice(0, 3)
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 21: Topic Saturation Analysis
      // ════════════════════════════════════════════
      await this.runStage('topic_saturation', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.topic_saturation', traceId });
        try {
          const saturation = await contentIntelligence.analyzeTopicSaturation(clientId, keyword);
          return {
            saturationScore: saturation.saturation_score,
            articleCount: saturation.article_count,
            recommendation: saturation.recommendation
          };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 22: Editorial Workflow (Human-in-the-Loop)
      // ════════════════════════════════════════════
      let editorialStatus = 'generated';

      await this.runStage('editorial_workflow', stages, async () => {
        const span = observabilityService.startSpan({ name: 'pipeline.editorial', traceId });
        try {
          // If requires human review (from fact checking), submit for editor review
          if (requiresHumanReview) {
            await editorialWorkflowService.createReviewAssignment({
              article_id: savedArticle.id,
              client_id: clientId,
              review_type: 'editor_review',
              priority: 2,
              due_at: new Date(Date.now() + 86400000)
            });
            editorialStatus = 'in_editor_review';
          } else {
            // Standard flow: submit for SEO review first
            await editorialWorkflowService.createReviewAssignment({
              article_id: savedArticle.id,
              client_id: clientId,
              review_type: 'seo_review',
              priority: 1,
              due_at: new Date(Date.now() + 172800000)
            });
            editorialStatus = 'in_seo_review';
          }

          await editorialWorkflowService.advanceStatus(savedArticle.id, editorialStatus as any);

          return { requiresHumanReview, editorialStatus };
        } finally {
          observabilityService.endSpan(span);
        }
      });

      // ════════════════════════════════════════════
      // STAGE 23: Publish (if auto-approve and approved)
      // ════════════════════════════════════════════
      let published = false;
      let publishUrl: string | undefined;

      if (options.publish && client.approval_mode === 'auto' && !requiresHumanReview) {
        await this.runStage('publishing', stages, async () => {
          const span = observabilityService.startSpan({ name: 'pipeline.publish', traceId });
          try {
            // Use multi-CMS publisher
            const publishConfig = {
              shop: client.shopify_shop,
              accessToken: client.shopify_token,
              apiVersion: client.shopify_api_version
            };

            const articleData: Partial<Article> = {
              id: savedArticle.id,
              client_id: clientId,
              title: articleTitle,
              content_md: contentMd,
              content_html: contentHtml,
              meta_title: metaTitle,
              meta_description: metaDescription,
              tags,
              word_count: contentWordCount,
              status: 'published'
            };

            const result = await multiCmsPublisher.publish(articleData as Article, 'shopify');
            published = true;
            publishUrl = result.url;

            // Update article status
            await this.repo.updateStatus(savedArticle.id, 'published');
            await editorialWorkflowService.advanceStatus(savedArticle.id, 'published');

            return { provider: 'shopify', url: result.url, id: result.id };
          } finally {
            observabilityService.endSpan(span);
          }
        });
      }

      // ════════════════════════════════════════════
      // STAGE 24: Webhook Notification
      // ════════════════════════════════════════════
      await this.runStage('webhook_notification', stages, async () => {
        await webhookService.trigger('article.completed', clientId, {
          articleId: savedArticle.id,
          title: articleTitle,
          keyword,
          status: published ? 'published' : 'generated',
          editorialStatus,
          requiresHumanReview,
          seoScore,
          qualityScore,
          factCheckConfidence,
          brandVoiceScore,
          publishUrl,
          traceId
        });
        return { notified: true };
      });

      // ════════════════════════════════════════════
      // COMPLETE
      // ════════════════════════════════════════════
      const totalDuration = Date.now() - startTime;

      await this.log.completeWorkflow(workflowLogId, {
        status: 'completed',
        durationMs: totalDuration,
        metrics: {
          stagesCompleted: stages.filter(s => s.success).length,
          totalStages: stages.length,
          wordCount: contentWordCount,
          seoScore,
          qualityScore,
          factCheckConfidence,
          brandVoiceScore,
          requiresHumanReview,
          published
        }
      });

      await this.log.logActivity({
        clientId,
        action: 'enterprise_pipeline_completed',
        entityType: 'article',
        entityId: savedArticle.id,
        level: 'info',
        message: `Enterprise pipeline completed: "${articleTitle}" (${keyword})`,
        metadata: {
          duration: totalDuration,
          published,
          stages: stages.length,
          traceId,
          seoScore,
          qualityScore,
          requiresHumanReview
        }
      });

      observabilityService.endSpan(pipelineSpan, 'ok');

      return {
        success: true,
        articleId: savedArticle.id,
        title: articleTitle,
        keyword,
        wordCount: contentWordCount,
        seoScore,
        qualityScore,
        factCheckConfidence,
        brandVoiceScore,
        requiresHumanReview,
        editorialStatus,
        published,
        publishUrl,
        duration: `${(totalDuration / 1000).toFixed(1)}s`,
        traceId,
        stages
      };

    } catch (err) {
      const totalDuration = Date.now() - startTime;
      const errorMsg = (err as Error).message;

      await this.log.completeWorkflow(workflowLogId, {
        status: 'failed',
        durationMs: totalDuration,
        errorMessage: errorMsg
      });

      await this.log.logActivity({
        clientId,
        action: 'enterprise_pipeline_failed',
        level: 'error',
        message: `Enterprise pipeline failed: ${errorMsg}`,
        metadata: { traceId, keyword }
      });

      observabilityService.endSpan(pipelineSpan, 'error', errorMsg);

      return this.buildFailureResult(startTime, stages, errorMsg);
    }
  }

  // ══════════════════════════════════════════════
  // STAGE RUNNER with Observability
  // ══════════════════════════════════════════════

  private async runStage(
    stageName: string,
    stages: PipelineStageResult[],
    handler: () => Promise<Record<string, unknown>>
  ): Promise<PipelineStageResult> {
    const start = Date.now();
    try {
      const data = await handler();
      const result: PipelineStageResult = {
        stageName,
        success: true,
        durationMs: Date.now() - start,
        data
      };
      stages.push(result);
      logger.debug(`Pipeline stage completed: ${stageName}`, { duration: result.durationMs });
      return result;
    } catch (err) {
      const result: PipelineStageResult = {
        stageName,
        success: false,
        durationMs: Date.now() - start,
        error: (err as Error).message
      };
      stages.push(result);
      logger.warn(`Pipeline stage failed: ${stageName}`, { error: result.error });
      return result;
    }
  }

  // ══════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════

  private insertCTA(content: string, ctaText: string, ctaUrl: string): string {
    const ctaSection = `\n\n---\n\n### Ready to Get Professional Help?\n\n${ctaText ? `[${ctaText}](${ctaUrl})` : ''}`;
    const faqIndex = content.lastIndexOf('## Frequently Asked Questions');
    if (faqIndex > 0) {
      return content.slice(0, faqIndex) + ctaSection + '\n\n' + content.slice(faqIndex);
    }
    return content + ctaSection;
  }

  private async maybeQueueNext(clientId: string): Promise<void> {
    try {
      const client = await this.clientRepo.findById(clientId);
      if (!client || client.publish_frequency === 'manual') return;

      const nextKeywords = await this.keywordRepo.findBest(clientId, { limit: 1 });
      if (nextKeywords.length > 0) {
        await addJob(QueueNames.CONTENT_GENERATION, 'scheduled-generation', {
          clientId,
          keyword: nextKeywords[0].keyword,
          publish: client.publish_frequency !== 'manual',
          tone: client.brand_voice || undefined
        }, { delay: 3600000 });
        logger.info('Next keyword queued for generation', { clientId, keyword: nextKeywords[0].keyword });
      }
    } catch (err) {
      logger.warn('Failed to queue next article', { clientId, error: (err as Error).message });
    }
  }

  private calcRelevance(keyword: string, data: any): number {
    let score = 50;
    if (data.search_volume > 500) score += 20;
    else if (data.search_volume > 200) score += 10;
    if (data.competition < 0.3) score += 15;
    else if (data.competition < 0.6) score += 5;
    const words = keyword.split(/\s+/).length;
    if (words >= 3) score += 10;
    if (words >= 4) score += 5;
    if (data.trend_score > 70) score += 10;
    return Math.min(100, score);
  }

  private buildFailureResult(startTime: number, stages: PipelineStageResult[], error: string): EnterprisePipelineResult {
    return {
      success: false,
      duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      stages,
      error
    };
  }
}

