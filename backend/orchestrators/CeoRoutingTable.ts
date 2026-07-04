// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════════════════════════
// CEO Routing Table
//
// The single source of truth for ALL routing decisions:
//   • Queue → Department mapping  (20 queues → 8 departments)
//   • Job Type → Department + Queue mapping  (40+ job types)
//   • Fallback chains, priority tiers, SLA targets
//   • Reverse lookups for dashboards and health checks
//
// This replaces the inline keyword-heuristic routing in CeoOrchestrator
// with a deterministic, table-driven system.
// ══════════════════════════════════════════════════════════════════

import { QueueNames } from '../utils/queue';
import { JobTypes } from '../queues/definitions';
import { DepartmentName, TaskPriority } from './managers/types';

// ══════════════════════════════════════════════════════════════════
// ROUTING POLICY — Per Queue
// ══════════════════════════════════════════════════════════════════

export interface QueueRoutingPolicy {
  queueName: QueueNames;

  /** Owning department — primary responsibility */
  primaryDepartment: DepartmentName;

  /** Human-friendly description of this queue's purpose */
  description: string;

  /** Base priority tier for jobs in this queue */
  priorityTier: TaskPriority;

  /** Max concurrent worker instances */
  concurrencyLimit: number;

  /** Max retry attempts before dead-letter */
  maxRetries: number;

  /** Fallback department when primary is overloaded (null = no fallback) */
  fallbackDepartment: DepartmentName | null;

  /** Whether the CEO can reroute jobs from this queue to the fallback */
  canDelegate: boolean;

  /** Expected max processing time in ms (for SLA monitoring) */
  slaMs: number;

  /** Whether jobs from this queue can be scheduled/deferred */
  supportsScheduling: boolean;

  /** Whether this queue is a dead-letter / system queue */
  isSystemQueue: boolean;
}

// ══════════════════════════════════════════════════════════════════
// JOB TYPE ROUTING RULE
// ══════════════════════════════════════════════════════════════════

export interface JobTypeRoutingRule {
  /** The job type string (matches JobTypes constant) */
  jobType: string;

  /** The BullMQ queue this job type is dispatched to */
  primaryQueue: QueueNames;

  /** Primary owning department */
  primaryDepartment: DepartmentName;

  /** Ordered fallback departments (first = preferred fallback) */
  fallbackDepartments: DepartmentName[];

  /** Human description */
  description: string;

  /** Whether this job type requires client authentication context */
  requiresClientAuth: boolean;

  /** Category for grouping in dashboards */
  category: 'content' | 'seo' | 'publishing' | 'analytics' | 'operations' | 'infrastructure' | 'cost' | 'quality';
}

// ══════════════════════════════════════════════════════════════════
// DEPARTMENT TO QUEUES — Corrected authoritative mapping
// ══════════════════════════════════════════════════════════════════

/**
 * Canonical department → queue mapping.
 *
 * CORRECTIONS from Phase 1:
 *   - INTERNAL_LINKING moved from QA → SEO
 *   - OBSERVABILITY moved from DataAnalytics → Infrastructure
 *     (observability is infrastructure monitoring, not analytics)
 *   - KEYWORD_RESEARCH stays with Data Analytics
 *     (SEO requests keyword data from Analytics via CEO routing)
 */
const DEPARTMENT_QUEUES_MAP: Record<DepartmentName, QueueNames[]> = {
  ai_content: [
    QueueNames.CONTENT_GENERATION,
    QueueNames.IMAGE_GENERATION,
    QueueNames.BRAND_VOICE,
    QueueNames.PEXELS_IMAGE,
  ],
  seo: [
    QueueNames.SEO_ANALYSIS,
    QueueNames.SEO_INTELLIGENCE,
    QueueNames.CONTENT_INTELLIGENCE,
    QueueNames.INTERNAL_LINKING,
  ],
  shopify_publishing: [
    QueueNames.SHOPIFY_PUBLISH,
    QueueNames.MULTI_CMS_PUBLISH,
    QueueNames.WEBHOOK_DELIVERY,
  ],
  data_analytics: [
    QueueNames.KEYWORD_RESEARCH,
  ],
  client_operations: [
    QueueNames.CLIENT_SCAN,
    QueueNames.BATCH_CLIENT_SCAN,
    QueueNames.EDITORIAL_WORKFLOW,
  ],
  infrastructure: [
    QueueNames.DEFAULT,
    QueueNames.OBSERVABILITY,
  ],
  cost_optimization: [
    QueueNames.COST_OPTIMIZATION,
  ],
  quality_assurance: [
    QueueNames.FACT_CHECK,
    QueueNames.AI_EVALUATION,
  ],
  odoo: [
    QueueNames.ODOO_SYNC,
    QueueNames.ODOO_BATCH_SYNC,
    QueueNames.ODOO_WEBHOOK,
  ],
};

// ══════════════════════════════════════════════════════════════════
// FULL QUEUE ROUTING POLICIES
// ══════════════════════════════════════════════════════════════════

