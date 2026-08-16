# TrueNAS Production Requirements

This file lists what must exist before Kivo Geo can move from AWS to the TrueNAS/local-server environment.

## Hardware Requirements

Minimum practical server:

| Resource | Minimum | Recommended |
|---|---:|---:|
| CPU | 4 cores | 8+ cores |
| RAM | 32 GB | 64 GB+ |
| Boot storage | Mirrored SSD if possible | Mirrored SSD/NVMe |
| App/data storage | ZFS redundant pool | ZFS mirror or RAIDZ with snapshots |
| Network | 1 GbE | 2.5/10 GbE if available |
| UPS | Strongly recommended | Required for production confidence |

RAM planning:

- Leave memory for TrueNAS and ZFS ARC.
- Allocate the Ubuntu VM enough RAM for API, worker, PostgreSQL, Redis, sidecars, and backups.
- Start with 8-16 GB VM RAM for Kivo Geo, then adjust after observing real load.

## TrueNAS Requirements

- TrueNAS SCALE installed and stable.
- ZFS pool created with redundancy.
- Apps pool configured only if using TrueNAS Apps for non-production tools.
- Ubuntu Server VM created with static LAN IP.
- VM network bridge configured if LAN reachability requires it.
- TrueNAS datasets or VM disks prepared for persistent data.
- Snapshots configured for application datasets.
- Offsite backup destination identified.
- Nextcloud app planned only as a collaboration workspace, not as the Kivo Geo production runtime.

## Ubuntu VM Requirements

Operating system:

- Ubuntu Server LTS.
- Static LAN IP.
- SSH key access.
- Password SSH login disabled.
- Time synchronization enabled.

Packages and services:

- Docker Engine.
- Docker Compose plugin.
- Git.
- GitHub self-hosted runner.
- PostgreSQL client tools.
- `curl`, `jq`, `rsync`, `bash`, `ca-certificates`, and `gnupg`.
- UFW or equivalent firewall.
- Optional QEMU guest agent.
- `ENABLE_DIRECT_HTTPS=true` during bootstrap only when direct Caddy HTTPS is required.

Bootstrap script:

```bash
deploy/truenas/scripts/bootstrap-vm.sh
```

## Dataset And Directory Requirements

Create or mount persistent directories before production cutover.

| Path | Required | Purpose |
|---|---|---|
| `/opt/kivo` | Yes | Git checkout and deployment kit |
| `/mnt/kivo/postgres` | Yes | PostgreSQL data |
| `/mnt/kivo/redis` | Yes | Redis data |
| `/mnt/kivo/backups` | Yes | DB dumps and migration dumps |
| `/mnt/kivo/logs` | Yes | Application logs |
| `/mnt/kivo/cloudflared` | If tunnel config-file mode is used | Tunnel config/state |

## Repository Requirements

Required files:

- `deploy/truenas/compose.yml`.
- `deploy/truenas/.env.example`.
- `deploy/truenas/Caddyfile`.
- `deploy/truenas/cloudflared/config.yml.example`.
- `deploy/truenas/scripts/bootstrap-vm.sh`.
- `deploy/truenas/scripts/deploy.sh`.
- `deploy/truenas/scripts/healthcheck.sh`.
- `deploy/truenas/scripts/backup-db.sh`.
- `deploy/truenas/scripts/restore-db.sh`.
- `deploy/truenas/scripts/migrate-from-aws.sh`.
- `.github/workflows/deploy-truenas.yml`.

## GitHub Requirements

- Repository remote available to the VM.
- GitHub Actions enabled.
- GHCR package permissions available.
- Self-hosted runner installed in the Ubuntu VM.
- Runner labels include `self-hosted`, `truenas`, and `kivo`.
- Production runner must not execute untrusted public pull-request workflows.

Required GitHub permissions for the workflow:

- `contents: read`.
- `packages: write` for pushing GHCR images.

## Runtime Environment Requirements

Create the TrueNAS runtime `.env` on the runner only. The deploy workflow stores it at `$HOME/tds-geo-deploy/deploy/truenas/.env` with `600` permissions and never commits it.

Supported bootstrap sources, in priority order:

- Existing `$HOME/tds-geo-deploy/deploy/truenas/.env`.
- GitHub secret `TRUENAS_ENV_B64`, containing the complete `.env` file base64-encoded.
- GitHub secret `TRUENAS_ENV`, containing the complete shell-valid `.env` file.
- Existing legacy runner paths `/opt/kivo/deploy/truenas/.env` or `/opt/tds-geo/kivo-source/deploy/truenas/.env`.
- Current live Docker containers, used once to bootstrap from the already-running production environment while preserving existing Postgres and Redis mount paths.

Required values:

- `TDS_IMAGE`.
- `TDS_PUBLIC_URL`.
- `DB_USER`.
- `DB_PASSWORD`.
- `DB_NAME`.
- `DATABASE_URL`.
- `REDIS_URL`.
- `JWT_SECRET`.
- `CREDENTIAL_VAULT_KEY`.

Integration values, as needed:

- `OPENAI_API_KEY`.
- `SERPAPI_API_KEY`.
- `DATAFORSEO_API_KEY`.
- `SHOPIFY_API_KEY`.
- `SHOPIFY_API_SECRET`.
- `SHOPIFY_SCOPES`.
- `GOOGLE_CLIENT_ID`.
- `GOOGLE_CLIENT_SECRET`.
- `CLOUDFLARED_TOKEN`.
- `ENABLE_CLOUDFLARED` for config-file tunnel mode without a token.
- `ENABLE_DIRECT_HTTPS` for direct Caddy HTTPS mode.
- `PRE_DEPLOY_BACKUP_REQUIRED`; keep `true` for production.

Storage path values:

- `POSTGRES_DATA`.
- `REDIS_DATA`.
- `BACKUP_DIR`.
- `LOG_DIR`.
- `CLOUDFLARED_DIR`.

## Network And DNS Requirements

Cloudflare Tunnel mode:

- Domain controlled in Cloudflare.
- Tunnel created.
- Tunnel token available only on VM.
- Public hostname routes to the Kivo Geo API service.
- Admin-only hostnames protected with Cloudflare Access.

Direct HTTPS mode:

- Public DNS points to the site IP.
- Router forwards only `80` and `443` to the Ubuntu VM.
- Caddy can issue TLS certificates.
- No database, Redis, Docker, TrueNAS, VNC, or RDP ports are forwarded.

Nextcloud workspace requirements:

- Dedicated Nextcloud URL if exposed publicly.
- `trusted_domains` includes the final Nextcloud domain.
- Reverse proxy settings match the final ingress.
- TrueNAS admin UI is not exposed publicly at the Nextcloud or NAS domain.
- Admin users have MFA.
- Production background jobs use cron.

Shopify requirements:

- App URL updated to final HTTPS hostname.
- Redirect URLs updated to final HTTPS hostname.
- Webhook callback URLs updated or re-registered.
- Embedded app loads inside Shopify Admin.
- Active store tokens validate against Shopify Admin `shop.json`.

## Database Migration Requirements

Before first copy:

- AWS SSH access available.
- AWS DB credentials available on the server or in protected env files.
- TrueNAS Postgres container running and healthy.
- Backup directory exists and has enough space.

Before final cutover:

- Freeze writes on AWS.
- Take final `pg_dump -Fc` from AWS.
- Restore final dump on TrueNAS.
- Verify schema compatibility and migrations.
- Verify active clients.
- Keep both AWS and TrueNAS dumps.

## Validation Requirements

Required checks before production cutover:

- `docker compose --env-file .env -f compose.yml config` passes.
- `docker compose --env-file .env -f compose.yml ps` shows healthy services.
- `scripts/healthcheck.sh` passes.
- Public `/health` returns 200.
- Admin dashboard loads.
- Active client audit returns no critical errors.
- Shopify embedded app loads.
- Active Shopify tokens validate.
- Boston Pharma WordPress read check works.
- Backup script creates a restorable dump.
- Restore test succeeds in a non-production test database or controlled validation window.

## Operational Requirements

Daily:

- Check public `/health`.
- Confirm Cloudflare Tunnel or Caddy is healthy.
- Confirm latest DB backup exists.

Weekly:

- Restore latest backup into a test DB.
- Review disk usage and ZFS dataset free space.
- Review GitHub Actions deploy logs.
- Review production app logs for repeated errors.

Monthly:

- Patch Ubuntu VM packages.
- Update container images during a maintenance window.
- Confirm offsite backups are current.
- Review firewall and public exposure.
- Review Shopify app URLs and webhooks.
