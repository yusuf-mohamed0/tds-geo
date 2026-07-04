// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Queue Definitions
// Centralized job types, queue names, and
// payload type definitions
// ══════════════════════════════════════════════

import { QueueNames } from '../utils/queue';

export { QueueNames };

// ─── Job Type Constants ──────────────────────

export const JobTypes = {
  CONTENT_GENERATION: 'content-generation',
  KEYWORD_RESEARCH: 'keyword-research',
  SHOPIFY_PUBLISH: 'shopify-publish',
  IMAGE_GENERATION: 'image-generation',
  SEO_ANALYSIS: 'seo-analysis',
  INTERNAL_LINKING: 'internal-linking',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  FULL_PIPELINE: 'full-pipeline',
  SCHEDULED_GENERATION: 'scheduled-generation',
  APPROVED_PUBLISH: 'approved-publish',
  CONTENT_REVIEW: 'content-review',
  EMBEDDING_GENERATION: 'embedding-generation',
  // ── Enterprise Job Types ──
  FACT_CHECK: 'fact-check',
  FACT_CHECK_SOURCES: 'fact-check-sources',
  CLAIM_VERIFICATION: 'claim-verification',
  BRAND_VOICE_ANALYSIS: 'brand-voice-analysis',
  BRAND_VOICE_GENERATE: 'brand-voice-generate',
  SEO_INTELLIGENCE: 'seo-intelligence',
  SERP_ANALYSIS: 'serp-analysis',
  TOPICAL_AUTHORITY: 'topical-authority',
  ENTITY_EXTRACTION: 'entity-extraction',
  CONTENT_GAP_ANALYSIS: 'content-gap-analysis',
  MULTI_CMS_PUBLISH: 'multi-cms-publish',
  CMS_CONNECTION_TEST: 'cms-connection-test',
  PEXELS_IMAGE_FETCH: 'pexels-image-fetch',
  PEXELS_SEMANTIC_MATCH: 'pexels-semantic-match',
  COST_OPTIMIZATION: 'cost-optimization',
  COST_REPORT: 'cost-report',
  EDITORIAL_APPROVAL: 'editorial-approval',
  EDITORIAL_REVIEW: 'editorial-review',
  CONTENT_INTELLIGENCE: 'content-intelligence',
  CANNIBALIZATION_CHECK: 'cannibalization-check',
  KNOWLEDGE_GRAPH_BUILD: 'knowledge-graph-build',
  AI_EVALUATION: 'ai-evaluation',
  BENCHMARK_RUN: 'benchmark-run',
  OBSERVABILITY_FLUSH: 'observability-flush',
  OBSERVABILITY_METRICS: 'observability-metrics',
  // ── Client Scraper Job Types ──
  CLIENT_SCAN: 'client-scan',
  BATCH_CLIENT_SCAN: 'batch-client-scan',
  // ── Odoo ERP Integration Job Types ──
  ODOO_SYNC: 'odoo-sync',
  ODOO_BATCH_SYNC: 'odoo-batch-sync',
  ODOO_WEBHOOK_EVENT: 'odoo-webhook-event',
  ODOO_CONNECTION_TEST: 'odoo-connection-test',
  ODOO_FULL_SYNC: 'odoo-full-sync'
} as const;

// ─── Queue Name to Job Types Mapping ─────────