const QUEUE_ROUTING_POLICIES: QueueRoutingPolicy[] = [
  // ─── AI Content ──────────────────────────────
  {
    queueName: QueueNames.CONTENT_GENERATION,
    primaryDepartment: 'ai_content',
    description: 'AI article content generation via LLM',
    priorityTier: 'high',
    concurrencyLimit: 2,
    maxRetries: 2,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 120_000,
    supportsScheduling: true,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.IMAGE_GENERATION,
    primaryDepartment: 'ai_content',
    description: 'AI image generation via DALL-E / Stable Diffusion',
    priorityTier: 'normal',
    concurrencyLimit: 1,
    maxRetries: 2,
    fallbackDepartment: 'quality_assurance',
    canDelegate: false,
    slaMs: 60_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.BRAND_VOICE,
    primaryDepartment: 'ai_content',
    description: 'Brand voice analysis and tone profile generation',
    priorityTier: 'high',
    concurrencyLimit: 2,
    maxRetries: 2,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.PEXELS_IMAGE,
    primaryDepartment: 'ai_content',
    description: 'Stock photography fetching from Pexels API',
    priorityTier: 'normal',
    concurrencyLimit: 2,
    maxRetries: 2,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },

  // ─── SEO ─────────────────────────────────────
  {
    queueName: QueueNames.SEO_ANALYSIS,
    primaryDepartment: 'seo',
    description: 'SEO content analysis and optimization scoring',
    priorityTier: 'high',
    concurrencyLimit: 4,
    maxRetries: 2,
    fallbackDepartment: 'quality_assurance',
    canDelegate: true,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.SEO_INTELLIGENCE,
    primaryDepartment: 'seo',
    description: 'Advanced SEO: SERP analysis, entity extraction, content gaps',
    priorityTier: 'high',
    concurrencyLimit: 3,
    maxRetries: 2,
    fallbackDepartment: 'data_analytics',
    canDelegate: true,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.CONTENT_INTELLIGENCE,
    primaryDepartment: 'seo',
    description: 'Content cannibalization detection and knowledge graph',
    priorityTier: 'normal',
    concurrencyLimit: 2,
    maxRetries: 2,
    fallbackDepartment: 'quality_assurance',
    canDelegate: true,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.INTERNAL_LINKING,
    primaryDepartment: 'seo',
    description: 'Internal link optimization and content relevance mapping',
    priorityTier: 'normal',
    concurrencyLimit: 3,
    maxRetries: 2,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },

  // ─── Shopify Publishing ──────────────────────
  {
    queueName: QueueNames.SHOPIFY_PUBLISH,
    primaryDepartment: 'shopify_publishing',
    description: 'Shopify article publishing with retry and verification',
    priorityTier: 'high',
    concurrencyLimit: 1,
    maxRetries: 5,
    fallbackDepartment: 'client_operations',
    canDelegate: true,
    slaMs: 60_000,
    supportsScheduling: true,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.MULTI_CMS_PUBLISH,
    primaryDepartment: 'shopify_publishing',
    description: 'Multi-platform CMS publishing adapter',
    priorityTier: 'high',
    concurrencyLimit: 1,
    maxRetries: 5,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 60_000,
    supportsScheduling: true,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.WEBHOOK_DELIVERY,
    primaryDepartment: 'shopify_publishing',
    description: 'Webhook event delivery to client endpoints',
    priorityTier: 'normal',
    concurrencyLimit: 5,
    maxRetries: 3,
    fallbackDepartment: 'infrastructure',
    canDelegate: true,
    slaMs: 15_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },

  // ─── Data & Analytics ────────────────────────
  {
    queueName: QueueNames.KEYWORD_RESEARCH,
    primaryDepartment: 'data_analytics',
    description: 'Keyword research and SERP data collection via SerpAPI',
    priorityTier: 'high',
    concurrencyLimit: 3,
    maxRetries: 2,
    fallbackDepartment: 'seo',
    canDelegate: true,
    slaMs: 120_000,
    supportsScheduling: true,
    isSystemQueue: false,
  },

  // ─── Client Operations ───────────────────────
  {
    queueName: QueueNames.CLIENT_SCAN,
    primaryDepartment: 'client_operations',
    description: 'Single client website intelligence scan',
    priorityTier: 'high',
    concurrencyLimit: 2,
    maxRetries: 2,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 120_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.BATCH_CLIENT_SCAN,
    primaryDepartment: 'client_operations',
    description: 'Batch scan all clients for website intelligence',
    priorityTier: 'batch',
    concurrencyLimit: 1,
    maxRetries: 1,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 300_000,
    supportsScheduling: true,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.EDITORIAL_WORKFLOW,
    primaryDepartment: 'client_operations',
    description: 'Editorial review, approval, and rejection workflow',
    priorityTier: 'high',
    concurrencyLimit: 3,
    maxRetries: 3,
    fallbackDepartment: 'quality_assurance',
    canDelegate: true,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },

  // ─── Infrastructure ──────────────────────────
  {
    queueName: QueueNames.DEFAULT,
    primaryDepartment: 'infrastructure',
    description: 'Dead-letter queue and default fallback processing',
    priorityTier: 'low',
    concurrencyLimit: 2,
    maxRetries: 1,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: true,
  },
  {
    queueName: QueueNames.OBSERVABILITY,
    primaryDepartment: 'infrastructure',
    description: 'Observability metrics collection, alerting, health checks',
    priorityTier: 'low',
    concurrencyLimit: 2,
    maxRetries: 2,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 15_000,
    supportsScheduling: false,
    isSystemQueue: true,
  },

  // ─── Cost Optimization ───────────────────────
  {
    queueName: QueueNames.COST_OPTIMIZATION,
    primaryDepartment: 'cost_optimization',
    description: 'AI model cost optimization and budget management',
    priorityTier: 'normal',
    concurrencyLimit: 1,
    maxRetries: 1,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 15_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },

  // ─── Quality Assurance ───────────────────────
  {
    queueName: QueueNames.FACT_CHECK,
    primaryDepartment: 'quality_assurance',
    description: 'Fact checking with source citation and grounding',
    priorityTier: 'high',
    concurrencyLimit: 2,
    maxRetries: 3,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 60_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.AI_EVALUATION,
    primaryDepartment: 'quality_assurance',
    description: 'AI quality evaluation and benchmarking',
    priorityTier: 'high',
    concurrencyLimit: 1,
    maxRetries: 1,
    fallbackDepartment: 'seo',
    canDelegate: true,
    slaMs: 60_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },

  // ─── Odoo ERP Integration ───────────────────
  {
    queueName: QueueNames.ODOO_SYNC,
    primaryDepartment: 'odoo',
    description: 'Single Odoo record sync (create, read, update, delete)',
    priorityTier: 'high',
    concurrencyLimit: 3,
    maxRetries: 3,
    fallbackDepartment: 'client_operations',
    canDelegate: true,
    slaMs: 60_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.ODOO_BATCH_SYNC,
    primaryDepartment: 'odoo',
    description: 'Batch/full sync for Odoo models',
    priorityTier: 'normal',
    concurrencyLimit: 1,
    maxRetries: 2,
    fallbackDepartment: 'infrastructure',
    canDelegate: false,
    slaMs: 300_000,
    supportsScheduling: true,
    isSystemQueue: false,
  },
  {
    queueName: QueueNames.ODOO_WEBHOOK,
    primaryDepartment: 'odoo',
    description: 'Process incoming Odoo webhook events',
    priorityTier: 'high',
    concurrencyLimit: 3,
    maxRetries: 3,
    fallbackDepartment: null,
    canDelegate: false,
    slaMs: 30_000,
    supportsScheduling: false,
    isSystemQueue: false,
  },
];

