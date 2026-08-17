// <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
// (c) 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

export type WorkflowStoreKind = 'bullmq' | 'sql-state' | 'sql-audit' | 'runtime-log';

export type WorkflowReliabilityLevel =
  | 'runtime-queue'
  | 'history-only'
  | 'derived-metrics'
  | 'contract-required';

export interface WorkflowStoreContract {
  readonly name: string;
  readonly kind: WorkflowStoreKind;
  readonly reliability: WorkflowReliabilityLevel;
  readonly sourceFiles: readonly string[];
  readonly currentRole: string;
  readonly currentLimits: readonly string[];
  readonly requiredInvariants: readonly string[];
}

export interface WorkflowProducerContract {
  readonly source: string;
  readonly queues: readonly string[];
  readonly currentBehavior: string;
  readonly requiredInvariants: readonly string[];
}

export interface WorkflowWorkerContract {
  readonly source: string;
  readonly queues: readonly string[];
  readonly currentBehavior: string;
  readonly requiredInvariants: readonly string[];
}

export interface WorkflowSideEffectContract {
  readonly source: string;
  readonly effects: readonly string[];
  readonly currentBehavior: string;
  readonly requiredInvariants: readonly string[];
}

export interface DurableOutboxContract {
  readonly status: 'not-implemented';
  readonly requiredBefore: readonly string[];
  readonly eventNames: readonly string[];
  readonly eventInvariants: readonly string[];
  readonly migrationRules: readonly string[];
}

export interface WorkflowLifecycleArchitectureContract {
  readonly runtimeWiring: 'not-wired';
  readonly sourceOfTruth: readonly string[];
  readonly stores: readonly WorkflowStoreContract[];
  readonly producers: readonly WorkflowProducerContract[];
  readonly workers: readonly WorkflowWorkerContract[];
  readonly directSideEffects: readonly WorkflowSideEffectContract[];
  readonly outbox: DurableOutboxContract;
  readonly safetyRules: readonly string[];
}

const WORKFLOW_SAFETY_RULES = [
  'Do not initialize Redis, BullMQ, database, logger, workers, or schedulers from this contract.',
  'Do not treat SQL jobs, publishing_queue, schedules, workflow_logs, schedule_logs, and activity_logs as one canonical lifecycle yet.',
  'Do not enqueue jobs, retry jobs, publish content, send webhooks, or run scheduled work from this contract.',
  'Do not change existing BullMQ attempts, backoff, dead-letter, removeOnComplete, or removeOnFail behavior in Phase 4 contract work.',
  'Do not add a durable outbox table or migration until event names, idempotency keys, and replay/rollback behavior are reviewed separately.',
] as const;