export const QueueJobTypeMap: Record<QueueNames, string[]> = {
  [QueueNames.CONTENT_GENERATION]: [JobTypes.CONTENT_GENERATION, JobTypes.SCHEDULED_GENERATION],
  [QueueNames.KEYWORD_RESEARCH]: [JobTypes.KEYWORD_RESEARCH],
  [QueueNames.SHOPIFY_PUBLISH]: [JobTypes.SHOPIFY_PUBLISH, JobTypes.APPROVED_PUBLISH],
  [QueueNames.IMAGE_GENERATION]: [JobTypes.IMAGE_GENERATION],
  [QueueNames.SEO_ANALYSIS]: [JobTypes.SEO_ANALYSIS, JobTypes.CONTENT_REVIEW],
  [QueueNames.INTERNAL_LINKING]: [JobTypes.INTERNAL_LINKING],
  [QueueNames.WEBHOOK_DELIVERY]: [JobTypes.WEBHOOK_DELIVERY],
  [QueueNames.DEFAULT]: [JobTypes.FULL_PIPELINE, JobTypes.EMBEDDING_GENERATION],
  // ── Enterprise Queue Mappings ──
  [QueueNames.FACT_CHECK]: [JobTypes.FACT_CHECK, JobTypes.FACT_CHECK_SOURCES, JobTypes.CLAIM_VERIFICATION],
  [QueueNames.BRAND_VOICE]: [JobTypes.BRAND_VOICE_ANALYSIS, JobTypes.BRAND_VOICE_GENERATE],
  [QueueNames.SEO_INTELLIGENCE]: [JobTypes.SEO_INTELLIGENCE, JobTypes.SERP_ANALYSIS, JobTypes.TOPICAL_AUTHORITY, JobTypes.ENTITY_EXTRACTION, JobTypes.CONTENT_GAP_ANALYSIS],
  [QueueNames.MULTI_CMS_PUBLISH]: [JobTypes.MULTI_CMS_PUBLISH, JobTypes.CMS_CONNECTION_TEST],
  [QueueNames.PEXELS_IMAGE]: [JobTypes.PEXELS_IMAGE_FETCH, JobTypes.PEXELS_SEMANTIC_MATCH],
  [QueueNames.COST_OPTIMIZATION]: [JobTypes.COST_OPTIMIZATION, JobTypes.COST_REPORT],
  [QueueNames.EDITORIAL_WORKFLOW]: [JobTypes.EDITORIAL_APPROVAL, JobTypes.EDITORIAL_REVIEW],
  [QueueNames.CONTENT_INTELLIGENCE]: [JobTypes.CONTENT_INTELLIGENCE, JobTypes.CANNIBALIZATION_CHECK, JobTypes.KNOWLEDGE_GRAPH_BUILD],
  [QueueNames.AI_EVALUATION]: [JobTypes.AI_EVALUATION, JobTypes.BENCHMARK_RUN],
  [QueueNames.OBSERVABILITY]: [JobTypes.OBSERVABILITY_FLUSH, JobTypes.OBSERVABILITY_METRICS],
  // ── Client Scraper Queue Mappings ──
  [QueueNames.CLIENT_SCAN]: [JobTypes.CLIENT_SCAN],
  [QueueNames.BATCH_CLIENT_SCAN]: [JobTypes.BATCH_CLIENT_SCAN],
  // ── Odoo Queue Mappings ──
  [QueueNames.ODOO_SYNC]: [JobTypes.ODOO_SYNC, JobTypes.ODOO_CONNECTION_TEST],
  [QueueNames.ODOO_BATCH_SYNC]: [JobTypes.ODOO_BATCH_SYNC, JobTypes.ODOO_FULL_SYNC],
  [QueueNames.ODOO_WEBHOOK]: [JobTypes.ODOO_WEBHOOK_EVENT],
};

// ─── Job Priority Constants ──────────────────

export const JobPriority = {
  HIGH: 1,
  NORMAL: 5,
  LOW: 10,
  BATCH: 20,
} as const;

// ─── Job Payload Types ───────────────────────

export interface ContentGenerationPayload {
  clientId: string;
  keyword: string;
  tone?: string;
  minWords?: number;
  maxWords?: number;
  publish?: boolean;
  blogId?: number | string;
  bypassDedup?: boolean;
  generateImage?: boolean;
}

export interface KeywordResearchPayload {
  clientId: string;
  seedKeywords: string[];
  industry?: string;
}

export interface ShopifyPublishPayload {
  articleId: string;
  clientId: string;
  blogId?: number | string;
  scheduleAt?: string;
}

export interface ImageGenerationPayload {
  articleId: string;
  clientId: string;
  articleTitle: string;
  keyword: string;
}

export interface SeoAnalysisPayload {
  articleId: string;
  content: string;
  keyword: string;
}

export interface InternalLinkingPayload {
  articleId: string;
  clientId: string;
  content: string;
  title: string;
}

export interface WebhookDeliveryPayload {
  event: string;
  clientId: string;
  payload: Record<string, unknown>;
}

export interface FullPipelinePayload {
  clientId: string;
  keyword: string;
  publish?: boolean;
  blogId?: number | string;
  tone?: string;
  minWords?: number;
  maxWords?: number;
}

// ─── Queue Configuration ─────────────────────

export interface QueueConfig {
  name: QueueNames;
  concurrency: number;
  maxAttempts: number;
  description: string;
}

