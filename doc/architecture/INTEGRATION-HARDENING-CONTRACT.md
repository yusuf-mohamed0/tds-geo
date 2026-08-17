# Integration Hardening Contract

Phase 7 defines ownership and safety boundaries for the highest-risk external integration, credential, artifact, and observability surfaces without changing provider behavior, secret storage, publishing semantics, or report delivery.

Source of truth: `backend/orchestrators/IntegrationHardeningContract.ts`.

The TypeScript contract is side-effect-free on direct import: it has no logger, database, Redis, BullMQ, environment, filesystem, provider SDK, or runtime orchestrator imports, and it exports no singleton instance.

## Contract Scope

| Surface | Manager | Current State | Phase 7 Contract |
| --- | --- | --- | --- |
| Shopify | Integration Manager | `shopifyInstall` OAuth writes tokens into `clients` and `cms_connections.config`; `refreshIfExpired` refreshes legacy token columns; live publish only via explicit `publish:true`, approved/scheduled rows, or `/publish-all` over `approved`. | Hidden draft, manual approval, and scheduled publish semantics remain intact; raw token JSON in `cms_connections.config` and legacy `clients.shopify_token` columns are marked secret-bearing with rotation as the next hardening step. |
| Ads reporting | Ads Manager | Admin-only route wrapping an external Python reporting runner; PDFs listed from `reports/`; internal until CEO/final approval; no report email sent. | Remains internal-only with no client-facing delivery or email; artifact approval/delivery registry is the next hardening step. |
| Google Search Console | Integration Manager | OAuth tokens stored in `gsc_auth` and cached in memory; readonly Google API scope; route-level client/admin access checks. | Token values marked secret-bearing with centralized rotation as the next hardening step. |
| Nextcloud / backups | Storage Manager | `sync-nextcloud-safe.sh` stages docs/outputs/reports and deletes `.env`, `*.pem`, `*.key`, `*token*`, `clients.yaml`, vault paths, and credential-bearing client doc files (`doc/clients/*/technical-reference.md`, `contacts.md`, `full-profile.md`, `brand-profile.md`) before WebDAV upload; `backup-db.sh` runs `pg_dump` and optional S3 upload. Sync mechanics verified end-to-end 2026-08-17 against the live instance (PROPFIND 207, MKCOL 201, `sync_ok`); a follow-up run confirmed 25 credential-bearing client doc files were stripped and none appear in the uploaded archive. | Artifact boundary now enforced by the exclusion list; next hardening step is moving scripts to a Nextcloud app password. |
| Credential vault | Credential Owner | AES-256-GCM encrypted rows via `CREDENTIAL_VAULT_KEY`/`ENCRYPTION_KEY`; vault GET and rotate return plaintext; admin routes and import/vault/rotation scripts mutate rows outside dedicated access-log coverage; `connectors` stores raw `apiKey`/`accessToken`. | Encrypted-at-rest invariant and route-level access audit stay mandatory; scripted/admin credential mutation remains a documented audit gap. |
| Webhooks / compliance | Integration Manager | Shopify webhook/OAuth HMAC via `SHOPIFY_API_SECRET`; compliance GDPR/uninstall flows; inbound event JSON stored in `activity_logs.metadata`. | HMAC verification stays mandatory; full event JSON storage is flagged for redaction in the next hardening step. |
| Observability / health | System / Operations Manager | Public `/health` checks DB/Redis/OpenAI/Ollama/sidecars/GSC config without token values; `/metrics` emits Prometheus text; deeper routes admin-only; activity middleware strips query strings. | Public health/metrics must never expose secret values; unauthenticated status must not be documented as role-enforced. |

## Required Invariants

- Do not move, migrate, rotate, or decrypt secret values without a separate migration plan and rollback evidence.
- Do not make provider calls, enqueue jobs, send webhooks, publish content, or generate reports from this contract.
- Do not change Shopify publishing semantics: hidden drafts, manual approval, and scheduled publish controls remain intact.
- Do not add client-facing ads delivery, emails, or live publish automation from this contract.
- Do not include env files, keys, tokens, `clients.yaml`, or credential vault material in Nextcloud sync artifacts.
- Do not expose secret values through `/health`, `/metrics`, route responses, logs, generated docs, or reports.
- Backend authorization remains authoritative for every integration route; hiding links is not a security boundary.

## Next Runtime Step

The next implementation phase should add the artifact approval/delivery registry for ads reporting and move Shopify/connector token storage behind a rotation policy with explicit audit coverage, each as its own reviewed and deployed phase. Until then, all integration surfaces stay on their current behaviors.