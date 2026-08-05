# TrueNAS Migration Runbook

## Goal

Move all TDS Geo runtime pieces from AWS to a TrueNAS-hosted Ubuntu VM while preserving the GitHub-driven workflow.

## Current AWS Pieces To Move

- PM2 backend release currently under `/opt/tds-geo/current`.
- PostgreSQL database.
- Redis.
- Nginx public reverse proxy.
- Docker sidecars: `tds-crawl4ai`, `tds-freellmapi`, `tds-headroom`.
- Cron jobs for backup, monthly ops, publish queue, and health checks.
- Production `.env` secrets.
- Database backups.
- Shopify app URLs, redirects, and webhooks.
- Optional vault/admin hostnames.

## Phase 1: Build TrueNAS VM

1. Create an Ubuntu Server VM on TrueNAS SCALE.
2. Give it a static LAN IP.
3. Mount TrueNAS-backed datasets for:
   - `/mnt/tds-geo/postgres`
   - `/mnt/tds-geo/redis`
   - `/mnt/tds-geo/backups`
   - `/mnt/tds-geo/logs`
   - `/mnt/tds-geo/cloudflared`
4. Run:

```bash
deploy/truenas/scripts/bootstrap-vm.sh
```

## Phase 2: Clone Repo And Configure

```bash
sudo mkdir -p /opt/tds-geo
sudo chown "$USER:$USER" /opt/tds-geo
git clone git@github.com:yusuf-mohamed0/tds-geo.git /opt/tds-geo
cd /opt/tds-geo/deploy/truenas
cp .env.example .env
```

Fill `.env` on the VM only. Never commit it.

## Phase 3: Install GitHub Runner

Install the GitHub self-hosted runner in the VM and label it:

```text
self-hosted,truenas,tds-geo
```

Run the runner as a normal deploy user that is in the `docker` group.

## Phase 4: First AWS DB Copy

From the TrueNAS VM:

```bash
cd /opt/tds-geo/deploy/truenas
AWS_SSH_HOST=16.192.29.174 AWS_SSH_USER=ubuntu AWS_SSH_KEY_PATH=/path/to/key ./scripts/migrate-from-aws.sh
```

This creates a dump on AWS, copies it to TrueNAS, restores it into the local Postgres container, and healthchecks the stack.

## Phase 5: Staging Validation

Validate on a staging hostname before Shopify cutover.

Required checks:

```bash
./scripts/healthcheck.sh
docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml logs --tail=200 api worker
```

Application checks:

- `/health` returns 200.
- Admin dashboard loads.
- Client audit returns `ERROR: 0`.
- Shopify app loads embedded in admin on staging URL.
- Shopify `shop.json` validates for active Shopify stores.
- Boston Pharma WordPress read check works.
- No publish operation runs unless explicitly approved.

## Phase 6: Cutover

1. Freeze writes on AWS.
2. Take final AWS DB dump.
3. Restore final dump on TrueNAS.
4. Point production hostname to Cloudflare Tunnel or the VM proxy.
5. Update Shopify app URL and redirect URLs.
6. Update/re-register webhooks.
7. Run `./scripts/healthcheck.sh`.
8. Run client audit.
9. Watch logs for 30-60 minutes.

## Phase 7: Rollback Window

Keep AWS online for 1-2 weeks.

Rollback path:

- Point DNS/Shopify app URL back to AWS.
- Restore latest TrueNAS DB dump to AWS if TrueNAS accepted writes.
- Keep both latest DB dumps until final shutdown.

## Steady State

Daily:

- Confirm `/health`.
- Confirm Cloudflare Tunnel connected.
- Confirm latest backup exists.

Weekly:

- Restore latest backup into a test DB.
- Check dataset free space.
- Review GitHub Actions deploy logs.
