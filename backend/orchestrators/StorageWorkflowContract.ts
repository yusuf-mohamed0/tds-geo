// <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
// (c) 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

export type StorageOwnerName =
  | 'client'
  | 'content'
  | 'credential'
  | 'integration'
  | 'workflow'
  | 'audit'
  | 'system';

export type StorageSensitivity = 'public-metadata' | 'tenant-data' | 'secret-bearing' | 'workflow-state' | 'audit-log';

export type StorageMigrationStatus = 'current-direct-sql' | 'contracted-owner' | 'repository-owned';

export interface StorageTableContract {
  readonly table: string;
  readonly owner: StorageOwnerName;
  readonly sensitivity: StorageSensitivity;
  readonly status: StorageMigrationStatus;
  readonly primaryWriters: readonly string[];
  readonly currentRisks: readonly string[];
  readonly requiredInvariants: readonly string[];
}

export type WorkflowStateStore = 'bullmq' | 'sql-jobs' | 'sql-publishing-queue' | 'sql-schedules' | 'sql-logs';

export interface WorkflowLifecycleContract {
  readonly name: string;
  readonly currentStores: readonly WorkflowStateStore[];
  readonly currentEntrypoints: readonly string[];
  readonly currentTerminalStates: readonly string[];
  readonly currentRisks: readonly string[];
  readonly requiredInvariants: readonly string[];
  readonly nextOwnershipStep: string;
}

export interface StorageWorkflowArchitectureContract {
  readonly runtimeWiring: 'not-wired';
  readonly sourceOfTruth: readonly string[];
  readonly tables: readonly StorageTableContract[];
  readonly workflows: readonly WorkflowLifecycleContract[];
  readonly safetyRules: readonly string[];
}

const CONTRACT_SAFETY_RULES = [
  'Do not move or migrate secret values in Phase 3 without a separate migration plan and rollback evidence.',
  'Do not change route behavior, response shapes, auth behavior, or worker execution behavior from this contract.',
  'Do not change Shopify publishing semantics: hidden drafts, manual approval, and scheduled publish controls remain intact.',
  'Do not treat BullMQ and SQL workflow tables as one canonical lifecycle until a durable outbox is implemented.',
  'Do not add client-facing ads delivery, emails, or live publish automation from this contract.',
] as const;