export const WORKFLOW_LIFECYCLE_CONTRACT: WorkflowLifecycleArchitectureContract = {
  runtimeWiring: 'not-wired',
  sourceOfTruth: [
    'doc/architecture/JOB-WORKFLOW-MATRIX.md',
    'backend/utils/queue.ts',
    'backend/queues/definitions.ts',
    'backend/workers/index.ts',
    'backend/services/pipelineService.ts',
    'backend/services/chatEngine.ts',
    'backend/services/scheduler.ts',
    'backend/repositories/logRepo.ts',
    'backend/orchestrators/blogPipeline.ts',
    'backend/orchestrators/managers/DepartmentManager.ts',
    'backend/orchestrators/CeoRoutingTable.ts',
    'backend/services/circuitBreaker.ts',
    'backend/services/observability.ts',
    'backend/services/selfImprovementService.ts',
  ],
  stores: [
    {
      name: 'bullmq',
      kind: 'bullmq',
      reliability: 'runtime-queue',
      sourceFiles: ['backend/utils/queue.ts', 'backend/queues/definitions.ts', 'backend/workers/index.ts'],
      currentRole: 'Active distributed execution mechanism backed by Redis when REDIS_URL is configured.',
      currentLimits: [
        'Queue creation and worker creation have runtime side effects and must not be imported by architecture contracts.',
        'Completed jobs can be removed after 7 days or 1000 completions; failed jobs can be removed after 30 days.',
        'BullMQ state is not mirrored into SQL jobs by the current addJob path.',
      ],
      requiredInvariants: [
        'Preserve queue attempts/backoff/dead-letter behavior until durable outbox replay semantics exist.',
        'Do not use BullMQ job IDs as the only durable business event identifiers.',
      ],
    },
    {
      name: 'jobs',
      kind: 'sql-state',
      reliability: 'derived-metrics',
      sourceFiles: [
        'backend/orchestrators/managers/DepartmentManager.ts',
        'backend/services/circuitBreaker.ts',
        'backend/services/observability.ts',
        'backend/services/selfImprovementService.ts',
        'backend/routes/analytics.ts',
      ],
      currentRole: 'SQL health, analytics, and manager metric source rather than the active BullMQ execution log.',
      currentLimits: ['Phase 3 evidence did not identify a current TypeScript SQL writer for jobs.'],
      requiredInvariants: ['Manager health must not assume jobs rows fully represent BullMQ runtime state.'],
    },
    {
      name: 'publishing_queue',
      kind: 'sql-state',
      reliability: 'history-only',
      sourceFiles: ['backend/routes/complianceWebhooks.ts'],
      currentRole: 'Legacy publishing queue table currently observed as compliance cleanup state.',
      currentLimits: ['Observed TypeScript runtime mutators delete rows; BullMQ workers do not use this as their execution source.'],
      requiredInvariants: ['Do not migrate publish execution onto this table without idempotent request and retry semantics.'],
    },
    {
      name: 'schedules',
      kind: 'sql-state',
      reliability: 'runtime-queue',
      sourceFiles: ['backend/services/scheduler.ts'],
      currentRole: 'In-process scheduler state for due schedule selection, locking, next run calculation, and status updates.',
      currentLimits: ['SchedulerService is process-local and separate from BullMQ and article scheduled_at publishing state.'],
      requiredInvariants: ['Scheduled work must remain recoverable after API/worker restart before automation is broadened.'],
    },
    {
      name: 'workflow_logs',
      kind: 'sql-audit',
      reliability: 'history-only',
      sourceFiles: ['backend/repositories/logRepo.ts', 'backend/orchestrators/blogPipeline.ts', 'backend/routes/enterprisePipeline.ts'],
      currentRole: 'Workflow history/audit rows for selected pipeline and enterprise route stages.',
      currentLimits: ['Not every queued job, worker transition, schedule tick, or publishing effect writes workflow_logs.'],
      requiredInvariants: ['Do not represent workflow_logs as a complete event stream until every effect boundary writes durable events.'],
    },
    {
      name: 'schedule_logs',
      kind: 'sql-audit',
      reliability: 'history-only',
      sourceFiles: ['backend/services/scheduler.ts'],
      currentRole: 'Schedule execution audit separate from workflow_logs and activity_logs.',
      currentLimits: ['Schedule logs do not represent BullMQ worker completion or publishing history completion.'],
      requiredInvariants: ['Preserve schedule execution history when designing outbox migration.'],
    },
    {
      name: 'activity_logs',
      kind: 'sql-audit',
      reliability: 'history-only',
      sourceFiles: [
        'backend/utils/logger.ts',
        'backend/workers/index.ts',
        'backend/index.ts',
        'backend/services/chatEngine.ts',
        'backend/repositories/logRepo.ts',
        'backend/routes/admin.ts',
        'backend/routes/webhooks.ts',
        'backend/routes/complianceWebhooks.ts',
      ],
      currentRole: 'Mixed audit surface for user, worker, webhook, dead-letter, logger, and system actions.',
      currentLimits: ['Activity logs are not typed workflow events and are not suitable as replay input.'],
      requiredInvariants: ['Do not remove activity logging from side-effecting paths before replacement audit coverage exists.'],
    },
  ],
  producers: [
    {
      source: 'backend/services/pipelineService.ts',
      queues: ['content-generation'],
      currentBehavior: 'Enqueues content generation only when REDIS_URL exists and options.queue is true; otherwise runs direct provider call.',
      requiredInvariants: ['Do not remove the direct fallback without separate production readiness evidence.'],
    },
    {
      source: 'backend/services/chatEngine.ts',
      queues: ['content-generation', 'shopify-publish', 'keyword-research', 'seo-analysis', 'default'],
      currentBehavior: 'Queues selected permission-checked chat commands and also performs some direct SQL actions.',
      requiredInvariants: ['Do not bypass approval, role, or client scoping checks when moving chat commands behind workflow ownership.'],
    },
    {
      source: 'backend/orchestrators/managers/DepartmentManager.ts',
      queues: [
        'manager-subtask queueName values from decomposed subtasks',
        'default',
        'cost-optimization',
        'observability',
        'odoo-sync',
        'odoo-batch-sync',
        'odoo-webhook',
      ],
      currentBehavior: 'Dispatches manager subtasks to BullMQ when a subtask has queueName; otherwise runs inline.',
      requiredInvariants: [
        'Do not treat manager-subtask dispatch as durable orchestration until task decomposition and completion events are persisted.',
        'Defined/routable queues without current worker registration must not be assumed executable by the worker bootstrap.',
      ],
    },
    {
      source: 'backend/workers/index.ts',
      queues: ['multi-cms-publish'],
      currentBehavior: 'Editorial approval worker can enqueue a follow-up multi-CMS publish job.',
      requiredInvariants: ['Follow-up publish requests need idempotency before retry/replay behavior is broadened.'],
    },
    {
      source: 'backend/orchestrators/blogPipeline.ts',
      queues: ['content-generation'],
      currentBehavior: 'Contains a helper that can queue delayed scheduled-generation work when publish frequency is not manual, but that helper is not currently observed as invoked in the pipeline.',
      requiredInvariants: [
        'Automatic next-content scheduling must preserve manual publish policy and client settings.',
        'Pipeline direct publish and webhook side effects remain current non-outboxed behavior and must not be replayed automatically.',
      ],
    },
  ],
  workers: [
    {
      source: 'backend/workers/index.ts',
      queues: [
        'content-generation',
        'keyword-research',
        'shopify-publish',
        'image-generation',
        'seo-analysis',
        'internal-linking',
        'webhook-delivery',
        'dead-letter',
        'client-scan',
        'batch-client-scan',
        'fact-check',
        'brand-voice',
        'seo-intelligence',
        'multi-cms-publish',
        'pexels-image',
        'editorial-workflow',
        'content-intelligence',
        'ai-evaluation',
      ],
      currentBehavior: 'Registers core and enterprise BullMQ workers with process startup side effects.',
      requiredInvariants: [
        'Do not import worker registration from contracts or HTTP boot code without explicit runtime design.',
        'Dead-letter handling must remain inspectable before automatic replay behavior is added.',
      ],
    },
    {
      source: 'backend/queues/definitions.ts + backend/orchestrators/CeoRoutingTable.ts + backend/orchestrators/managers/types.ts',
      queues: ['default', 'cost-optimization', 'observability', 'odoo-sync', 'odoo-batch-sync', 'odoo-webhook'],
      currentBehavior: 'Queues are defined and routable through configuration but are not registered by the current backend/workers/index.ts bootstrap.',
      requiredInvariants: [
        'Defined/routable must not be represented as actively processed unless a worker registration path exists.',
        'Manager routing must surface unregistered queues before automatic cross-system orchestration depends on them.',
      ],
    },
  ],
  directSideEffects: [
    {
      source: 'backend/orchestrators/blogPipeline.ts',
      effects: ['multiCmsPublisher.publish', 'article.completed webhook'],
      currentBehavior: 'Pipeline can directly publish through multiCmsPublisher when publish is requested, approval mode is auto, and no human review is required; it also triggers article.completed webhook notification after pipeline work.',
      requiredInvariants: [
        'Do not centralize, broaden, or replay pipeline publish/webhook side effects until durable outbox idempotency exists.',
        'Manual approval and human-review requirements must remain hard boundaries around direct publishing behavior.',
      ],
    },
  ],
  outbox: {
    status: 'not-implemented',
    requiredBefore: [
      'Managers broaden or centralize cross-system automatic effects.',
      'BullMQ and SQL workflow stores are presented as one canonical lifecycle.',
      'Failed jobs or publish attempts are auto-replayed across process boundaries.',
      'Existing workflow-completion publish, webhook, notification, or delivery side effects are centralized or replayed.',
    ],
    eventNames: [
      'workflow_requested',
      'workflow_started',
      'workflow_step_completed',
      'workflow_step_failed',
      'job_enqueued',
      'job_completed',
      'job_failed',
      'job_dead_lettered',
      'publish_requested',
      'draft_created',
      'publish_succeeded',
      'publish_failed',
      'schedule_due',
      'schedule_completed',
      'schedule_failed',
    ],
    eventInvariants: [
      'Every outbox event needs a stable idempotency key before replay exists.',
      'Events must include tenant/client scope where applicable.',
      'Events must avoid secret values and only reference credential identifiers or safe metadata.',
      'External side effects must be distinguishable from internal state transitions.',
    ],
    migrationRules: [
      'Introduce outbox schema in a separate migration with rollback plan.',
      'Dual-write selected low-risk workflow events before moving execution ownership.',
      'Do not delete existing workflow_logs, activity_logs, schedule_logs, publishing_history, or BullMQ retention until consumers are migrated.',
    ],
  },
  safetyRules: WORKFLOW_SAFETY_RULES,
};

export class WorkflowLifecycleManager {
  readonly contract = WORKFLOW_LIFECYCLE_CONTRACT;

  listStores(): readonly WorkflowStoreContract[] {
    return this.contract.stores;
  }

  listProducers(): readonly WorkflowProducerContract[] {
    return this.contract.producers;
  }

  listWorkers(): readonly WorkflowWorkerContract[] {
    return this.contract.workers;
  }

  listDirectSideEffects(): readonly WorkflowSideEffectContract[] {
    return this.contract.directSideEffects;
  }

  getStore(name: string): WorkflowStoreContract {
    const match = this.contract.stores.find((entry) => entry.name === name);
    if (!match) throw new Error(`Unknown workflow store contract: ${name}`);
    return match;
  }
}
