// <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
// (c) 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import type { UserRole } from '../types';
import type { DepartmentName } from './managers/types';

export type SystemRole = UserRole | 'connector';

export type SystemDomainName =
  | 'system'
  | 'client'
  | 'access'
  | 'storage'
  | 'content'
  | 'ads'
  | 'integration'
  | 'automation'
  | 'intelligence'
  | 'operations';

export type SystemBoundaryStatus = 'inventory' | 'contracted' | 'runtime-owned';

export type SystemQueueName =
  | 'content-generation'
  | 'keyword-research'
  | 'shopify-publish'
  | 'image-generation'
  | 'seo-analysis'
  | 'internal-linking'
  | 'webhook-delivery'
  | 'default'
  | 'dead-letter'
  | 'fact-check'
  | 'brand-voice'
  | 'seo-intelligence'
  | 'multi-cms-publish'
  | 'pexels-image'
  | 'cost-optimization'
  | 'editorial-workflow'
  | 'content-intelligence'
  | 'ai-evaluation'
  | 'observability'
  | 'client-scan'
  | 'batch-client-scan'
  | 'odoo-sync'
  | 'odoo-batch-sync'
  | 'odoo-webhook';

export interface SystemDomainContract {
  readonly domain: SystemDomainName;
  readonly managerName: string;
  readonly status: SystemBoundaryStatus;
  readonly sourceOfTruth: readonly string[];
  readonly allowedRoles: readonly SystemRole[];
  readonly departments: readonly DepartmentName[];
  readonly queues: readonly SystemQueueName[];
  readonly routePrefixes: readonly string[];
  readonly storageTables: readonly string[];
  readonly credentialNames: readonly string[];
  readonly currentLimits: readonly string[];
  readonly safetyRules: readonly string[];
  readonly nextPhase: string;
}

export interface SystemArchitectureContract {
  readonly generatedFrom: readonly string[];
  readonly runtimeWiring: 'not-wired';
  readonly domains: readonly SystemDomainContract[];
}

const DEPARTMENT_QUEUE_NAMES: Record<DepartmentName, readonly SystemQueueName[]> = {
  ai_content: ['content-generation', 'image-generation', 'brand-voice', 'pexels-image'],
  seo: ['seo-analysis', 'seo-intelligence', 'content-intelligence', 'internal-linking'],
  shopify_publishing: ['shopify-publish', 'multi-cms-publish', 'webhook-delivery'],
  data_analytics: ['keyword-research'],
  client_operations: ['client-scan', 'batch-client-scan', 'editorial-workflow'],
  infrastructure: ['default', 'observability'],
  cost_optimization: ['cost-optimization'],
  quality_assurance: ['fact-check', 'ai-evaluation'],
  odoo: ['odoo-sync', 'odoo-batch-sync', 'odoo-webhook'],
};

const ALL_QUEUE_NAMES: readonly SystemQueueName[] = [
  'content-generation',
  'keyword-research',
  'shopify-publish',
  'image-generation',
  'seo-analysis',
  'internal-linking',
  'webhook-delivery',
  'default',
  'dead-letter',
  'fact-check',
  'brand-voice',
  'seo-intelligence',
  'multi-cms-publish',
  'pexels-image',
  'cost-optimization',
  'editorial-workflow',
  'content-intelligence',
  'ai-evaluation',
  'observability',
  'client-scan',
  'batch-client-scan',
  'odoo-sync',
  'odoo-batch-sync',
  'odoo-webhook',
];

const departmentQueues = (...departments: DepartmentName[]): SystemQueueName[] => {
  const queueSet = new Set<SystemQueueName>();
  for (const department of departments) {
    for (const queue of DEPARTMENT_QUEUE_NAMES[department]) queueSet.add(queue);
  }
  return [...queueSet];
};