export const STORAGE_WORKFLOW_CONTRACT: StorageWorkflowArchitectureContract = {
  runtimeWiring: 'not-wired',
  sourceOfTruth: [
    'doc/architecture/STORAGE-OWNERSHIP.md',
    'doc/architecture/JOB-WORKFLOW-MATRIX.md',
    'backend/routes/clients.ts',
    'backend/routes/articles.ts',
    'backend/routes/admin.ts',
    'backend/routes/billing.ts',
    'backend/routes/cms.ts',
    'backend/routes/connectors.ts',
    'backend/routes/credentialVault.ts',
    'backend/routes/shopifyInstall.ts',
    'backend/routes/complianceWebhooks.ts',
    'backend/routes/embedded.ts',
    'backend/routes/quality.ts',
    'backend/routes/webhooks.ts',
    'backend/services/chatEngine.ts',
    'backend/services/autoPublishService.ts',
    'backend/services/demoProvisioner.ts',
    'backend/services/editorialWorkflow.ts',
    'backend/services/globalMemory.ts',
    'backend/services/internalLinks.ts',
    'backend/services/multiCmsPublisher.ts',
    'backend/services/selfImprovementService.ts',
    'backend/services/shopify/auth.ts',
    'backend/services/shopify/content.ts',
    'backend/services/scheduler.ts',
    'backend/orchestrators/blogPipeline.ts',
    'backend/engines/publisher/index.ts',
    'backend/repositories/articleRepo.ts',
    'backend/repositories/clientRepo.ts',
    'backend/repositories/logRepo.ts',
    'backend/utils/logger.ts',
    'backend/index.ts',
    'backend/workers/index.ts',
    'backend/routes/enterprisePipeline.ts',
    'backend/scripts/importAllCredentials.ts',
    'backend/scripts/importCredentials.ts',
    'backend/scripts/vault.ts',
    'backend/scripts/rotateVaultKey.ts',
    'backend/scripts/repairFlauntShortArticles.ts',
    'backend/scripts/syncRepairedFlauntToShopify.ts',
    'backend/scripts/replaceFlauntDrafts.ts',
    'backend/scripts/moveFlauntDraftsToBeautyTips.ts',
  ],
  tables: [
    {
      table: 'clients',
      owner: 'client',
      sensitivity: 'secret-bearing',
      status: 'contracted-owner',
      primaryWriters: [
        'backend/routes/billing.ts',
        'backend/routes/clients.ts',
        'backend/routes/complianceWebhooks.ts',
        'backend/routes/shopifyInstall.ts',
        'backend/repositories/clientRepo.ts',
        'backend/services/chatEngine.ts',
        'backend/services/demoProvisioner.ts',
        'backend/services/globalMemory.ts',
        'backend/services/selfImprovementService.ts',
        'backend/services/shopify/auth.ts',
        'backend/workers/index.ts',
      ],
      currentRisks: [
        'Contains legacy Shopify token columns alongside integration/vault credential surfaces.',
        'Client delete route performs hard delete and relies on database cascades.',
        'Client state is mutated by billing, compliance, demo, chat, repository, memory, self-improvement, Shopify auth, route, and worker paths.',
      ],
      requiredInvariants: [
        'Never expose shopify_token or refresh token values in route responses, logs, generated docs, or reports.',
        'Active/excluded client policy must be explicit before automated workflows select clients.',
      ],
    },
    {
      table: 'articles',
      owner: 'content',
      sensitivity: 'tenant-data',
      status: 'contracted-owner',
      primaryWriters: [
        'backend/routes/articles.ts',
        'backend/routes/complianceWebhooks.ts',
        'backend/routes/embedded.ts',
        'backend/routes/quality.ts',
        'backend/repositories/articleRepo.ts',
        'backend/orchestrators/blogPipeline.ts',
        'backend/engines/publisher/index.ts',
        'backend/services/autoPublishService.ts',
        'backend/services/chatEngine.ts',
        'backend/services/demoProvisioner.ts',
        'backend/services/editorialWorkflow.ts',
        'backend/services/internalLinks.ts',
        'backend/services/multiCmsPublisher.ts',
        'backend/services/shopify/content.ts',
        'backend/workers/index.ts',
        'backend/scripts/repairFlauntShortArticles.ts',
        'backend/scripts/replaceFlauntDrafts.ts',
      ],
      currentRisks: [
        'Article status is changed by routes, workers, pipeline code, and publishing flows.',
        'Published status can be set by multiple worker paths after external CMS calls.',
        'Article state is broad cross-cutting storage touched by routes, repositories, workers, CMS sync, editorial, chat, demo, quality, internal-link, compliance, and repair paths.',
      ],
      requiredInvariants: [
        'Manual approval and hidden-draft behavior must remain intact.',
        'Scheduled articles must not be published before scheduled_at.',
      ],
    },
    {
      table: 'article_images',
      owner: 'content',
      sensitivity: 'tenant-data',
      status: 'contracted-owner',
      primaryWriters: [
        'backend/routes/articles.ts',
        'backend/routes/complianceWebhooks.ts',
        'backend/services/autoPublishService.ts',
        'backend/workers/index.ts',
        'backend/orchestrators/blogPipeline.ts',
      ],
      currentRisks: [
        'Image rows can be inserted by route, worker, pipeline, and scheduled publish paths.',
        'Compliance webhook shop redact can delete image rows outside the content publishing path.',
      ],
      requiredInvariants: [
        'Image rows must remain tenant-scoped by client_id and linked to their article lifecycle.',
        'Generated image prompts and URLs must not leak cross-client content.',
      ],
    },
    {
      table: 'publishing_queue',
      owner: 'workflow',
      sensitivity: 'workflow-state',
      status: 'contracted-owner',
      primaryWriters: ['backend/routes/complianceWebhooks.ts'],
      currentRisks: [
        'Current observed TypeScript runtime mutators delete publishing_queue rows from compliance webhook paths.',
        'SQL queue state is not reconciled with BullMQ job state and should not be inferred from article or worker code without source evidence.',
      ],
      requiredInvariants: [
        'SQL publishing_queue must not be treated as the sole execution source while BullMQ workers remain active.',
        'Failed publish attempts must remain inspectable before retry/auto-resolve behavior changes.',
      ],
    },
    {
      table: 'publishing_history',
      owner: 'content',
      sensitivity: 'tenant-data',
      status: 'contracted-owner',
      primaryWriters: [
        'backend/routes/complianceWebhooks.ts',
        'backend/services/autoPublishService.ts',
        'backend/services/multiCmsPublisher.ts',
        'backend/services/shopify/content.ts',
        'backend/engines/publisher/index.ts',
        'backend/workers/index.ts',
        'backend/scripts/syncRepairedFlauntToShopify.ts',
        'backend/scripts/replaceFlauntDrafts.ts',
        'backend/scripts/moveFlauntDraftsToBeautyTips.ts',
      ],
      currentRisks: [
        'History rows are used as both audit trail and Shopify draft lookup state.',
        'Publishing history can be mutated by multiple CMS publishers, worker flows, compliance deletion, and repair scripts.',
      ],
      requiredInvariants: [
        'Do not remove Shopify draft identifiers without replacing draft lookup behavior.',
        'Published URL and external ID state must remain durable after worker success.',
      ],
    },
    {
      table: 'credential_vault',
      owner: 'credential',
      sensitivity: 'secret-bearing',
      status: 'contracted-owner',
      primaryWriters: [
        'backend/routes/admin.ts',
        'backend/routes/credentialVault.ts',
        'backend/scripts/importAllCredentials.ts',
        'backend/scripts/importCredentials.ts',
        'backend/scripts/vault.ts',
        'backend/scripts/rotateVaultKey.ts',
      ],
      currentRisks: [
        'Vault route decrypts credentials for read responses and can generate new passwords on rotate.',
        'Admin routes can upsert vault rows outside the dedicated credential vault route.',
        'Legacy provider token columns still exist outside the vault.',
        'Import, vault CLI, and rotation scripts can mutate credential_vault outside route-level credential_access_log coverage.',
      ],
      requiredInvariants: [
        'Secret values must remain encrypted at rest and never be generated into docs or logs.',
        'Route-level credential read/write/rotate/delete must remain auditable through credential_access_log.',
        'Scripted credential import/rotation must be treated as a current audit gap until explicit operator audit coverage exists.',
      ],
    },
    {
      table: 'credential_access_log',
      owner: 'audit',
      sensitivity: 'audit-log',
      status: 'contracted-owner',
      primaryWriters: ['backend/routes/credentialVault.ts'],
      currentRisks: ['Credential access logging currently covers dedicated vault route paths but not every script/admin credential mutation path.'],
      requiredInvariants: [
        'Do not remove route-level credential_access_log writes without replacement audit coverage.',
        'Future credential scripts and admin upserts need explicit operator audit events before they are treated as fully audited.',
      ],
    },
    {
      table: 'cms_connections',
      owner: 'integration',
      sensitivity: 'secret-bearing',
      status: 'contracted-owner',
      primaryWriters: [
        'backend/routes/cms.ts',
        'backend/routes/connectors.ts',
        'backend/routes/shopifyInstall.ts',
        'backend/routes/complianceWebhooks.ts',
        'backend/services/multiCmsPublisher.ts',
        'backend/services/shopify/auth.ts',
      ],
      currentRisks: [
        'Provider credentials and client ownership are mixed in integration-specific config.',
        'Shopify install stores accessToken in cms_connections.config JSON in addition to encrypted credential columns.',
        'Shopify install currently logs an access token prefix, so logging must be hardened before claiming full token non-exposure.',
      ],
      requiredInvariants: [
        'Encrypted API key/secret fields must not be downgraded to plaintext.',
        'cms_connections.config must be treated as secret-bearing whenever it contains provider token JSON.',
        'Provider health and primary connection selection must remain tenant-scoped.',
      ],
    },
    {
      table: 'jobs',
      owner: 'workflow',
      sensitivity: 'workflow-state',
      status: 'contracted-owner',
      primaryWriters: [],
      currentRisks: [
        'Observed TypeScript runtime paths read jobs for health, metrics, analytics, and manager views, but no current SQL writer is source-backed in Phase 3 evidence.',
        'SQL jobs table is used for health/metrics but BullMQ is the active execution mechanism.',
      ],
      requiredInvariants: [
        'Manager health must not assume SQL jobs fully represent BullMQ runtime state.',
        'Queue failure counts must remain observable before auto-remediation behavior changes.',
      ],
    },
    {
      table: 'schedules',
      owner: 'workflow',
      sensitivity: 'workflow-state',
      status: 'contracted-owner',
      primaryWriters: ['backend/services/scheduler.ts'],
      currentRisks: [
        'SchedulerService is the observed TypeScript runtime mutator for schedules locking, last run, next run, and status state.',
        'Article routes use articles.scheduled_at; that is related scheduling state but not the schedules table lifecycle.',
        'Schedules and publishing_queue are related but not one audited lifecycle.',
      ],
      requiredInvariants: [
        'Thursday 1 PM Cairo publishing convention must remain intact unless explicitly changed.',
        'Scheduled publish state must be recoverable after worker/API restart.',
      ],
    },
    {
      table: 'schedule_logs',
      owner: 'audit',
      sensitivity: 'audit-log',
      status: 'contracted-owner',
      primaryWriters: ['backend/services/scheduler.ts'],
      currentRisks: ['Schedule execution audit is separate from workflow_logs and activity_logs.'],
      requiredInvariants: ['Do not collapse schedule_logs into workflow_logs without preserving schedule execution history.'],
    },
    {
      table: 'workflow_logs',
      owner: 'audit',
      sensitivity: 'audit-log',
      status: 'contracted-owner',
      primaryWriters: ['backend/orchestrators/blogPipeline.ts', 'backend/routes/enterprisePipeline.ts'],
      currentRisks: ['Workflow logs are not yet the canonical event stream for all automatic effects.'],
      requiredInvariants: ['Do not remove historical workflow logs during workflow lifecycle refactors.'],
    },
    {
      table: 'activity_logs',
      owner: 'audit',
      sensitivity: 'audit-log',
      status: 'contracted-owner',
      primaryWriters: [
        'backend/index.ts',
        'backend/routes/admin.ts',
        'backend/routes/complianceWebhooks.ts',
        'backend/routes/webhooks.ts',
        'backend/services/chatEngine.ts',
        'backend/repositories/logRepo.ts',
        'backend/utils/logger.ts',
        'backend/workers/index.ts',
      ],
      currentRisks: [
        'Activity logs capture mixed user, worker, webhook, chat, repository, logger, and system actions.',
        'Not all activity_logs writes pass through one repository or middleware seam.',
      ],
      requiredInvariants: ['Client-facing and worker side effects must remain auditable.'],
    },
  ],
  workflows: [
    {
      name: 'content-publish',
      currentStores: ['bullmq', 'sql-publishing-queue', 'sql-schedules', 'sql-logs'],
      currentEntrypoints: [
        'backend/routes/articles.ts',
        'backend/routes/complianceWebhooks.ts',
        'backend/routes/embedded.ts',
        'backend/routes/quality.ts',
        'backend/repositories/articleRepo.ts',
        'backend/orchestrators/blogPipeline.ts',
        'backend/engines/publisher/index.ts',
        'backend/services/autoPublishService.ts',
        'backend/services/chatEngine.ts',
        'backend/services/demoProvisioner.ts',
        'backend/services/editorialWorkflow.ts',
        'backend/services/internalLinks.ts',
        'backend/services/multiCmsPublisher.ts',
        'backend/services/scheduler.ts',
        'backend/services/shopify/content.ts',
        'backend/workers/index.ts',
        'backend/scripts/repairFlauntShortArticles.ts',
        'backend/scripts/replaceFlauntDrafts.ts',
      ],
      currentTerminalStates: ['published', 'failed', 'rejected', 'approved', 'archived', 'skipped:not_due'],
      currentRisks: [
        'Worker can create a hidden draft then flip live when no draft history exists.',
        'Publishing history doubles as both audit log and runtime draft lookup.',
        'Scheduled publish can reject undersized articles and clear scheduled_at.',
        'Article lifecycle is broader than publishing and includes approval, editorial, CMS sync, quality, repair, and deletion paths.',
      ],
      requiredInvariants: [
        'Never publish before scheduled_at.',
        'Never bypass manual approval boundaries.',
        'Keep Shopify articles hidden drafts until the approved publish action runs.',
      ],
      nextOwnershipStep: 'Design durable outbox rows for publish_requested, draft_created, publish_succeeded, and publish_failed before moving worker writes.',
    },
    {
      name: 'credential-access',
      currentStores: ['sql-logs'],
      currentEntrypoints: [
        'backend/routes/admin.ts',
        'backend/routes/credentialVault.ts',
        'backend/scripts/importAllCredentials.ts',
        'backend/scripts/importCredentials.ts',
        'backend/scripts/vault.ts',
        'backend/scripts/rotateVaultKey.ts',
      ],
      currentTerminalStates: ['view', 'create', 'update', 'delete', 'rotate', 'export', 'import', 'admin-upsert', 'script-import', 'script-delete', 'script-rotate'],
      currentRisks: [
        'Route-level read can decrypt secrets and rotate can return generated passwords.',
        'Admin upsert, credential import, vault CLI, and rotation scripts currently mutate vault state outside route-level access logging.',
      ],
      requiredInvariants: [
        'Route-level secret access remains logged.',
        'Scripted import/rotation remains a documented audit gap until explicit operator audit coverage is added.',
        'No secret value is included in generated docs or architecture contracts.',
      ],
      nextOwnershipStep: 'Separate vault command/query ownership before migrating legacy provider tokens.',
    },
    {
      name: 'client-lifecycle',
      currentStores: ['sql-jobs', 'sql-logs'],
      currentEntrypoints: [
        'backend/routes/billing.ts',
        'backend/routes/clients.ts',
        'backend/routes/complianceWebhooks.ts',
        'backend/routes/shopifyInstall.ts',
        'backend/repositories/clientRepo.ts',
        'backend/services/chatEngine.ts',
        'backend/services/demoProvisioner.ts',
        'backend/services/globalMemory.ts',
        'backend/services/selfImprovementService.ts',
        'backend/services/shopify/auth.ts',
        'backend/workers/index.ts',
      ],
      currentTerminalStates: ['created', 'updated', 'hard_deleted', 'active', 'inactive', 'billing_active', 'billing_cancelled', 'demo_disabled', 'token_refreshed'],
      currentRisks: ['Client deletion is a hard cascade and can remove articles, schedules, jobs, credentials, and history via FK behavior.'],
      requiredInvariants: [
        'Do not automate deletion or exclusion decisions without explicit approval.',
        'Active/excluded reporting clients must remain explicit.',
      ],
      nextOwnershipStep: 'Add client lifecycle command contract and deletion policy before moving route SQL.',
    },
  ],
  safetyRules: CONTRACT_SAFETY_RULES,
};

export class StorageWorkflowManager {
  readonly contract = STORAGE_WORKFLOW_CONTRACT;

  listTables(): readonly StorageTableContract[] {
    return this.contract.tables;
  }

  listWorkflows(): readonly WorkflowLifecycleContract[] {
    return this.contract.workflows;
  }

  getTable(table: string): StorageTableContract {
    const match = this.contract.tables.find((entry) => entry.table === table);
    if (!match) throw new Error(`Unknown storage table contract: ${table}`);
    return match;
  }
}