// ══════════════════════════════════════════════════════════════════
// JOB TYPE → DEPARTMENT + QUEUE ROUTING
//
// Maps every JobTypes constant to its owning department and queue.
// This is the authoritative source for routing ANY job type string.
// ══════════════════════════════════════════════════════════════════

const JOB_TYPE_ROUTING_RULES: JobTypeRoutingRule[] = [
  // ─── Content Generation ──────────────────────
  {
    jobType: JobTypes.CONTENT_GENERATION,
    primaryQueue: QueueNames.CONTENT_GENERATION,
    primaryDepartment: 'ai_content',
    fallbackDepartments: [],
    description: 'Generate article content via LLM',
    requiresClientAuth: true,
    category: 'content',
  },
  {
    jobType: JobTypes.SCHEDULED_GENERATION,
    primaryQueue: QueueNames.CONTENT_GENERATION,
    primaryDepartment: 'ai_content',
    fallbackDepartments: [],
    description: 'Scheduled batch content generation',
    requiresClientAuth: true,
    category: 'content',
  },
  {
    jobType: JobTypes.IMAGE_GENERATION,
    primaryQueue: QueueNames.IMAGE_GENERATION,
    primaryDepartment: 'ai_content',
    fallbackDepartments: ['quality_assurance'],
    description: 'Generate article image via DALL-E',
    requiresClientAuth: true,
    category: 'content',
  },
  {
    jobType: JobTypes.BRAND_VOICE_ANALYSIS,
    primaryQueue: QueueNames.BRAND_VOICE,
    primaryDepartment: 'ai_content',
    fallbackDepartments: [],
    description: 'Analyze and extract brand voice profile',
    requiresClientAuth: true,
    category: 'content',
  },
  {
    jobType: JobTypes.BRAND_VOICE_GENERATE,
    primaryQueue: QueueNames.BRAND_VOICE,
    primaryDepartment: 'ai_content',
    fallbackDepartments: [],
    description: 'Generate brand-voice-optimized content',
    requiresClientAuth: true,
    category: 'content',
  },
  {
    jobType: JobTypes.PEXELS_IMAGE_FETCH,
    primaryQueue: QueueNames.PEXELS_IMAGE,
    primaryDepartment: 'ai_content',
    fallbackDepartments: [],
    description: 'Fetch stock image from Pexels API',
    requiresClientAuth: true,
    category: 'content',
  },
  {
    jobType: JobTypes.PEXELS_SEMANTIC_MATCH,
    primaryQueue: QueueNames.PEXELS_IMAGE,
    primaryDepartment: 'ai_content',
    fallbackDepartments: [],
    description: 'Semantic keyword matching for Pexels images',
    requiresClientAuth: false,
    category: 'content',
  },

  // ─── SEO ─────────────────────────────────────
  {
    jobType: JobTypes.SEO_ANALYSIS,
    primaryQueue: QueueNames.SEO_ANALYSIS,
    primaryDepartment: 'seo',
    fallbackDepartments: ['quality_assurance'],
    description: 'SEO content analysis and scoring',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.CONTENT_REVIEW,
    primaryQueue: QueueNames.SEO_ANALYSIS,
    primaryDepartment: 'seo',
    fallbackDepartments: ['quality_assurance'],
    description: 'Review content for SEO compliance',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.SEO_INTELLIGENCE,
    primaryQueue: QueueNames.SEO_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: ['data_analytics'],
    description: 'Advanced SEO intelligence analysis',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.SERP_ANALYSIS,
    primaryQueue: QueueNames.SEO_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: ['data_analytics'],
    description: 'SERP results analysis for keyword positioning',
    requiresClientAuth: false,
    category: 'seo',
  },
  {
    jobType: JobTypes.TOPICAL_AUTHORITY,
    primaryQueue: QueueNames.SEO_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: [],
    description: 'Topical authority and cluster analysis',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.ENTITY_EXTRACTION,
    primaryQueue: QueueNames.SEO_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: [],
    description: 'Named entity extraction from content',
    requiresClientAuth: false,
    category: 'seo',
  },
  {
    jobType: JobTypes.CONTENT_GAP_ANALYSIS,
    primaryQueue: QueueNames.SEO_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: ['data_analytics'],
    description: 'Content gap analysis against competitors',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.INTERNAL_LINKING,
    primaryQueue: QueueNames.INTERNAL_LINKING,
    primaryDepartment: 'seo',
    fallbackDepartments: [],
    description: 'Internal link optimization',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.CONTENT_INTELLIGENCE,
    primaryQueue: QueueNames.CONTENT_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: ['quality_assurance'],
    description: 'Content intelligence analysis',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.CANNIBALIZATION_CHECK,
    primaryQueue: QueueNames.CONTENT_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: [],
    description: 'Keyword cannibalization detection',
    requiresClientAuth: true,
    category: 'seo',
  },
  {
    jobType: JobTypes.KNOWLEDGE_GRAPH_BUILD,
    primaryQueue: QueueNames.CONTENT_INTELLIGENCE,
    primaryDepartment: 'seo',
    fallbackDepartments: [],
    description: 'Knowledge graph construction from content',
    requiresClientAuth: true,
    category: 'seo',
  },

  // ─── Publishing ──────────────────────────────
  {
    jobType: JobTypes.SHOPIFY_PUBLISH,
    primaryQueue: QueueNames.SHOPIFY_PUBLISH,
    primaryDepartment: 'shopify_publishing',
    fallbackDepartments: ['client_operations'],
    description: 'Publish article to Shopify',
    requiresClientAuth: true,
    category: 'publishing',
  },
  {
    jobType: JobTypes.APPROVED_PUBLISH,
    primaryQueue: QueueNames.SHOPIFY_PUBLISH,
    primaryDepartment: 'shopify_publishing',
    fallbackDepartments: ['client_operations'],
    description: 'Publish approved article to Shopify',
    requiresClientAuth: true,
    category: 'publishing',
  },
  {
    jobType: JobTypes.MULTI_CMS_PUBLISH,
    primaryQueue: QueueNames.MULTI_CMS_PUBLISH,
    primaryDepartment: 'shopify_publishing',
    fallbackDepartments: [],
    description: 'Publish to non-Shopify CMS platforms',
    requiresClientAuth: true,
    category: 'publishing',
  },
  {
    jobType: JobTypes.CMS_CONNECTION_TEST,
    primaryQueue: QueueNames.MULTI_CMS_PUBLISH,
    primaryDepartment: 'shopify_publishing',
    fallbackDepartments: [],
    description: 'Test CMS API connection',
    requiresClientAuth: true,
    category: 'publishing',
  },
  {
    jobType: JobTypes.WEBHOOK_DELIVERY,
    primaryQueue: QueueNames.WEBHOOK_DELIVERY,
    primaryDepartment: 'shopify_publishing',
    fallbackDepartments: ['infrastructure'],
    description: 'Deliver webhook event to client endpoint',
    requiresClientAuth: true,
    category: 'publishing',
  },

  // ─── Data & Analytics ────────────────────────
  {
    jobType: JobTypes.KEYWORD_RESEARCH,
    primaryQueue: QueueNames.KEYWORD_RESEARCH,
    primaryDepartment: 'data_analytics',
    fallbackDepartments: ['seo'],
    description: 'Keyword research via SerpAPI',
    requiresClientAuth: true,
    category: 'analytics',
  },

  // ─── Client Operations ───────────────────────
  {
    jobType: JobTypes.CLIENT_SCAN,
    primaryQueue: QueueNames.CLIENT_SCAN,
    primaryDepartment: 'client_operations',
    fallbackDepartments: [],
    description: 'Website intelligence scan for a single client',
    requiresClientAuth: true,
    category: 'operations',
  },
  {
    jobType: JobTypes.BATCH_CLIENT_SCAN,
    primaryQueue: QueueNames.BATCH_CLIENT_SCAN,
    primaryDepartment: 'client_operations',
    fallbackDepartments: [],
    description: 'Batch website scan for all clients',
    requiresClientAuth: false,
    category: 'operations',
  },
  {
    jobType: JobTypes.EDITORIAL_APPROVAL,
    primaryQueue: QueueNames.EDITORIAL_WORKFLOW,
    primaryDepartment: 'client_operations',
    fallbackDepartments: ['quality_assurance'],
    description: 'Editorial approval workflow step',
    requiresClientAuth: true,
    category: 'operations',
  },
  {
    jobType: JobTypes.EDITORIAL_REVIEW,
    primaryQueue: QueueNames.EDITORIAL_WORKFLOW,
    primaryDepartment: 'client_operations',
    fallbackDepartments: ['quality_assurance'],
    description: 'Editorial content review',
    requiresClientAuth: true,
    category: 'operations',
  },

  // ─── Infrastructure ──────────────────────────
  {
    jobType: JobTypes.FULL_PIPELINE,
    primaryQueue: QueueNames.DEFAULT,
    primaryDepartment: 'infrastructure',
    fallbackDepartments: [],
    description: 'Full end-to-end pipeline execution',
    requiresClientAuth: true,
    category: 'infrastructure',
  },
  {
    jobType: JobTypes.EMBEDDING_GENERATION,
    primaryQueue: QueueNames.DEFAULT,
    primaryDepartment: 'infrastructure',
    fallbackDepartments: [],
    description: 'Vector embedding generation for content',
    requiresClientAuth: false,
    category: 'infrastructure',
  },
  {
    jobType: JobTypes.OBSERVABILITY_FLUSH,
    primaryQueue: QueueNames.OBSERVABILITY,
    primaryDepartment: 'infrastructure',
    fallbackDepartments: [],
    description: 'Flush observability buffer to persistent storage',
    requiresClientAuth: false,
    category: 'infrastructure',
  },
  {
    jobType: JobTypes.OBSERVABILITY_METRICS,
    primaryQueue: QueueNames.OBSERVABILITY,
    primaryDepartment: 'infrastructure',
    fallbackDepartments: [],
    description: 'Collect and aggregate observability metrics',
    requiresClientAuth: false,
    category: 'infrastructure',
  },

  // ─── Cost Optimization ───────────────────────
  {
    jobType: JobTypes.COST_OPTIMIZATION,
    primaryQueue: QueueNames.COST_OPTIMIZATION,
    primaryDepartment: 'cost_optimization',
    fallbackDepartments: [],
    description: 'AI model cost optimization analysis',
    requiresClientAuth: true,
    category: 'cost',
  },
  {
    jobType: JobTypes.COST_REPORT,
    primaryQueue: QueueNames.COST_OPTIMIZATION,
    primaryDepartment: 'cost_optimization',
    fallbackDepartments: ['data_analytics'],
    description: 'Generate cost usage report',
    requiresClientAuth: true,
    category: 'cost',
  },

  // ─── Quality Assurance ───────────────────────
  {
    jobType: JobTypes.FACT_CHECK,
    primaryQueue: QueueNames.FACT_CHECK,
    primaryDepartment: 'quality_assurance',
    fallbackDepartments: [],
    description: 'Fact check content with source verification',
    requiresClientAuth: true,
    category: 'quality',
  },
  {
    jobType: JobTypes.FACT_CHECK_SOURCES,
    primaryQueue: QueueNames.FACT_CHECK,
    primaryDepartment: 'quality_assurance',
    fallbackDepartments: [],
    description: 'Source verification and citation checking',
    requiresClientAuth: false,
    category: 'quality',
  },
  {
    jobType: JobTypes.CLAIM_VERIFICATION,
    primaryQueue: QueueNames.FACT_CHECK,
    primaryDepartment: 'quality_assurance',
    fallbackDepartments: [],
    description: 'Verify specific claims in content',
    requiresClientAuth: false,
    category: 'quality',
  },
  {
    jobType: JobTypes.AI_EVALUATION,
    primaryQueue: QueueNames.AI_EVALUATION,
    primaryDepartment: 'quality_assurance',
    fallbackDepartments: ['seo'],
    description: 'AI content quality evaluation',
    requiresClientAuth: true,
    category: 'quality',
  },
  {
    jobType: JobTypes.BENCHMARK_RUN,
    primaryQueue: QueueNames.AI_EVALUATION,
    primaryDepartment: 'quality_assurance',
    fallbackDepartments: [],
    description: 'Run quality benchmark suite',
    requiresClientAuth: false,
    category: 'quality',
  },

  // ─── Odoo ERP Integration ───────────────────
  {
    jobType: JobTypes.ODOO_SYNC,
    primaryQueue: QueueNames.ODOO_SYNC,
    primaryDepartment: 'odoo',
    fallbackDepartments: ['client_operations'],
    description: 'Sync a single record between KOZMO Core and Odoo',
    requiresClientAuth: true,
    category: 'operations',
  },
  {
    jobType: JobTypes.ODOO_BATCH_SYNC,
    primaryQueue: QueueNames.ODOO_BATCH_SYNC,
    primaryDepartment: 'odoo',
    fallbackDepartments: ['infrastructure'],
    description: 'Batch sync all records for an Odoo model',
    requiresClientAuth: true,
    category: 'operations',
  },
  {
    jobType: JobTypes.ODOO_WEBHOOK_EVENT,
    primaryQueue: QueueNames.ODOO_WEBHOOK,
    primaryDepartment: 'odoo',
    fallbackDepartments: [],
    description: 'Process an incoming Odoo webhook event',
    requiresClientAuth: true,
    category: 'operations',
  },
  {
    jobType: JobTypes.ODOO_CONNECTION_TEST,
    primaryQueue: QueueNames.ODOO_SYNC,
    primaryDepartment: 'odoo',
    fallbackDepartments: ['infrastructure'],
    description: 'Test Odoo connection credentials',
    requiresClientAuth: false,
    category: 'operations',
  },
  {
    jobType: JobTypes.ODOO_FULL_SYNC,
    primaryQueue: QueueNames.ODOO_BATCH_SYNC,
    primaryDepartment: 'odoo',
    fallbackDepartments: [],
    description: 'Full synchronization of an Odoo model',
    requiresClientAuth: true,
    category: 'operations',
  },
];

