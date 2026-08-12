# TrueNAS And Local Server Knowledge Base

Last researched: 2026-08-05

This file captures the operating knowledge for moving Kivo Geo and related services from AWS to a TrueNAS-hosted local server.

## Core Decision

For our workload, use **TrueNAS SCALE as the storage/virtualization host** and run production inside an **Ubuntu Server VM**.

Reasoning:

- TrueNAS is best at ZFS storage, datasets, snapshots, and VM/app hosting.
- Kivo Geo needs a normal Linux deployment environment: Docker Compose, GitHub runner, SSH, PostgreSQL tooling, Cloudflare Tunnel, and predictable package management.
- Installing Docker directly into the TrueNAS host is not the safest long-term path because host OS updates and TrueNAS app management can conflict with manually installed services.
- TrueNAS Apps are useful for simpler apps, but Kivo Geo is a multi-service production stack with custom CI/CD, DB migration, backups, workers, and sidecars.

## TrueNAS SCALE Apps

TrueNAS SCALE app behavior depends on version:

- 24.04 Dragonfish used Kubernetes-backed Apps.
- 24.10 Electric Eel and newer use Docker/Docker Compose-backed Apps.
- Apps need an apps pool before installing apps.
- TrueNAS stores app runtime data in internal app datasets and can also mount explicit host-path datasets into apps.
- For custom apps, create datasets/host paths before installing the app and map them intentionally.

Use TrueNAS Apps for:

- Simple packaged services.
- Non-critical tools.
- Services where the TrueNAS UI lifecycle is enough.

Avoid TrueNAS Apps for Kivo Geo production because:

- GitHub self-hosted runner driven deployments are easier in a normal VM.
- We need repository-controlled Compose and scripts.
- We need predictable Linux shell access and tooling.
- We need clean rollback/migration operations.

## TrueNAS VMs

TrueNAS SCALE supports KVM virtual machines. VMs give stronger isolation than containers, at the cost of more RAM/CPU overhead.

Use a VM when:

- You need a full Linux OS.
- You need Docker Compose and CI/CD tooling.
- You need system services like GitHub runner, SSH, cron/systemd, cloudflared, and Docker.
- You want the application to survive TrueNAS host updates cleanly.

VM best practices:

- Use Ubuntu Server LTS.
- Allocate enough but not all RAM; leave memory for TrueNAS and ZFS ARC.
- Use VirtIO for disk/network when possible.
- Use a static LAN IP.
- Use a bridge interface if the VM must communicate reliably with LAN/NAS services.
- Put persistent app data on TrueNAS-backed datasets or VM disks with ZFS snapshots.
- Install QEMU guest agent if available for better shutdown/snapshot behavior.

## Storage Design

Create separate datasets for separate lifecycle and snapshot policy:

| Dataset | Purpose |
|---|---|
| `apps/kivo/postgres` | PostgreSQL data. |
| `apps/kivo/redis` | Redis append-only data. |
| `apps/kivo/backups` | DB dumps and migration dumps. |
| `apps/kivo/logs` | App logs. |
| `apps/kivo/cloudflared` | Tunnel state/config if using config-file mode. |

Why separate datasets:

- Independent snapshots.
- Independent quotas.
- Easier restore.
- Easier backup/offsite sync.
- Cleaner permissions.

PostgreSQL needs careful handling:

- ZFS snapshots alone are not a replacement for logical `pg_dump` backups.
- Take regular `pg_dump -Fc` backups.
- Test restore regularly.
- For higher guarantees later, add WAL archiving or physical base backups.

## Networking And Public Access

Recommended public ingress: **Cloudflare Tunnel**.

Why:

- Works without a static public IP.
- Works behind CGNAT in many cases.
- Creates outbound-only connections from the VM to Cloudflare.
- Avoids opening inbound ports to the home network.
- Lets Shopify reach the app over HTTPS.

Cloudflare Tunnel rules:

- Keep tunnel token in `.env`, never in git.
- Prefer internal Docker service names, for example `http://api:3000`.
- Always include a catch-all `http_status:404` rule in config-file mode.
- Protect admin-only hostnames with Cloudflare Access.

If not using Cloudflare Tunnel:

- Port-forward only 80/443 to the VM reverse proxy.
- Do not expose PostgreSQL, Redis, VNC, Docker, SSH, or TrueNAS UI publicly.
- Use a real domain and valid TLS.

## VNC, RDP, And GUI Access

Do not run permanent public VNC.

Use:

- TrueNAS VM console for initial install/emergency console.
- SSH keys for normal administration.
- GitHub Actions runner for deployments.
- Portainer optionally for Docker UI, only behind VPN/Cloudflare Access.
- Tailscale/Cloudflare Access for private admin surfaces.

Never expose VNC/RDP directly to the internet.

## CI/CD Model

Desired flow:

```text
developer machine -> git push -> GitHub Actions -> GHCR image -> self-hosted runner deploys on TrueNAS VM
```

Advantages:

- No inbound SSH from GitHub to the home server.
- TrueNAS VM only needs outbound access to GitHub/GHCR.
- Deploy script lives in the repo.
- Rollback and healthchecks are repeatable.

Required GitHub runner labels:

```text
self-hosted,truenas,kivo
```

Runner rules:

- Runner user can run Docker.
- Runner work directory is not public.
- Secrets live in `/opt/kivo/deploy/truenas/.env` on the VM.
- GitHub builds/pushes images; VM pulls and runs them.

## Security Rules

Never expose publicly:

- TrueNAS web UI.
- PostgreSQL.
- Redis.
- Docker socket.
- GitHub runner directory.
- VNC/RDP.
- `.env` files.
- Backup directories.

Use:

- SSH keys, no password login.
- UFW/firewall on VM.
- Cloudflare Access for admin-only hostnames.
- Strong `JWT_SECRET`, `CREDENTIAL_VAULT_KEY`, and DB password.
- Separate Cloudflare Tunnel token rotation if exposed.
- Offsite encrypted backups.

## Backup And Restore

Minimum backup policy:

- Daily `pg_dump -Fc` to `/mnt/kivo/backups`.
- Keep at least 14-20 recent dumps locally.
- TrueNAS snapshots of app datasets.
- Offsite backup to another location, cloud bucket, or external disk.
- Weekly restore test into a separate DB.

Cutover backup policy:

- Freeze AWS writes.
- Dump AWS DB.
- Restore into TrueNAS.
- Verify health and client audit.
- Keep AWS online for rollback.

## Kivo Geo Specific Notes

Kivo Geo needs these runtime pieces:

- API service.
- Worker service.
- PostgreSQL.
- Redis.
- Reverse proxy.
- Cloudflare Tunnel or public HTTPS.
- Optional sidecars: crawl4ai, headroom, freellmapi, openseo.
- Cron-equivalent behavior for backups/monthly ops/publish queue.
- Shopify app URLs and webhooks updated to the final TrueNAS domain.

The current AWS production has historically used PM2 release folders plus Docker sidecars. TrueNAS should standardize on Docker Compose for repeatability.

## Source Notes

Knowledge sources used:

- TrueNAS official docs: custom apps and app storage.
- TrueNAS official docs: Cloudflare Tunnel app guide.
- TrueNAS official docs: creating and managing VMs.
- TrueNAS Apps Market docs: app pool, Docker/Compose-backed apps in newer SCALE.
- Cloudflare official docs: Tunnel architecture, outbound-only model, config-file ingress rules.
- Current Kivo Geo repo files: `docker-compose.yml`, `docker-compose.sidecars.yml`, `Dockerfile`, deployment scripts, backup scripts, production docs.
- Current AWS inspection: PM2 process, Docker sidecars, Nginx routes, backup cron, monthly ops cron.

When exact TrueNAS behavior depends on installed SCALE version, verify against that version before applying changes.
