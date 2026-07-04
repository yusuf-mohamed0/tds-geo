// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

export const Events = {
  ARTICLE_CREATED: 'article:created',
  ARTICLE_UPDATED: 'article:updated',
  ARTICLE_PUBLISHED: 'article:published',
  ARTICLE_GENERATED: 'article:generated',
  ARTICLE_APPROVED: 'article:approved',
  ARTICLE_REJECTED: 'article:rejected',

  CONTENT_ANALYZED: 'content:analyzed',
  SEO_ANALYZED: 'seo:analyzed',
  SEO_OPTIMIZED: 'seo:optimized',

  RESEARCH_COMPLETED: 'research:completed',
  KEYWORD_DISCOVERED: 'keyword:discovered',

  QUALITY_CHECKED: 'quality:checked',
  FACT_CHECKED: 'fact:checked',

  MEMORY_UPDATED: 'memory:updated',
  MEMORY_QUERIED: 'memory:queried',

  PUBLISH_SUCCEEDED: 'publish:succeeded',
  PUBLISH_FAILED: 'publish:failed',
  SYNC_COMPLETED: 'sync:completed',

  CONNECTOR_REGISTERED: 'connector:registered',
  CONNECTOR_DISCONNECTED: 'connector:disconnected',
  CONNECTOR_HEALTH_CHANGED: 'connector:health:changed',

  ANALYTICS_UPDATED: 'analytics:updated',
  LEARNING_COMPLETED: 'learning:completed',

  PIPELINE_STARTED: 'pipeline:started',
  PIPELINE_STEP_COMPLETED: 'pipeline:step:completed',
  PIPELINE_COMPLETED: 'pipeline:completed',
  PIPELINE_FAILED: 'pipeline:failed',

  ERROR_OCCURRED: 'error:occurred',
} as const;

export type EventType = typeof Events[keyof typeof Events];