// ══════════════════════════════════════════════════════════════════
// FALLBACK RULES — Cross-department delegation
// ══════════════════════════════════════════════════════════════════

/**
 * Ordered fallback chains per department.
 * When a department is overloaded, the CEO tries fallbacks in order.
 */
const DEPARTMENT_FALLBACK_CHAINS: Record<DepartmentName, DepartmentName[]> = {
  ai_content: ['seo'],                          // SEO can handle basic content gen
  seo: ['quality_assurance', 'data_analytics'], // QA can evaluate, Analytics has data
  shopify_publishing: ['client_operations'],     // Client Ops can handle scheduling
  data_analytics: ['seo', 'client_operations'],  // SEO has keyword tools, Client Ops scans
  client_operations: ['infrastructure'],         // Infra can handle scanning fallback
  infrastructure: ['client_operations'],          // Client Ops for operational fallback
  cost_optimization: ['data_analytics'],          // Analytics can generate reports
  quality_assurance: ['seo', 'ai_content'],       // SEO can evaluate, AI Content checks brand
  odoo: ['client_operations', 'infrastructure'],  // Client Ops can handle fallback sync ops
};

// ══════════════════════════════════════════════════════════════════
// TASK TYPE → DEPARTMENT RULES (for CEO.resolveDepartment)
//
// Pattern-based rules for inferring department from a task type string.
// ══════════════════════════════════════════════════════════════════

