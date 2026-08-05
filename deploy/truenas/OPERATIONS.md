# TrueNAS Operations Runbook

This file defines steady-state operations after TDS Geo is running on the TrueNAS Ubuntu VM.

## Daily Checks

Run these once per day.

```bash
cd /opt/tds-geo/deploy/truenas
./scripts/healthcheck.sh
docker compose --env-file .env -f compose.yml ps
ls -lh /mnt/tds-geo/backups
```

Expected result:

- API is healthy.
- Worker is running.
- PostgreSQL is healthy.
- Redis is healthy.
- Cloudflare Tunnel or Caddy ingress is healthy.
- A recent database backup exists.

## Weekly Checks

Run these once per week.

```bash
cd /opt/tds-geo/deploy/truenas
docker compose --env-file .env -f compose.yml logs --tail=300 api worker
df -h /mnt/tds-geo
du -sh /mnt/tds-geo/backups /mnt/tds-geo/logs
```

Weekly requirements:

- Restore latest backup in a test database or controlled validation environment.
- Review repeated errors in API and worker logs.
- Review GitHub Actions deployment history.
- Confirm dataset free space is safe.
- Confirm no unexpected public ports are exposed.

## Monthly Checks

Run these once per month during a maintenance window.

- Patch Ubuntu packages.
- Review Docker image updates.
- Confirm TrueNAS updates are available or intentionally deferred.
- Review Cloudflare Tunnel and DNS configuration.
- Review Shopify app URL, redirect URLs, and webhooks.
- Review active clients and billing state.
- Confirm offsite backup freshness.
- Run a restore test and record the result.

## Deployment Procedure

Normal deploy path:

```text
git push origin main -> GitHub Actions -> GHCR -> self-hosted runner -> deploy.sh
```

Manual deploy from the VM:

```bash
cd /opt/tds-geo/deploy/truenas
./scripts/deploy.sh
```

Deploy requirements:

- `.env` exists on the VM.
- Pre-deploy backup succeeds unless this is a documented first initialization with `PRE_DEPLOY_BACKUP_REQUIRED=false`.
- Compose pull succeeds for API and worker image.
- Healthcheck passes after restart.

## Backup Procedure

Manual backup:

```bash
cd /opt/tds-geo/deploy/truenas
./scripts/backup-db.sh
```

Expected result:

- A new `tds-geo_YYYYMMDD_HHMMSS.dump` file appears in `BACKUP_DIR`.
- `tds-geo_latest.dump` points to the newest dump.
- `pg_restore --list` succeeds during backup validation.

## Restore Procedure

Restore replaces the configured database. Use only during migration, rollback, or a controlled recovery window.

```bash
cd /opt/tds-geo/deploy/truenas
./scripts/restore-db.sh /mnt/tds-geo/backups/tds-geo_latest.dump
./scripts/healthcheck.sh
```

## Log Locations

| Source | Command Or Path |
|---|---|
| Compose services | `docker compose --env-file .env -f compose.yml logs api worker` |
| App log mount | `/mnt/tds-geo/logs` |
| Backup log | `/mnt/tds-geo/backups/backup.log` |
| GitHub deploy logs | GitHub Actions run for `Deploy TrueNAS` |
| Cloudflare Tunnel logs | `docker compose --env-file .env -f compose.yml logs cloudflared` |

## Common Failure Responses

| Symptom | First Action | Escalation |
|---|---|---|
| `/health` fails | Run `scripts/healthcheck.sh` and inspect API logs | Roll back image or restore backup if data-related |
| API healthy but Shopify app fails | Verify public URL, App Bridge, app URL, redirects, webhook URLs | Revert Shopify URLs to AWS during rollback window |
| Database unhealthy | Check disk space and Postgres logs | Restore latest known-good dump |
| Redis unhealthy | Restart Redis container | Restore Redis data only if queue state is required |
| Cloudflare Tunnel down | Check token and tunnel logs | Switch to direct HTTPS only if firewall and TLS are ready |
| Backup missing | Run backup manually and inspect backup log | Stop deploys until backup is fixed |

## Change Management

- Commit every infrastructure change to git.
- Keep `.env` changes documented by variable name only, never by value.
- Record deploy time, commit SHA, and healthcheck result.
- Avoid multiple infrastructure changes in one cutover window.
- Keep AWS rollback available until the rollback window closes.
