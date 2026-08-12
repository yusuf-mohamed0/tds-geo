# Kivo Geo TrueNAS Production Kit

This directory defines the TrueNAS target for moving Kivo Geo and supporting services off AWS while keeping the workflow:

```text
local edit -> git push -> GitHub Actions -> GHCR image -> TrueNAS deploy -> smoke test
```

Run this inside an Ubuntu Server VM on TrueNAS SCALE. Do not run production containers directly on the TrueNAS host.

## Target Architecture

```text
TrueNAS SCALE
└── Ubuntu Server VM
    ├── Docker Engine + Compose plugin
    ├── GitHub self-hosted runner: self-hosted,truenas,kivo
    ├── Kivo Geo API container
    ├── Kivo Geo worker container
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
| `ARCHITECTURE.md` | Complete target architecture, deployment flow, runtime topology, storage, cutover, and rollback design. |
| `SECURITY.md` | Security baseline for public exposure, secrets, firewalling, runner access, database safety, backups, and incident response. |
| `REQUIREMENTS.md` | Hardware, TrueNAS, VM, GitHub, environment, network, migration, validation, and operations requirements. |
| `LAUNCH-CHECKLIST.md` | Final go/no-go checklist before moving production traffic from AWS to TrueNAS. |
| `PRODUCTION-READINESS.md` | Manager-level readiness gates, acceptance criteria, non-negotiables, and definition of done. |
| `OPERATIONS.md` | Daily, weekly, monthly, deploy, backup, restore, logging, and change-management runbook. |
| `MONITORING.md` | Health, backup, disk, runner, tunnel, and Shopify monitoring and alerting expectations. |
| `DISASTER-RECOVERY.md` | RTO/RPO targets and recovery procedures for deploy, DB, VM, host, internet, and secret failures. |
| `DEVELOPER-HANDOFF.md` | Developer workflow, validation, safe-change rules, and emergency commands. |
| `RISK-REGISTER.md` | Main migration and local-server production risks with owners and mitigations. |
| `NEXTCLOUD-WORKSPACE.md` | Nextcloud workspace architecture, recommended apps, groups, folders, security, and backup-copy workflow. |
| `TRUENAS-LIVE-INVENTORY.md` | Live NAS inventory, created datasets, current apps/VMs/services, security findings, and deployment blockers. |
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
| `scripts/sync-intelligence.sh` | Export n8n workflows, refresh GitNexus, and verify source/workflow/index/health pairing. |
| `scripts/refresh-gitnexus.sh` | Refresh the GitNexus graph via Docker for the clean source checkout. |
| `scripts/check-pairing.sh` | Verify source cleanliness, exported workflows, GitNexus commit, and production health. |
| `RUNBOOK.md` | Full migration and operations runbook. |
| `KNOWLEDGE-BASE.md` | Saved TrueNAS and local-server operating knowledge. |
| `OPERATING-ROLES.md` | Role responsibilities for migration and operations. |

## Read This First

1. `REQUIREMENTS.md` tells you what hardware, VM, network, secrets, GitHub runner, and validation evidence are required.
2. `ARCHITECTURE.md` shows the complete target design and traffic/deploy/data flow.
3. `SECURITY.md` defines what can be public, what must stay private, and how secrets/backups/runners are protected.
4. `PRODUCTION-READINESS.md` defines manager-level acceptance gates and non-negotiables.
5. `RUNBOOK.md` is the step-by-step migration procedure.
6. `OPERATIONS.md`, `MONITORING.md`, and `DISASTER-RECOVERY.md` define steady-state production operation.
7. `LAUNCH-CHECKLIST.md` is the final go/no-go checklist before cutover.
8. `NEXTCLOUD-WORKSPACE.md` defines how Nextcloud supports files, approvals, reports, and backup copies without replacing the production runtime.

## GitHub Actions

Use `.github/workflows/deploy-truenas.yml` after installing a self-hosted runner in the VM.

The runner needs labels:

```text
self-hosted,truenas,kivo
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

If `nas.trafficdigitalsolutions.com` points to the TrueNAS UI, lock it down before production cutover. Use LAN-only access, VPN, Tailscale, or Cloudflare Access.

## Rollback

The deploy script stores the previous API image ID in `.previous-image`. Keep AWS online for 1-2 weeks after cutover as an external rollback target.

## Intelligence Pairing

TrueNAS keeps a clean, non-production source checkout at `/opt/tds-geo/kivo-source` for analysis. Do not use two-way destructive sync between runtime directories and GitHub. The safe flow is:

```text
GitHub/main -> clean source checkout -> n8n workflow export -> GitNexus analyze -> pairing check
```

Run:

```bash
/opt/tds-geo/kivo-source/deploy/truenas/scripts/sync-intelligence.sh
```

This exports redacted n8n workflows into `n8n/workflows/exported/`, refreshes GitNexus through the official Docker image, and verifies the GitNexus index commit matches the source commit while production `/health` is healthy.

The `.github/workflows/sync-truenas-intelligence.yml` workflow keeps this paired on every `main` push through the TrueNAS self-hosted runner. If GitHub runner access is unavailable, transfer a fresh source bundle manually and then run `sync-intelligence.sh`.