interface TaskTypeRule {
  /** Pattern to match against the task type string (lowercased) */
  patterns: string[];
  /** Department to route to */
  department: DepartmentName;
  /** Priority hint */
  defaultPriority: TaskPriority;
  /** Description */
  description: string;
}

const TASK_TYPE_ROUTING_RULES: TaskTypeRule[] = [
  // AI Content
  // Note: patterns must be specific — broad patterns like 'generate' or 'article'
  // would incorrectly capture 'generate_report' (Analytics) or 'verify_article' (QA)
  { patterns: ['generate_article', 'generate_image', 'content_gen'], department: 'ai_content', defaultPriority: 'high', description: 'Content generation tasks' },
  { patterns: ['image_gen'], department: 'ai_content', defaultPriority: 'normal', description: 'Image generation tasks' },
  { patterns: ['brand_voice'], department: 'ai_content', defaultPriority: 'high', description: 'Brand voice analysis' },
  { patterns: ['pexels'], department: 'ai_content', defaultPriority: 'normal', description: 'Pexels image fetching' },

  // SEO
  { patterns: ['seo_analysis', 'seo_optimize'], department: 'seo', defaultPriority: 'high', description: 'SEO analysis tasks' },
  { patterns: ['seo_intel', 'serp'], department: 'seo', defaultPriority: 'high', description: 'SEO intelligence / SERP' },
  { patterns: ['entity', 'content_gap', 'topical'], department: 'seo', defaultPriority: 'normal', description: 'Advanced SEO analysis' },
  { patterns: ['internal_link', 'cannibal'], department: 'seo', defaultPriority: 'normal', description: 'Content linking/cannibalization' },
  { patterns: ['content_intel'], department: 'seo', defaultPriority: 'normal', description: 'Content intelligence' },

  // Publishing
  { patterns: ['publish', 'shopify_pub'], department: 'shopify_publishing', defaultPriority: 'high', description: 'Publishing tasks' },
  { patterns: ['cms_'], department: 'shopify_publishing', defaultPriority: 'high', description: 'CMS operations' },
  { patterns: ['webhook_'], department: 'shopify_publishing', defaultPriority: 'normal', description: 'Webhook delivery' },

  // Data & Analytics
  { patterns: ['keyword_research', 'research_keyword'], department: 'data_analytics', defaultPriority: 'high', description: 'Keyword research' },
  { patterns: ['analytics', 'report', 'dashboard_data'], department: 'data_analytics', defaultPriority: 'normal', description: 'Analytics and reporting' },
  { patterns: ['metric'], department: 'data_analytics', defaultPriority: 'low', description: 'Metric collection' },

  // Client Operations
  { patterns: ['client_scan', 'scan_client'], department: 'client_operations', defaultPriority: 'high', description: 'Client scanning' },
  { patterns: ['batch_scan'], department: 'client_operations', defaultPriority: 'batch', description: 'Batch scanning' },
  { patterns: ['editorial', 'approve', 'reject', 'review'], department: 'client_operations', defaultPriority: 'high', description: 'Editorial workflow' },
  { patterns: ['schedule', 'scheduling'], department: 'client_operations', defaultPriority: 'normal', description: 'Task scheduling' },

  // Infrastructure
  { patterns: ['health', 'health_check'], department: 'infrastructure', defaultPriority: 'high', description: 'System health checks' },
  { patterns: ['monitor', 'alert'], department: 'infrastructure', defaultPriority: 'high', description: 'Monitoring and alerting' },
  { patterns: ['dead_letter', 'dlq'], department: 'infrastructure', defaultPriority: 'low', description: 'Dead letter processing' },
  { patterns: ['observability', 'flush'], department: 'infrastructure', defaultPriority: 'low', description: 'Observability pipeline' },
  { patterns: ['circuit'], department: 'infrastructure', defaultPriority: 'critical', description: 'Circuit breaker operations' },

  // Cost
  { patterns: ['cost_route', 'cost_opt'], department: 'cost_optimization', defaultPriority: 'normal', description: 'Cost optimization' },
  { patterns: ['budget', 'cost_report'], department: 'cost_optimization', defaultPriority: 'normal', description: 'Cost reporting' },
  { patterns: ['token_'], department: 'cost_optimization', defaultPriority: 'normal', description: 'Token management' },

  // Quality
  { patterns: ['fact_check', 'claim_', 'verify'], department: 'quality_assurance', defaultPriority: 'high', description: 'Fact checking' },
  { patterns: ['evaluate', 'quality_gate'], department: 'quality_assurance', defaultPriority: 'high', description: 'Quality evaluation' },
  { patterns: ['benchmark'], department: 'quality_assurance', defaultPriority: 'low', description: 'Benchmarking' },

  // Odoo
  { patterns: ['odoo_sync', 'odoo_'], department: 'odoo', defaultPriority: 'high', description: 'Odoo sync operations' },
  { patterns: ['odoo_batch', 'odoo_full'], department: 'odoo', defaultPriority: 'normal', description: 'Odoo batch/full sync' },
  { patterns: ['odoo_webhook'], department: 'odoo', defaultPriority: 'high', description: 'Odoo webhook event' },
  { patterns: ['odoo_connection'], department: 'odoo', defaultPriority: 'high', description: 'Odoo connection test' },
  { patterns: ['odoo_map'], department: 'odoo', defaultPriority: 'normal', description: 'Odoo entity mapping' },
  { patterns: ['odoo_read'], department: 'odoo', defaultPriority: 'normal', description: 'Read Odoo model data' },
];

