# Production Contract

This document is the current production truth baseline for Kivo rebuild work. It must stay aligned with deploy scripts, smoke tests, and architecture changes.

## Canonical Production Path

- Production URL: `https://ai.trafficdigitalsolutions.com`
- Canonical production deploy workflow: `.github/workflows/deploy-truenas.yml`
- Canonical production runtime: `deploy/truenas/compose.yml`
- Canonical production deploy script: `deploy/truenas/scripts/deploy.sh`
- Canonical production health script: `deploy/truenas/scripts/healthcheck.sh`
- TrueNAS runner labels: `self-hosted`, `Linux`, `X64`, `truenas`, `tdsgeo`

Legacy deploy workflows can still build images or remain available for manual recovery, but they are not the canonical production path during the architecture rebuild.

## Production Verification Contract

Public checks that should pass without authentication:

- `GET /health` returns HTTP `200` and JSON status such as `healthy`.
- `GET /` returns HTTP `200` for the frontend shell.

Protected checks that should fail without authentication:

- `GET /api/clients` returns HTTP `401` without a token.
- `GET /api/articles` returns HTTP `401` without a token.
- `GET /api/ads-reports/status` returns HTTP `401` without a token.

Authenticated smoke checks require `SMOKE_TEST_TOKEN` or a workflow-specific smoke token secret. Do not hard-code tokens in source, scripts, or workflow files.

Local container checks are not equivalent to remote production checks. `scripts/smoke-test.sh` only runs Docker/PostgreSQL/Redis checks when `SMOKE_TEST_DOCKER=true` is explicitly set.

## TrueNAS Runtime Boundaries

- PostgreSQL and Redis must remain internal to the TrueNAS Compose network.
- Caddy and optional Cloudflared are the production ingress layer.
- Production secrets must come from the TrueNAS deploy environment, not from committed files.
- Pre-deploy database backup is required unless explicitly disabled for a controlled non-production test.

## Rebuild Safety Rules

- Do not route new automatic client-facing actions around approval gates.
- Do not create live client emails, live publishing, or client-visible ad report delivery without explicit approval logic and audit trail.
- Do not make the CEO/Department manager layer the durable orchestration backbone until workflow state is persisted and reconcilable.
- Do not introduce new direct database access in domains once a repository/storage owner exists for that domain.
- Do not sync secrets, raw env files, credential vault exports, private keys, or token material to Nextcloud.

## Current Blockers

- Full authenticated production UI verification requires a valid production admin token/session or temporary admin account.
- Direct TrueNAS host security checks require runner/SSH access or evidence from the TrueNAS host.
- Google Ads reporting is not complete until developer token, OAuth, and customer mappings are provided.
- Full Meta Business Suite/Page/Instagram reporting is not complete until page and Instagram business account mappings are provided.
