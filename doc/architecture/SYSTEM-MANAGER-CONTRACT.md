# System Manager Contract

Phase 2 introduces a typed System Manager boundary without wiring it into runtime bootstrap, routes, workers, or publishing behavior.

Source of truth: `backend/orchestrators/SystemManager.ts`.

The TypeScript contract is side-effect-free on direct import from `backend/orchestrators/SystemManager.ts`: it uses type-only imports, does not import queue/logger modules, and exports no singleton instance.

Do not import the Phase 2 contract through `backend/orchestrators/index.ts`; that existing barrel exports runtime orchestrator singletons and is not side-effect-free.

## Current Contract

| Domain | Manager | Status | Primary Runtime Sources | Phase 2 Constraint |
| --- | --- | --- | --- | --- |
| system | System Manager | contracted | `backend/index.ts`, `backend/orchestrators/CeoOrchestrator.ts`, `/health`, `/metrics` | Defines ownership target only; does not replace bootstrap or health handlers. |
| client | Client Manager | inventory | `/api/clients`, `/api/demo`, `/api/scraper`, `clients` table | Client lifecycle remains in existing routes/services. |
| access | Role/Access Manager | inventory | `backend/middleware/auth.ts`, `/api/auth`, `/api/security`, `/api/devices` | RBAC behavior is unchanged; connector remains synthetic API-key auth. |
| storage | Storage Manager | inventory | `doc/architecture/STORAGE-OWNERSHIP.md`, vault routes, Nextcloud sync script | Direct SQL calls remain in existing code until storage refactor. |
| content | Content Manager | inventory | `/api/articles`, `/api/editorial`, `/api/quality`, Shopify publishing services | Draft/manual approval and hidden Shopify draft behavior must remain intact. |
| ads | Ads Manager | inventory | `/api/ads-reports`, `backend/services/adsReporting.ts` | Internal-only; no client-facing delivery automation. |
| integration | Integration Manager | inventory | Shopify, CMS, GSC, Odoo, webhooks, credential matrix | Provider setup and token rotation are not centralized yet. |
| automation | Automation Manager | inventory | `backend/utils/queue.ts`, SQL workflow tables | BullMQ and SQL state are not yet one canonical lifecycle. |
| intelligence | Intelligence Manager | inventory | knowledge bases, content intelligence, graphify artifacts | Graphify remains separate from runtime intelligence ownership. |
| operations | Operations Manager | contracted | `doc/PRODUCTION-CONTRACT.md`, TrueNAS deploy, smoke tests | TrueNAS deploy/smoke remains the release gate. |

## Runtime Rule

`SystemManager` is intentionally not initialized from `backend/index.ts` in Phase 2. It is a typed contract and inspection boundary only.

The contract includes machine-readable `safetyRules` for every domain. Future code that consumes `SYSTEM_ARCHITECTURE_CONTRACT` must preserve those rules unless a later phase explicitly changes them with review and deploy evidence.

## Verification Rule

Every future manager refactor must preserve the production contract:

- `/health` remains public and healthy after deploy.
- Protected APIs continue returning `401` without auth.
- No automated client-facing publish, ads delivery, or email is added without an explicit approval boundary.
- Secret values remain in environment/secret stores or the credential vault, never in docs/source.

## Next Phase Use

Use this contract to decide where new ownership should land before changing runtime behavior. Phase 3 should focus on storage ownership and durable workflow/outbox design, not broad route rewrites.