// ══════════════════════════════════════════════════════════════════
// INDEX BUILDERS — Build Maps at Module Load Time
// ══════════════════════════════════════════════════════════════════

// QueueName → QueueRoutingPolicy
const queuePolicyIndex = new Map<QueueNames, QueueRoutingPolicy>();
for (const policy of QUEUE_ROUTING_POLICIES) {
  queuePolicyIndex.set(policy.queueName, policy);
}

// Department → QueueRoutingPolicy[]
const departmentQueuesIndex = new Map<DepartmentName, QueueRoutingPolicy[]>();
for (const policy of QUEUE_ROUTING_POLICIES) {
  const dept = policy.primaryDepartment;
  if (!departmentQueuesIndex.has(dept)) {
    departmentQueuesIndex.set(dept, []);
  }
  departmentQueuesIndex.get(dept)!.push(policy);
}

// JobType string → JobTypeRoutingRule
const jobTypeIndex = new Map<string, JobTypeRoutingRule>();
for (const rule of JOB_TYPE_ROUTING_RULES) {
  jobTypeIndex.set(rule.jobType, rule);
}

// Queue → Department (reverse lookup)
const queueDepartmentIndex = new Map<QueueNames, DepartmentName>();
for (const [dept, queues] of Object.entries(DEPARTMENT_QUEUES_MAP)) {
  for (const queue of queues) {
    queueDepartmentIndex.set(queue, dept as DepartmentName);
  }
}

