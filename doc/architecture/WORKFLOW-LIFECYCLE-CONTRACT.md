# Workflow Lifecycle Contract

Phase 4 defines the workflow lifecycle and durable outbox boundary without changing runtime behavior, queue behavior, workers, SQL schema, or route responses.

Source of truth: `backend/orchestrators/WorkflowLifecycleContract.ts`.

The TypeScript contract is side-effect-free on direct import: it has no logger, database, Redis, BullMQ, environment, filesystem, worker, or runtime orchestrator imports, and it exports no singleton instance.

## Current State

| Area | Current State | Phase 4 Contract |
| --- | --- | --- |
| BullMQ | `backend/utils/queue.ts` owns active queue creation, job add/status, worker creation, retry/backoff, and dead-letter forwarding. | BullMQ remains active execution, but not durable business event truth. |
| Queue definitions | `backend/queues/definitions.ts` maps job types/configs to queue names but imports runtime queue names from `utils/queue.ts`. | Contracts must use string literals and avoid importing runtime queue modules. |
| Workers | `backend/workers/index.ts` initializes services, registers workers, and starts processing on import/start. | Worker registration remains runtime-only; contracts cannot import or trigger it. |
| SQL workflow state | `jobs`, `publishing_queue`, `schedules`, `workflow_logs`, `schedule_logs`, and `activity_logs` each capture partial state/history. | These stores are not one lifecycle until a durable outbox exists. |
| Producers | Pipeline service, chat engine, department managers, workers, and blog pipeline enqueue jobs from different boundaries. | Producers must preserve auth/client/approval/manual-publish invariants until workflow ownership is centralized. |
| Direct side effects | `blogPipeline.ts` can directly publish through `multiCmsPublisher.publish(...)` and triggers `article.completed` webhook notification after pipeline work. | Existing non-outboxed publish/webhook side effects must not be centralized, broadened, or replayed until durable idempotency exists. |
| Defined-but-unregistered queues | `default`, `cost-optimization`, `observability`, `odoo-sync`, `odoo-batch-sync`, and `odoo-webhook` are defined/routable but not registered by the current worker bootstrap. | Defined/routable queues must not be treated as actively processed until a worker registration path exists. |

## Evidence

- `backend/utils/queue.ts` creates Redis/BullMQ queues lazily and applies attempts/backoff/removal/dead-letter behavior.
- `backend/queues/definitions.ts` defines job type mappings and queue configs for core, enterprise, client scan, and Odoo queues.
- `backend/workers/index.ts` registers core and enterprise workers and starts processing as runtime code.
- `backend/services/pipelineService.ts` queues content generation only when `REDIS_URL` is present and `options.queue === true`; otherwise it runs direct generation.
- `backend/services/chatEngine.ts` enqueues selected chat commands but also performs direct SQL approval, rejection, create, and delete actions.
- `backend/orchestrators/managers/DepartmentManager.ts` queues subtasks when a decomposed subtask has a queue name; otherwise it runs inline.
- `backend/orchestrators/blogPipeline.ts` contains a helper for delayed `scheduled-generation` jobs when client publish frequency is not manual, but that helper is not currently observed as invoked; the pipeline can directly publish when requested and auto-approved, and triggers `article.completed` webhook notifications.
- `backend/utils/queue.ts`, `backend/queues/definitions.ts`, `backend/orchestrators/CeoRoutingTable.ts`, and `backend/orchestrators/managers/types.ts` define/routable queues that are not registered by `backend/workers/index.ts`.
- `backend/repositories/logRepo.ts` writes `workflow_logs`, while scheduler, activity, publishing history, and BullMQ states remain separate.

## Durable Outbox Boundary

The outbox is intentionally `not-implemented` in Phase 4. It is required before:

- Managers broaden or centralize cross-system automatic effects.
- BullMQ and SQL stores are presented as one canonical lifecycle.
- Failed jobs or publish attempts are replayed across process boundaries.
- Existing workflow-completion publish, webhook, notification, report, email, or delivery side effects are centralized or replayed.

Candidate durable events include `workflow_requested`, `workflow_started`, `workflow_step_completed`, `workflow_step_failed`, `job_enqueued`, `job_completed`, `job_failed`, `job_dead_lettered`, `publish_requested`, `draft_created`, `publish_succeeded`, `publish_failed`, `schedule_due`, `schedule_completed`, and `schedule_failed`.

## Required Invariants

- Do not initialize Redis, BullMQ, database, logger, workers, or schedulers from this contract.
- Do not change existing queue attempts, backoff, dead-letter, `removeOnComplete`, or `removeOnFail` behavior.
- Do not enqueue jobs, retry jobs, publish content, send webhooks, or run scheduled work from this contract.
- Do not add an outbox table or migration until idempotency keys, replay behavior, rollback, and tenant scoping are reviewed separately.
- Do not include secret values in workflow events; reference credential identifiers or safe metadata only.
- Do not assume defined/routable queues are executable unless they are registered by the worker bootstrap.
- Do not replay existing direct publishing or webhook side effects from workflow completion without durable idempotency keys.

## Next Runtime Step

The next implementation phase should introduce a narrow outbox schema and dual-write one low-risk event family first, preferably `job_enqueued`/`job_failed` or `workflow_started`/`workflow_step_failed`, without changing existing BullMQ execution.