export const QueueConfigs: Record<QueueNames, QueueConfig> = {
  [QueueNames.CONTENT_GENERATION]: {
    name: QueueNames.CONTENT_GENERATION,
    concurrency: 2,
    maxAttempts: 2,
    description: 'AI content generation jobs'
  },
  [QueueNames.KEYWORD_RESEARCH]: {
    name: QueueNames.KEYWORD_RESEARCH,
    concurrency: 3,
    maxAttempts: 2,
    description: 'Keyword research via SerpAPI'
  },
  [QueueNames.SHOPIFY_PUBLISH]: {
    name: QueueNames.SHOPIFY_PUBLISH,
    concurrency: 1,
    maxAttempts: 5,
    description: 'Shopify article publishing'
  },
  [QueueNames.IMAGE_GENERATION]: {
    name: QueueNames.IMAGE_GENERATION,
    concurrency: 1,
    maxAttempts: 2,
    description: 'AI image generation via DALL-E'
  },
  [QueueNames.SEO_ANALYSIS]: {
    name: QueueNames.SEO_ANALYSIS,
    concurrency: 4,
    maxAttempts: 2,
    description: 'SEO content analysis'
  },
  [QueueNames.INTERNAL_LINKING]: {
    name: QueueNames.INTERNAL_LINKING,
    concurrency: 3,
    maxAttempts: 2,
    description: 'Internal link optimization'
  },
  [QueueNames.WEBHOOK_DELIVERY]: {
    name: QueueNames.WEBHOOK_DELIVERY,
    concurrency: 5,
    maxAttempts: 3,
    description: 'Webhook event delivery'
  },
  [QueueNames.DEFAULT]: {
    name: QueueNames.DEFAULT,
    concurrency: 2,
    maxAttempts: 1,
    description: 'Default/dead-letter queue'
  },
  // ── Enterprise Queue Configs ──
  [QueueNames.FACT_CHECK]: {
    name: QueueNames.FACT_CHECK,
    concurrency: 2,
    maxAttempts: 3,
    description: 'Fact checking and source grounding'
  },
  [QueueNames.BRAND_VOICE]: {
    name: QueueNames.BRAND_VOICE,
    concurrency: 2,
    maxAttempts: 2,
    description: 'Brand voice analysis and generation'
  },
  [QueueNames.SEO_INTELLIGENCE]: {
    name: QueueNames.SEO_INTELLIGENCE,
    concurrency: 3,
    maxAttempts: 2,
    description: 'Advanced SEO intelligence engine'
  },
  [QueueNames.MULTI_CMS_PUBLISH]: {
    name: QueueNames.MULTI_CMS_PUBLISH,
    concurrency: 1,
    maxAttempts: 5,
    description: 'Multi-CMS publishing adapter'
  },
  [QueueNames.PEXELS_IMAGE]: {
    name: QueueNames.PEXELS_IMAGE,
    concurrency: 2,
    maxAttempts: 2,
    description: 'Pexels image fetching'
  },
  [QueueNames.COST_OPTIMIZATION]: {
    name: QueueNames.COST_OPTIMIZATION,
    concurrency: 1,
    maxAttempts: 1,
    description: 'AI cost optimization and reporting'
  },
  [QueueNames.EDITORIAL_WORKFLOW]: {
    name: QueueNames.EDITORIAL_WORKFLOW,
    concurrency: 3,
    maxAttempts: 3,
    description: 'Editorial review and approval workflow'
  },
  [QueueNames.CONTENT_INTELLIGENCE]: {
    name: QueueNames.CONTENT_INTELLIGENCE,
    concurrency: 2,
    maxAttempts: 2,
    description: 'Content intelligence and knowledge graph'
  },
  [QueueNames.AI_EVALUATION]: {
    name: QueueNames.AI_EVALUATION,
    concurrency: 1,
    maxAttempts: 1,
    description: 'AI quality evaluation and benchmarking'
  },
  [QueueNames.OBSERVABILITY]: {
    name: QueueNames.OBSERVABILITY,
    concurrency: 2,
    maxAttempts: 2,
    description: 'Observability, metrics and tracing'
  },
  // ── Client Scraper Queue Configs ──
  [QueueNames.CLIENT_SCAN]: {
    name: QueueNames.CLIENT_SCAN,
    concurrency: 2,
    maxAttempts: 2,
    description: 'Single client website intelligence scan'
  },
  [QueueNames.BATCH_CLIENT_SCAN]: {
    name: QueueNames.BATCH_CLIENT_SCAN,
    concurrency: 1,
    maxAttempts: 1,
    description: 'Batch scan all clients for website intelligence'
  },
  // ── Odoo Queue Configs ──
  [QueueNames.ODOO_SYNC]: {
    name: QueueNames.ODOO_SYNC,
    concurrency: 3,
    maxAttempts: 3,
    description: 'Single Odoo record sync operation'
  },
  [QueueNames.ODOO_BATCH_SYNC]: {
    name: QueueNames.ODOO_BATCH_SYNC,
    concurrency: 1,
    maxAttempts: 2,
    description: 'Batch or full Odoo model sync'
  },
  [QueueNames.ODOO_WEBHOOK]: {
    name: QueueNames.ODOO_WEBHOOK,
    concurrency: 3,
    maxAttempts: 3,
    description: 'Odoo webhook event processing'
  },
};