// Department → QueueNames[] (from the authoritative map)
const departmentQueueNamesIndex = new Map<DepartmentName, QueueNames[]>();
for (const [dept, queues] of Object.entries(DEPARTMENT_QUEUES_MAP)) {
  departmentQueueNamesIndex.set(dept as DepartmentName, [...queues]);
}

// All queue names indexed by department for quick lookup
const allQueueNames = new Set(Object.values(QueueNames));

// ══════════════════════════════════════════════════════════════════
// ROUTING TABLE CLASS
// ══════════════════════════════════════════════════════════════════

export class CeoRoutingTable {
  // ─── Department Resolution ───────────────────

  /**
   * Resolve the owning department for a task type using
   * rule-based matching. Falls back to DEPARTMENT_QUEUES_MAP
   * for exact queue name matches, then to payload heuristics.
   */
  resolveDepartment(
    taskType: string,
    payload?: Record<string, unknown>
  ): DepartmentName {
    const lowerType = taskType.toLowerCase();

    // 1. Try exact match against job types
    if (jobTypeIndex.has(taskType)) {
      return jobTypeIndex.get(taskType)!.primaryDepartment;
    }

    // 2. Try pattern-based task type rules
    for (const rule of TASK_TYPE_ROUTING_RULES) {
      for (const pattern of rule.patterns) {
        if (lowerType.includes(pattern)) {
          return rule.department;
        }
      }
    }

    // 3. Try payload heuristics
    if (payload) {
      if (payload.keyword && !payload.content) return 'data_analytics';
      if (payload.content && payload.keyword) return 'seo';
      if (payload.articleId || payload.articleTitle) return 'ai_content';
      if (payload.clientId && payload.force) return 'client_operations';
      if (payload.url) return 'client_operations';
      if (payload.estimatedTokens || payload.requiredQuality) return 'cost_optimization';
      if (payload.benchmarkId || payload.checkType) return 'quality_assurance';
    }

    // 4. Default: infrastructure (safe fallback)
    return 'infrastructure';
  }

