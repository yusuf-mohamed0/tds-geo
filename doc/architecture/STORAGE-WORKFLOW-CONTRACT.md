# Storage Workflow Contract

Phase 3 defines ownership for the highest-risk storage and workflow state without moving data, changing route behavior, or changing worker execution.

Source of truth: `backend/orchestrators/StorageWorkflowContract.ts`.

The TypeScript contract is side-effect-free on direct import: it has no logger, database, Redis, BullMQ, environment, filesystem, or runtime orchestrator imports, and it exports no singleton instance.

## Contract Scope

| Area | Current State | Phase 3 Contract |
| --- | --- | --- |
| Client storage | `clients` includes legacy Shopify token fields and is written by client routes, Shopify install, and workers. | Client Manager owns lifecycle; token-bearing fields are marked secret-bearing and cannot be exposed in docs/logs/responses. |
| Content storage | `articles`, `article_images`, and `publishing_history` are mutated by routes, pipelines, scheduled publish, compliance webhooks, and workers. | Content Manager owns article state; hidden draft, manual approval, and scheduled publish invariants remain mandatory. |
| Credential storage | `credential_vault` and `credential_access_log` are route-owned today, while admin routes and import/vault/rotation scripts also mutate vault rows. | Credential owner must preserve encryption-at-rest; route-level access remains logged, and admin/scripted mutation is documented as an audit gap before any legacy token migration. |
| Integration storage | `cms_connections`, `gsc_auth`, `shopify_sessions`, and provider rows mix config and secrets. `cms_connections.config` can contain Shopify `accessToken` JSON. | Integration Manager owns provider setup and rotation policy, but Phase 3 does not migrate tokens and treats config JSON as secret-bearing where tokens are present. |
| Workflow state | BullMQ queues, `jobs`, `publishing_queue`, `schedules`, `schedule_logs`, `workflow_logs`, and `activity_logs` are not one lifecycle. | Workflow owner must treat these as separate current stores until a durable outbox is designed. |

Phase 3 TypeScript table contracts model the highest-risk tables selected for this pass. Adjacent integration stores named above, including `gsc_auth`, `shopify_sessions`, and provider-specific rows, remain explicitly out of scope until a later integration credential inventory pass.

## Current Direct SQL Evidence

Direct `pool.query`/`client.query` calls remain in routes, services, and workers. Phase 3 does not remove them yet.

High-risk examples:

- `backend/routes/clients.ts` writes `clients`, performs hard delete, and counts cascade-owned related tables.
- `clients` is also mutated by billing, compliance, demo provisioning, chat actions, repository helpers, global memory, self-improvement, Shopify auth token refresh, Shopify install, route, and worker paths.
- `backend/routes/credentialVault.ts` reads, decrypts, rotates, imports, exports, and logs vault access.
- `backend/workers/index.ts` reads `clients`/`articles`, updates `articles`, writes `publishing_history`, and inserts `article_images` during publish/image workflows.
- `articles` is also mutated by embedded and quality routes, repositories, publisher engine, scheduled publish, chat actions, demo provisioning, editorial workflow, internal-link caching, multi-CMS sync, Shopify content publishing, compliance deletion, and repair scripts.
- `backend/routes/shopifyInstall.ts` writes `clients` and `cms_connections` during Shopify OAuth/install flows.
- `backend/routes/connectors.ts`, `backend/services/shopify/auth.ts`, `backend/services/multiCmsPublisher.ts`, and `backend/routes/complianceWebhooks.ts` also mutate `cms_connections`.
- `backend/services/scheduler.ts` is the observed TypeScript runtime mutator for `schedules` and `schedule_logs`.
- `backend/routes/complianceWebhooks.ts` deletes `publishing_queue` and `article_images` during uninstall/redact flows.
- `backend/services/shopify/content.ts`, `backend/services/multiCmsPublisher.ts`, `backend/engines/publisher/index.ts`, `backend/services/autoPublishService.ts`, `backend/workers/index.ts`, compliance webhooks, and publishing-history repair scripts mutate `publishing_history`.
- `backend/index.ts`, admin/webhook/compliance routes, `chatEngine`, `logRepo`, `utils/logger`, and workers write `activity_logs`.
- `backend/services/autoPublishService.ts` can set an article to `rejected` and clear `scheduled_at` when scheduled content fails minimum length checks.
- `backend/routes/admin.ts`, `backend/scripts/importAllCredentials.ts`, `backend/scripts/importCredentials.ts`, `backend/scripts/vault.ts`, and `backend/scripts/rotateVaultKey.ts` mutate `credential_vault` outside dedicated route-level `credential_access_log` coverage.

Observed gaps called out by the contract:

- `jobs` has current TypeScript readers for health, analytics, metrics, and manager views, but Phase 3 evidence does not identify a source-backed SQL writer.
- `publishing_queue` current observed TypeScript runtime mutators are compliance webhook deletes, not the article route or BullMQ worker execution path.
- Shopify install currently logs an access-token prefix and writes token JSON into `cms_connections.config`; hardening those behaviors belongs to a later runtime phase, not this contract-only phase.
- `activity_logs` and `publishing_history` are broad cross-cutting tables today; repository extraction must start by preserving all observed writers, not by assuming a single existing owner.

## Required Invariants

- Do not move or migrate secret values without a separate migration plan and rollback evidence.
- Do not change route behavior, response shapes, auth behavior, or worker execution from this contract.
- Do not change Shopify publishing semantics: hidden drafts, manual approval, and scheduled publish controls remain intact.
- Do not treat BullMQ and SQL workflow tables as one canonical lifecycle until a durable outbox is implemented.
- Do not add client-facing ads delivery, emails, or live publish automation from this contract.
- Do not claim route-only credential audit coverage for admin/script-driven import/rotation until explicit operator audit coverage exists.

## Next Runtime Step

The next implementation phase should add repository/service seams for one narrow owner at a time. Recommended first seam: client read/write ownership that preserves current route responses and explicitly excludes token exposure.