const PHASE_2_SAFETY_RULES = [
  'Do not initialize SystemManager from backend/index.ts in Phase 2.',
  'Do not enqueue jobs from the SystemManager contract.',
  'Do not send emails or client-facing reports from the SystemManager contract.',
  'Do not publish content from the SystemManager contract.',
  'Do not store secret values in the SystemManager contract.',
] as const;

const withSafetyRules = (rules: readonly string[] = []): readonly string[] => {
  return [...PHASE_2_SAFETY_RULES, ...rules];
};

export const SYSTEM_ARCHITECTURE_CONTRACT: SystemArchitectureContract = {
  generatedFrom: [
    'doc/architecture/ROUTE-AUTH-MATRIX.md',
    'doc/architecture/ROLE-ACTION-MATRIX.md',
    'doc/architecture/STORAGE-OWNERSHIP.md',
    'doc/architecture/JOB-WORKFLOW-MATRIX.md',
    'doc/architecture/INTEGRATION-CREDENTIAL-MATRIX.md',
    'backend/orchestrators/managers/types.ts',
  ],
  runtimeWiring: 'not-wired',
  domains: [
    {
      domain: 'system',
      managerName: 'System Manager',
      status: 'contracted',
      sourceOfTruth: ['backend/orchestrators/SystemManager.ts', 'doc/architecture/SYSTEM-MANAGER-CONTRACT.md'],
      allowedRoles: ['super_admin', 'admin'],
      departments: ['infrastructure'],
      queues: departmentQueues('infrastructure'),
      routePrefixes: ['/health', '/metrics', '/api/config', '/api/observability', '/api/worker-scoring'],
      storageTables: ['system_config', 'system_alerts', 'worker_hierarchy', 'worker_performance', 'worker_performance_scores'],
      credentialNames: ['NODE_ENV', 'PORT', 'LOG_LEVEL', 'TDS_PUBLIC_URL'],
      currentLimits: [
        'Does not own runtime bootstrap yet.',
        'CEO health, Express health, and workflow state are still separate surfaces.',
      ],
      safetyRules: withSafetyRules(),
      nextPhase: 'Use this contract as the target boundary when extracting bootstrap and health ownership.',
    },
    {
      domain: 'client',
      managerName: 'Client Manager',
      status: 'inventory',
      sourceOfTruth: ['backend/routes/clients.ts', 'doc/architecture/STORAGE-OWNERSHIP.md'],
      allowedRoles: ['super_admin', 'admin', 'editor', 'client'],
      departments: ['client_operations'],
      queues: departmentQueues('client_operations'),
      routePrefixes: ['/api/clients', '/api/demo', '/api/scraper'],
      storageTables: ['clients', 'client_audits', 'demo_signups', 'website_intelligence'],
      credentialNames: ['SHOPIFY_DEFAULT_SHOP', 'SHOPIFY_DEFAULT_ACCESS_TOKEN'],
      currentLimits: ['Client token storage is mixed between clients, cms_connections, and vault surfaces.'],
      safetyRules: withSafetyRules(),
      nextPhase: 'Move client lifecycle and active/excluded policy behind one client service boundary.',
    },
    {
      domain: 'access',
      managerName: 'Role/Access Manager',
      status: 'inventory',
      sourceOfTruth: ['backend/middleware/auth.ts', 'doc/architecture/ROLE-ACTION-MATRIX.md'],
      allowedRoles: ['super_admin', 'admin'],
      departments: ['infrastructure'],
      queues: [],
      routePrefixes: ['/api/auth', '/api/devices', '/api/security'],
      storageTables: ['users', 'api_keys', 'device_registry', 'employee_sessions', 'permission_matrix', 'audit_log'],
      credentialNames: ['JWT_SECRET', 'JWT_EXPIRES_IN', 'SESSION_TTL_HOURS', 'DEVICE_FINGERPRINT_SALT'],
      currentLimits: ['Frontend role union does not include super_admin; connector is synthetic API-key auth.'],
      safetyRules: withSafetyRules(),
      nextPhase: 'Centralize route permission assertions before changing RBAC behavior.',
    },
    {
      domain: 'storage',
      managerName: 'Storage Manager',
      status: 'inventory',
      sourceOfTruth: ['doc/architecture/STORAGE-OWNERSHIP.md', 'scripts/sync-nextcloud-safe.sh'],
      allowedRoles: ['super_admin', 'admin'],
      departments: ['infrastructure'],
      queues: [],
      routePrefixes: ['/api/vault', '/api/memory'],
      storageTables: ['credential_vault', 'credential_access_log', 'secret_rotation', 'content_embeddings', 'article_memory'],
      credentialNames: ['DATABASE_URL', 'REDIS_URL', 'CREDENTIAL_VAULT_KEY', 'ENCRYPTION_KEY', 'NEXTCLOUD_URL'],
      currentLimits: ['Direct pool.query calls remain spread across routes, services, workers, and scripts.'],
      safetyRules: withSafetyRules(),
      nextPhase: 'Define storage ownership repositories before broad data-path refactors.',
    },
    {
      domain: 'content',
      managerName: 'Content Manager',
      status: 'inventory',
      sourceOfTruth: ['backend/routes/articles.ts', 'backend/orchestrators/blogPipeline.ts'],
      allowedRoles: ['super_admin', 'admin', 'editor', 'client'],
      departments: ['ai_content', 'seo', 'quality_assurance', 'shopify_publishing'],
      queues: departmentQueues('ai_content', 'seo', 'quality_assurance', 'shopify_publishing'),
      routePrefixes: ['/api/articles', '/api/quality', '/api/editorial', '/api/brand-voice'],
      storageTables: ['articles', 'article_images', 'publishing_history', 'editorial_calendar', 'brand_voice_profiles'],
      credentialNames: ['OPENAI_API_KEY', 'OLLAMA_API_KEY', 'PEXELS_API_KEY', 'SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'],
      currentLimits: ['HTTP routes, pipeline orchestration, schedules, and Shopify publishing still share side effects.'],
      safetyRules: withSafetyRules(['Preserve hidden-draft/manual-approval publishing behavior.']),
      nextPhase: 'Keep draft/manual approval boundaries intact while moving content state behind owned services.',
    },
    {
      domain: 'ads',
      managerName: 'Ads Manager',
      status: 'inventory',
      sourceOfTruth: ['backend/routes/adsReports.ts', 'backend/services/adsReporting.ts'],
      allowedRoles: ['super_admin', 'admin'],
      departments: ['data_analytics'],
      queues: [],
      routePrefixes: ['/api/ads-reports'],
      storageTables: [],
      credentialNames: ['ADS_REPORTING_PROJECT', 'ADS_REPORTING_PYTHON', 'META_SYSTEM_USER_TOKEN', 'META_PAGE_ACCESS_TOKEN'],
      currentLimits: ['Ads reporting is internal-only and lacks an artifact approval/delivery registry.'],
      safetyRules: withSafetyRules(['Keep ads reporting internal-only.']),
      nextPhase: 'Add artifact ownership and approval state before any client-facing delivery automation.',
    },
    {
      domain: 'integration',
      managerName: 'Integration Manager',
      status: 'inventory',
      sourceOfTruth: ['doc/architecture/INTEGRATION-CREDENTIAL-MATRIX.md', 'backend/routes/connectors.ts'],
      allowedRoles: ['super_admin', 'admin'],
      departments: ['shopify_publishing', 'odoo'],
      queues: departmentQueues('shopify_publishing', 'odoo'),
      routePrefixes: ['/api/shopify', '/api/cms', '/api/gsc', '/api/connectors', '/api/webhooks'],
      storageTables: ['cms_connections', 'shopify_sessions', 'gsc_auth', 'odoo_connections', 'webhooks'],
      credentialNames: ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'GSC_CLIENT_SECRET', 'DATAFORSEO_PASSWORD', 'AWS_SECRET_ACCESS_KEY'],
      currentLimits: ['Credential names are inventoried, but provider ownership and rotation policy are not unified.'],
      safetyRules: withSafetyRules(),
      nextPhase: 'Route provider setup, health, and token rotation through one integration boundary.',
    },
    {
      domain: 'automation',
      managerName: 'Automation Manager',
      status: 'inventory',
      sourceOfTruth: ['backend/utils/queue.ts', 'doc/architecture/JOB-WORKFLOW-MATRIX.md'],
      allowedRoles: ['super_admin', 'admin'],
      departments: ['infrastructure', 'client_operations', 'shopify_publishing'],
      queues: ALL_QUEUE_NAMES,
      routePrefixes: ['/api/pipeline', '/api/heartbeat'],
      storageTables: ['jobs', 'publishing_queue', 'schedules', 'workflow_logs', 'activity_logs'],
      credentialNames: ['REDIS_URL', 'WORKER_CONCURRENCY', 'QUEUE_MAX_CONCURRENT'],
      currentLimits: ['BullMQ queues and SQL workflow tables are not yet reconciled into one lifecycle.'],
      safetyRules: withSafetyRules(),
      nextPhase: 'Define canonical workflow/outbox before managers trigger automatic cross-system effects.',
    },
    {
      domain: 'intelligence',
      managerName: 'Intelligence Manager',
      status: 'inventory',
      sourceOfTruth: ['backend/routes/knowledgeBase.ts', 'graphify-out/GRAPH_REPORT.md'],
      allowedRoles: ['super_admin', 'admin', 'editor'],
      departments: ['ai_content', 'seo', 'quality_assurance', 'data_analytics'],
      queues: departmentQueues('ai_content', 'seo', 'quality_assurance', 'data_analytics'),
      routePrefixes: ['/api/knowledge-bases', '/api/content-intel', '/api/geo', '/api/ai-seo'],
      storageTables: ['knowledge_bases', 'kb_documents', 'knowledge_graph_entities', 'knowledge_graph_relationships', 'evaluation_results'],
      credentialNames: ['OPENAI_API_KEY', 'OLLAMA_API_KEY', 'AI_PROVIDER'],
      currentLimits: ['Graphify is operational but separate from runtime intelligence ownership.'],
      safetyRules: withSafetyRules(),
      nextPhase: 'Make intelligence artifacts observable from manager health before changing generation flows.',
    },
    {
      domain: 'operations',
      managerName: 'Operations Manager',
      status: 'contracted',
      sourceOfTruth: ['doc/PRODUCTION-CONTRACT.md', '.github/workflows/deploy-truenas.yml', 'scripts/smoke-test.sh'],
      allowedRoles: ['super_admin', 'admin'],
      departments: ['infrastructure'],
      queues: departmentQueues('infrastructure'),
      routePrefixes: ['/health', '/metrics'],
      storageTables: ['system_alerts', '_migrations'],
      credentialNames: ['TRUENAS_ENV', 'TRUENAS_ENV_B64', 'DEPLOY_SSH_KEY', 'SLACK_WEBHOOK_DEPLOYS'],
      currentLimits: ['TrueNAS is canonical production deploy; authenticated UI smoke remains blocked without admin session.'],
      safetyRules: withSafetyRules(['Keep TrueNAS deploy and production smoke as required release gates.']),
      nextPhase: 'Keep deploy/smoke truth as the release gate for every architecture phase.',
    },
  ],
};

export class SystemManager {
  readonly contract = SYSTEM_ARCHITECTURE_CONTRACT;

  listDomains(): readonly SystemDomainContract[] {
    return this.contract.domains;
  }

  getDomain(domain: SystemDomainName): SystemDomainContract {
    const match = this.contract.domains.find((entry) => entry.domain === domain);
    if (!match) throw new Error(`Unknown system domain: ${domain}`);
    return match;
  }

  listRuntimeOwnedDomains(): readonly SystemDomainContract[] {
    return this.contract.domains.filter((entry) => entry.status === 'runtime-owned');
  }
}
