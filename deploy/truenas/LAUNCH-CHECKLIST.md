# TrueNAS Launch Checklist

Use this as the final checklist before moving production traffic from AWS to TrueNAS.

## 1. Hardware And Host

- TrueNAS SCALE is installed and stable.
- ZFS pool is healthy.
- UPS is connected or outage plan is accepted.
- Snapshots are configured for TDS datasets.
- Offsite backup path is ready.

## 2. VM

- Ubuntu Server VM exists.
- VM has a static LAN IP.
- VM has enough CPU and RAM reserved.
- SSH key login works.
- Password SSH login is disabled.
- Docker and Compose are installed.
- GitHub runner is installed and online.
- Runner labels are `self-hosted,truenas,tds-geo`.

## 3. Storage

- `/mnt/tds-geo/postgres` exists.
- `/mnt/tds-geo/redis` exists.
- `/mnt/tds-geo/backups` exists.
- `/mnt/tds-geo/logs` exists.
- `/mnt/tds-geo/cloudflared` exists if needed.
- Permissions allow the deploy user and containers to use the paths.

## 4. Secrets

- `.env` exists only on the VM.
- `.env` is not committed.
- `DB_PASSWORD` is strong and not reused unnecessarily.
- `JWT_SECRET` is strong.
- `CREDENTIAL_VAULT_KEY` is strong.
- Shopify keys are present.
- Cloudflare Tunnel token is present if using tunnel mode.
- Any previously exposed secrets are rotated externally.

## 5. Network

- Cloudflare Tunnel is connected, or Caddy direct HTTPS is working.
- Public hostname resolves to the intended ingress.
- Only allowed public ports are exposed.
- If using Cloudflare Tunnel, inbound internet ports are not required.
- If using direct HTTPS, only ports `80` and `443` are forwarded to the VM.
- TrueNAS UI is not public.
- PostgreSQL is not public.
- Redis is not public.
- Docker socket/API is not public.
- VNC/RDP is not public.

## 6. Compose Stack

- `docker compose --env-file .env -f compose.yml config` passes.
- `docker compose --env-file .env -f compose.yml pull` succeeds.
- `docker compose --env-file .env -f compose.yml up -d` succeeds.
- API container is healthy.
- Worker container is running.
- PostgreSQL healthcheck passes.
- Redis healthcheck passes.
- Backup container is running.
- `PRE_DEPLOY_BACKUP_REQUIRED=true` for production deploys.

## 7. Data Migration

- First AWS DB dump completed.
- First restore to TrueNAS completed.
- Staging validation completed.
- Final AWS write freeze approved.
- Final AWS DB dump completed.
- Final restore to TrueNAS completed.
- AWS rollback dump retained.
- TrueNAS post-restore dump retained.

## 8. Application Validation

- `scripts/healthcheck.sh` passes.
- Public `/health` returns 200.
- Admin dashboard loads.
- Active client audit returns no critical errors.
- Shopify embedded app loads in admin.
- Shopify tokens validate for active stores.
- Boston Pharma WordPress read check works.
- No unapproved live publishing happens during validation.

## 9. Shopify Cutover

- Shopify app URL points to TrueNAS public URL.
- Shopify redirect URLs point to TrueNAS public URL.
- Shopify webhook URLs are updated or re-registered.
- App loads embedded after URL changes.
- OAuth/install flow is tested on a safe store if needed.

## 10. Rollback Window

- AWS remains online for 1-2 weeks.
- DNS rollback path is known.
- Shopify URL rollback path is known.
- Latest AWS and TrueNAS dumps are retained.
- Team knows who can approve rollback.

## Go/No-Go Rule

Do not cut over production if any of these are false:

- Backups are current and restorable.
- Public HTTPS works.
- `/health` passes.
- Database and Redis are healthy.
- Shopify embedded app works.
- No private service is publicly exposed.
- AWS rollback path is still available.
