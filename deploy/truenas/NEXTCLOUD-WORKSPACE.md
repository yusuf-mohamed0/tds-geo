# Nextcloud Workspace Plan

This file defines how Nextcloud should support the Kivo Geo migration and operations without replacing the production runtime.

## Decision

Use Nextcloud as the **company collaboration workspace** on TrueNAS. Do not run Kivo Geo production as a Nextcloud app.

Correct split:

```text
TrueNAS SCALE
├── TrueNAS administration
│   └── LAN, VPN, Tailscale, or Cloudflare Access only
├── Nextcloud App
│   └── documents, client files, approvals, schedules, reports, backup copies
└── Ubuntu Server VM
    └── Kivo Geo production runtime
        ├── API
        ├── worker
        ├── PostgreSQL
        ├── Redis
        ├── Cloudflare Tunnel or Caddy
        └── GitHub self-hosted runner
```

## Why Nextcloud Is Not The Production Runtime

Nextcloud has apps, but they are not a direct replacement for our production stack.

Classic Nextcloud apps:

- Run inside the Nextcloud PHP app framework.
- Use Nextcloud controllers, routes, services, database APIs, background jobs, and UI conventions.
- Are best for extending Nextcloud workflows.

Nextcloud ExApps/AppAPI:

- Run as separate external services and communicate with Nextcloud over HTTP/AppAPI.
- Can be built in other languages.
- Can use Docker deployment through an AppAPI deploy daemon.
- May involve Docker socket or Docker socket proxy access, which is a sensitive administration surface.

Kivo Geo needs a normal production service layout: Node API, worker, PostgreSQL, Redis, GitHub Actions, GHCR image deploys, Shopify OAuth/webhooks, backups, and rollback. Running that through Nextcloud would add complexity and risk without improving reliability.

## Public Exposure Rule

`https://nas.trafficdigitalsolutions.com/` currently redirects to `/ui/`, which appears to expose the TrueNAS web UI publicly. That must be locked down before production migration.

Allowed public surfaces:

- Kivo Geo public HTTPS app URL.
- Nextcloud public URL, if intentionally exposed and hardened.

Not allowed publicly:

- TrueNAS UI.
- PostgreSQL.
- Redis.
- Docker API or socket.
- GitHub runner folders.
- `.env` files.
- Backup datasets.
- VNC/RDP.

Use one of these for TrueNAS admin access:

- LAN-only access.
- Tailscale.
- VPN.
- Cloudflare Access with strong identity controls.

## Recommended Nextcloud Apps

Install only what we will actually use.

| App | Purpose |
|---|---|
| Team Folders | Shared client and operations folders with admin-managed permissions. |
| Collectives | Internal wiki, SOPs, migration notes, and runbooks. |
| Deck | Project board for migration, client work, and operations tasks. |
| Calendar | Publishing schedule, maintenance windows, audit reminders. |
| Tasks | Personal and team task tracking. |
| Forms | Client intake, access-request forms, audit intake. |
| Nextcloud Office | Collaborative document and spreadsheet editing. |
| Approval | File/article/asset approval workflows. |
| Notes | Quick internal notes. |
| Tables | Lightweight trackers for clients, assets, checks, and evidence. |
| Talk | Internal chat/calls if the team wants it. |
| External Storage | Mount controlled storage paths when needed. |
| Retention | Cleanup policies for old files and evidence. |
| User usage report | Admin visibility into user/storage usage. |

Use carefully:

| App Type | Reason For Caution |
|---|---|
| End-to-End Encryption | Good for sensitive files, but can complicate search, recovery, sharing, and server-side processing. |
| AI apps and assistants | Must confirm where data is processed and whether client/private data leaves the server. |
| Password/secret apps | Do not store production runtime secrets unless a separate secrets policy is designed and approved. |
| ExApps/AppAPI services | Treat Docker/AppAPI daemon access as sensitive infrastructure, not normal user tooling. |

## Folder Structure

Create this in Nextcloud Team Folders:

```text
Kivo Geo/
├── 00_Admin/
│   ├── Policies/
│   ├── Access Requests/
│   └── Vendor Accounts/
├── 01_Migration/
│   ├── TrueNAS/
│   ├── AWS Rollback/
│   ├── Launch Evidence/
│   └── Incident Notes/
├── 02_Backup Copies/
│   ├── Database Dumps/
│   ├── Config Evidence/
│   └── Restore Tests/
├── 03_Client Docs/
│   ├── alamein-2022/
│   ├── boston-pharma/
│   ├── caravanserai/
│   └── flaunt-cosmetics-global/
├── 04_Content/
│   ├── Drafts/
│   ├── Approved/
│   ├── Published Evidence/
│   └── Rejected/
├── 05_Reports/
│   ├── Audits/
│   ├── Monthly Reviews/
│   └── Client Evidence/
└── 06_Assets/
    ├── Brand Assets/
    ├── Screenshots/
    └── Exports/
```

## Groups And Permissions

Minimum groups:

| Group | Access |
|---|---|
| `tds-admins` | Full workspace admin. |
| `tds-ops` | Migration, reports, backup evidence, operations docs. |
| `tds-content` | Client docs, content drafts, approved/published evidence. |
| `tds-clients-readonly` | Client-specific shared folders only. |
| `tds-guests` | Temporary limited access. |

Permission rules:

- Client users see only their own client folder.
- Backup copies are admin/ops only.
- Access requests are admin only.
- Approval folders use approval workflow, not ad-hoc public links.
- Public links expire and use passwords when shared externally.

## Nextcloud Security Baseline

Required configuration:

- Configure `trusted_domains` for every URL used to access Nextcloud.
- If behind a reverse proxy, configure `trusted_proxies`, `overwriteprotocol`, and `overwrite.cli.url` correctly.
- Use HTTPS only.
- Use production cron/background jobs, not AJAX background jobs.
- Keep the app store enabled only for admins who need it.
- Enable apps by group when possible.
- Disable user-managed external storage unless there is a controlled reason.
- Keep Nextcloud admin accounts separate from normal user accounts.
- Enable MFA for admin users.
- Review sharing settings before adding client users.

Official docs references already checked:

- `trusted_domains` in `config.php`.
- Reverse proxy settings: `trusted_proxies`, `overwriteprotocol`, `overwritewebroot`, `overwrite.cli.url`.
- Production background jobs with cron.
- Maintenance mode for consistent backups.
- External Storage app via `occ app:enable files_external`.
- Apps can be enabled for specific groups with `occ app:enable <app> --groups=<group>`.

## Backup Copy Workflow

Nextcloud can hold secondary copies of backup artifacts, not the only backup.

Source of truth:

- Production database backups remain in `/mnt/kivo/backups` and offsite encrypted storage.

Nextcloud copy purpose:

- Human-accessible migration evidence.
- Restore-test reports.
- Selected backup copies for emergency visibility.
- Client/report exports.

Rules:

- Do not expose backup folders publicly.
- Do not store `.env` files in Nextcloud.
- Do not store raw private keys in Nextcloud.
- If database dumps are copied into Nextcloud, restrict them to `tds-admins` and `tds-ops` only.
- Prefer encrypted offsite backups for disaster recovery; Nextcloud is not the only DR layer.

## Operations Checklist

Daily:

- Confirm Nextcloud login works.
- Confirm storage has free space.
- Confirm no suspicious public shares exist.

Weekly:

- Review Nextcloud app updates.
- Review user list and guest accounts.
- Review public links and external shares.
- Confirm backup evidence folder was updated.

Monthly:

- Patch Nextcloud and apps during a maintenance window.
- Review admin accounts and MFA.
- Review group permissions.
- Test restoring at least one backup from the primary backup system.
- Confirm Nextcloud is not the only location of any critical data.

## What I Can Do With Access

Once safe access is available, the work is:

1. Lock down public TrueNAS UI exposure.
2. Confirm TrueNAS and Nextcloud versions.
3. Configure Nextcloud trusted domains and reverse proxy settings.
4. Install the recommended apps.
5. Create groups and Team Folders.
6. Configure permissions and sharing policy.
7. Set cron/background jobs for production.
8. Create the Kivo Geo folder structure.
9. Configure backup-copy workflow for selected artifacts.
10. Document final URLs, apps, groups, and operating rules.

## Access Rules

Do not paste secrets in chat.

Use one of these access methods:

- Temporary admin account.
- Tailscale/VPN.
- Cloudflare Access.
- Temporary SSH key for server access.
- Commands generated here while the user enters secrets locally.