  /**
   * Resolve department and queue for a known job type.
   * Throws if the job type is not registered.
   */
  resolveJobType(jobType: string): JobTypeRoutingRule {
    const rule = jobTypeIndex.get(jobType);
    if (!rule) {
      throw new Error(`Unknown job type: "${jobType}". Register it in CeoRoutingTable.JOB_TYPE_ROUTING_RULES.`);
    }
    return rule;
  }

  /**
   * Safe version — returns null for unknown job types instead of throwing.
   */
  resolveJobTypeSafe(jobType: string): JobTypeRoutingRule | null {
    return jobTypeIndex.get(jobType) || null;
  }

  // ─── Queue Resolution ────────────────────────

  /**
   * Get the routing policy for a queue.
   */
  getQueuePolicy(queueName: QueueNames): QueueRoutingPolicy | undefined {
    return queuePolicyIndex.get(queueName);
  }

  /**
   * Get the owning department for a queue.
   */
  getDepartmentForQueue(queueName: QueueNames): DepartmentName {
    const dept = queueDepartmentIndex.get(queueName);
    if (!dept) {
      throw new Error(`Queue "${queueName}" has no department assignment in CeoRoutingTable.`);
    }
    return dept;
  }

  /**
   * Get all queues managed by a department.
   */
  getQueuesForDepartment(department: DepartmentName): QueueNames[] {
    return departmentQueueNamesIndex.get(department) || [];
  }

  /**
   * Get the full routing policy for each queue managed by a department.
   */
  getDepartmentQueuePolicies(department: DepartmentName): QueueRoutingPolicy[] {
    return departmentQueuesIndex.get(department) || [];
  }

  // ─── Fallback Resolution ─────────────────────

  /**
   * Get the ordered fallback chain for a department.
   */
  getFallbackChain(department: DepartmentName): DepartmentName[] {
    return DEPARTMENT_FALLBACK_CHAINS[department] || [];
  }

  /**
   * Find the best fallback department for a primary department.
   * Returns null if no fallback is configured.
   */
  findFallbackDepartment(
    primary: DepartmentName,
    healthStatuses: Record<string, { status: string; failedJobs24h?: number }>
  ): DepartmentName | null {
    const chain = this.getFallbackChain(primary);

    for (const fallback of chain) {
      const health = healthStatuses[fallback];
      if (!health || health.status === 'healthy' || (health.status === 'degraded' && (health.failedJobs24h || 0) < 5)) {
        return fallback;
      }
    }

    return null;
  }

  // ─── Job Type Registration (for validation) ──

  /**
   * Check if all JobTypes constants are registered in the routing table.
   * Returns missing job types.
   */
  validateJobTypeCoverage(): string[] {
    const registered = new Set(jobTypeIndex.keys());
    const allJobTypes = Object.values(JobTypes);
    return allJobTypes.filter(jt => !registered.has(jt));
  }

  /**
   * Check if all QueueNames are covered by a routing policy.
   * Returns missing queue names.
   */
  validateQueueCoverage(): string[] {
    const registered = new Set(queuePolicyIndex.keys());
    const allQueues = Object.values(QueueNames);
    return allQueues.filter(q => !registered.has(q));
  }

  // ─── Bulk Accessors ──────────────────────────

  getAllQueuePolicies(): QueueRoutingPolicy[] {
    return [...QUEUE_ROUTING_POLICIES];
  }

  getAllJobTypeRules(): JobTypeRoutingRule[] {
    return [...JOB_TYPE_ROUTING_RULES];
  }

  getAllDepartments(): DepartmentName[] {
    return Object.keys(DEPARTMENT_QUEUES_MAP) as DepartmentName[];
  }

  getAllTaskTypeRules(): TaskTypeRule[] {
    return [...TASK_TYPE_ROUTING_RULES];
  }

  /**
   * Get the canonical DEPARTMENT_QUEUES map for integration with existing code.
   */
  getDepartmentQueuesMap(): Record<DepartmentName, QueueNames[]> {
    return { ...DEPARTMENT_QUEUES_MAP };
  }
}

// Singleton
export default new CeoRoutingTable();
