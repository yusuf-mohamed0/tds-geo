# TrueNAS Developer Handoff

This file tells a developer exactly how to work with the TrueNAS deployment without breaking production.

## Developer Workflow

```text
local edit -> local checks -> git commit -> git push origin main -> GitHub Actions -> TrueNAS runner deploys
```

## Before Editing

- Check current branch and working tree.
- Do not commit generated files from `graphify-out/**`, build info, local outputs, database dumps, or `.env`.
- Read `deploy/truenas/README.md` before changing deployment behavior.
- Read `SECURITY.md` before changing public ports, secrets, runner behavior, or Cloudflare settings.
- Read `DISASTER-RECOVERY.md` before changing backup or restore behavior.

## Local Validation

Run these before pushing infrastructure changes:

```bash
docker compose -f deploy/truenas/compose.yml --env-file deploy/truenas/.env.example config
git diff --check
```

If TypeScript or application code changed, also run the repo's normal typecheck, tests, lint, and build checks.

## Files Developers May Change

| File | Change Type |
|---|---|
| `compose.yml` | Service topology, images, healthchecks, volumes |
| `.env.example` | Add non-secret configuration variables only |
| `scripts/*.sh` | Deployment, backup, restore, migration, healthcheck behavior |
| `.github/workflows/deploy-truenas.yml` | CI/CD build and deploy flow |
| Docs in `deploy/truenas/` | Operating and handoff knowledge |

## Files Developers Must Not Commit

- `deploy/truenas/.env`.
- `deploy/truenas/.previous-image`.
- Database dumps.
- Backup archives.
- SSH private keys.
- Cloudflare Tunnel credentials JSON.
- Shopify tokens.
- Generated graph/cache files unless explicitly requested.
- Local build outputs.

## Production Deploy Rules

- Every deploy must create or verify a database backup first.
- `PRE_DEPLOY_BACKUP_REQUIRED=false` is allowed only for documented first initialization.
- The GitHub runner sync must exclude `deploy/truenas/.env` so VM-local secrets are not deleted.
- Failed `scripts/healthcheck.sh` means stop and roll back or fix directly, not keep deploying.
- Do not change Shopify production URLs without a cutover or rollback plan.
- Do not publish live Shopify content during infrastructure validation unless explicitly approved.

## Adding A New Environment Variable

1. Add the variable to `.env.example` with a placeholder or safe default.
2. Document it in `REQUIREMENTS.md` if it is required for production.
3. Document any security impact in `SECURITY.md`.
4. Add it to the VM-local `.env` manually during deployment.
5. Never commit the real value.

## Adding A New Service

1. Add the service to `compose.yml`.
2. Keep it on the internal Compose network unless it must be public.
3. Avoid published host ports unless documented and approved.
4. Add a healthcheck when possible.
5. Add persistent volumes only under the approved data root.
6. Document the service in `ARCHITECTURE.md`.
7. Document security exposure in `SECURITY.md`.
8. Update `LAUNCH-CHECKLIST.md` and `OPERATIONS.md`.

## Emergency Local VM Commands

```bash
cd /opt/tds-geo/deploy/truenas
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs --tail=200 api worker
./scripts/backup-db.sh
./scripts/healthcheck.sh
```

## Commit Expectations

Use small commits with clear intent.

Good examples:

- `Tighten TrueNAS backup requirement`.
- `Document TrueNAS disaster recovery plan`.
- `Add Cloudflare Tunnel config option`.

Bad examples:

- `fix`.
- `updates`.
- `final final`.
