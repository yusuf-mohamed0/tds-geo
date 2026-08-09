# TrueNAS Production Architecture

This is the target architecture for running TDS Geo on a local TrueNAS-hosted server while keeping GitHub as the source of truth.

## Architecture Decision

Use **TrueNAS SCALE for storage, snapshots, datasets, and VM hosting**. Run TDS Geo inside an **Ubuntu Server VM** on TrueNAS SCALE.

Do not run TDS Geo production directly on the TrueNAS host OS. Do not depend on unmanaged host-level Docker installed into TrueNAS.

## Deployment Flow

```text
Developer machine
  -> git push origin main
  -> GitHub Actions CI
  -> GitHub Container Registry image
  -> GitHub self-hosted runner inside Ubuntu VM
  -> docker compose pull/up
  -> healthcheck
  -> production traffic
```

## Runtime Topology

```text
Internet
  -> Cloudflare DNS
  -> Cloudflare Tunnel or HTTPS reverse proxy
  -> Ubuntu Server VM on TrueNAS SCALE
     -> Caddy reverse proxy
     -> TDS Geo API container
     -> TDS Geo worker container
     -> PostgreSQL 16 container
     -> Redis 7 container
     -> Optional sidecars
        -> crawl4ai
        -> freellmapi
        -> headroom
        -> openseo
     -> DB backup container
```

## TrueNAS Host Responsibilities

- ZFS pool management.
- Datasets for persistent application data.
- Snapshots and replication.
- Ubuntu VM lifecycle.
- Local console access for emergency VM recovery.
- Optional Nextcloud app for collaboration workspace only.

## Ubuntu VM Responsibilities

- Docker Engine and Compose plugin.
- GitHub self-hosted runner with labels `self-hosted,truenas,tds-geo`.
- TDS Geo production containers.
- Cloudflare Tunnel client or Caddy HTTPS reverse proxy.
- Local `.env` secrets file.
- Backup and restore scripts.
- Operational healthchecks.

## Nextcloud Workspace Role

Nextcloud may run on TrueNAS as a separate collaboration app for files, client docs, reports, approvals, calendars, tasks, and selected backup copies.

Nextcloud must not replace the Ubuntu VM production runtime. Do not run the TDS Geo API, worker, PostgreSQL, Redis, GitHub runner, `.env`, or live deployment repo from Nextcloud.

## Application Services

| Service | Purpose | Public |
|---|---|---|
| `api` | Backend API, Shopify app endpoints, admin API, health endpoint | Behind proxy only |
| `worker` | Background jobs, scheduled publishing, queues | No |
| `postgres` | Primary application database | No |
| `redis` | Queue/cache/runtime state | No |
| `caddy` | Reverse proxy and TLS when using direct HTTPS | Only 80/443 if direct mode |
| `cloudflared` | Outbound Cloudflare Tunnel ingress | No inbound ports |
| `db-backup` | Scheduled PostgreSQL dumps | No |
| `crawl4ai` | Optional crawling sidecar | No |
| `freellmapi` | Optional LLM sidecar | No |
| `headroom` | Optional sidecar | No |
| `openseo` | Optional SEO sidecar | No |

## Storage Layout

Use separate TrueNAS-backed datasets or mount points so each area can have its own quota, snapshot policy, permissions, and restore path.

| Mount | Data | Restore Priority |
|---|---|---|
| `/mnt/tds-geo/postgres` | PostgreSQL data directory | Critical |
| `/mnt/tds-geo/redis` | Redis append-only data | Medium |
| `/mnt/tds-geo/backups` | Logical DB dumps and migration dumps | Critical |
| `/mnt/tds-geo/logs` | API and worker logs | Medium |
| `/mnt/tds-geo/cloudflared` | Cloudflare Tunnel config/state if using config-file mode | Medium |

Logical PostgreSQL dumps are mandatory. ZFS snapshots are useful, but they are not the only database backup mechanism.

## Network Modes

Recommended mode: Cloudflare Tunnel.

- No inbound ports from the internet to the home network.
- VM makes outbound connections to Cloudflare.
- Shopify and users reach the app over HTTPS.
- Admin-only hostnames can be protected with Cloudflare Access.
- `ENABLE_CLOUDFLARED=true` supports config-file tunnel mode without using `CLOUDFLARED_TOKEN`.

Fallback mode: direct HTTPS.

- Forward only ports `80` and `443` to the Ubuntu VM.
- Caddy terminates TLS and proxies to `api:3000`.
- Do not forward database, Redis, Docker, SSH, VNC, RDP, or TrueNAS UI ports.

## Environments

| Environment | Purpose | Notes |
|---|---|---|
| AWS current production | Existing stable production and rollback source | Keep online for 1-2 weeks after cutover |
| TrueNAS staging hostname | Validation before final cutover | Use production-like data after first migration dump |
| TrueNAS production hostname | Final traffic target | Update Shopify app URLs and webhooks at cutover |

## Cutover Architecture

During migration, AWS and TrueNAS exist at the same time.

```text
AWS production stays online
  -> first DB dump copied to TrueNAS
  -> TrueNAS staging validates
  -> write freeze on AWS
  -> final DB dump copied to TrueNAS
  -> DNS/Cloudflare/Shopify URLs point to TrueNAS
  -> AWS kept as rollback target
```

## Rollback Architecture

AWS stays available until the rollback window is closed.

Rollback path:

- Point DNS or Cloudflare route back to AWS.
- Point Shopify app URL and redirect URLs back to AWS if needed.
- Restore the latest TrueNAS dump to AWS only if TrueNAS accepted writes after cutover.
- Keep both AWS and TrueNAS database dumps until final AWS shutdown.

## Operational Evidence

Every deploy and cutover must produce evidence:

- GitHub Actions run passed.
- Image pulled from GHCR.
- `docker compose ps` healthy.
- `scripts/healthcheck.sh` passed.
- `/health` returns 200 through the public URL.
- PostgreSQL and Redis healthchecks pass.
- Active client audit returns no critical errors.
- Shopify embedded app loads on the active public URL.
