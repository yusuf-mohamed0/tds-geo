# TDS Geo TrueNAS Production Kit

This directory defines the TrueNAS target for moving TDS Geo and supporting services off AWS while keeping the workflow:

```text
local edit -> git push -> GitHub Actions -> GHCR image -> TrueNAS deploy -> smoke test
```

Run this inside an Ubuntu Server VM on TrueNAS SCALE. Do not run production containers directly on the TrueNAS host.

## Target Architecture

```text
TrueNAS SCALE
└── Ubuntu Server VM
    ├── Docker Engine + Compose plugin
    ├── GitHub self-hosted runner: self-hosted,truenas,tds-geo
    ├── TDS Geo API container
    ├── TDS Geo worker container
    ├── PostgreSQL 16
    ├── Redis 7
    ├── Caddy reverse proxy
    ├── Cloudflare Tunnel
    ├── crawl4ai / headroom / freellmapi / openseo sidecars
    └── TrueNAS-backed datasets for DB, Redis, logs, backups, tunnel state
```

## Files

| File | Purpose |
|---|---|
| `compose.yml` | Main TrueNAS production stack. |
| `.env.example` | Environment template. Real `.env` lives only on the VM. |
| `Caddyfile` | Reverse proxy for direct HTTPS mode. |
| `cloudflared/config.yml.example` | Cloudflare Tunnel config mode example. |
| `scripts/bootstrap-vm.sh` | Install VM dependencies. |
| `scripts/deploy.sh` | Pull image, backup DB, restart stack, healthcheck. |
| `scripts/backup-db.sh` | Create compressed PostgreSQL dumps. |
| `scripts/restore-db.sh` | Restore a dump into TrueNAS Postgres. |
| `scripts/migrate-from-aws.sh` | Pull final/current AWS DB dump and restore locally. |
| `scripts/healthcheck.sh` | Verify containers, DB, Redis, and `/health`. |
| `RUNBOOK.md` | Full migration and operations runbook. |

## GitHub Actions

Use `.github/workflows/deploy-truenas.yml` after installing a self-hosted runner in the VM.

The runner needs labels:

```text
self-hosted,truenas,tds-geo
```

## Public Access

Recommended: Cloudflare Tunnel.

Do not expose publicly:

- TrueNAS UI
- PostgreSQL
- Redis
- Docker socket
- VNC/RDP
- GitHub runner work directory

## Rollback

The deploy script stores the previous API image ID in `.previous-image`. Keep AWS online for 1-2 weeks after cutover as an external rollback target.
