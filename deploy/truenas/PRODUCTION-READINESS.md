# TrueNAS Production Readiness Plan

This is the manager-level plan for deciding when the TrueNAS/local-server migration is ready for production.

## Success Definition

The migration is successful when Kivo Geo runs from the TrueNAS Ubuntu VM with no critical production regressions, no private services exposed publicly, verified backups, working Shopify integrations, and a documented rollback path to AWS.

## Production Readiness Gates

| Gate | Owner | Evidence Required | Status |
|---|---|---|---|
| Hardware ready | Infrastructure Architect | TrueNAS pool healthy, UPS plan, VM resources allocated | Pending until installed |
| Security ready | Security Operator | Firewall checked, Cloudflare Tunnel or HTTPS confirmed, no private services exposed | Pending until installed |
| Data ready | Database Steward | First restore tested, final dump plan approved, restore test recorded | Pending until migration test |
| App ready | Deployment Engineer | Compose stack healthy, `/health` 200, worker running, backups running | Pending until VM deploy |
| Shopify ready | Shopify Integration Owner | App URL, redirects, embedded load, webhooks, active store tokens verified | Pending until staging URL |
| Operations ready | Operations Auditor | Monitoring checks, daily/weekly runbook, incident contacts, rollback owner defined | Pending until handoff |
| Business ready | Project Manager | Cutover window, freeze window, rollback window, client impact accepted | Pending approval |

## Required Environments

| Environment | Purpose | Required Before Cutover |
|---|---|---|
| AWS production | Current stable production and rollback source | Yes |
| TrueNAS staging hostname | Test migrated app before switching production URLs | Yes |
| TrueNAS production hostname | Final public app URL | Yes |
| Local developer machine | Edit, test, commit, push | Yes |

## Manager Cutover Timeline

1. Build TrueNAS VM and deploy the stack with a staging hostname.
2. Copy an AWS database dump to TrueNAS and validate with staging traffic only.
3. Fix any staging issues before scheduling the cutover.
4. Announce a write freeze window.
5. Take the final AWS database dump during the freeze.
6. Restore the final dump on TrueNAS.
7. Update DNS, Cloudflare, Shopify app URLs, redirect URLs, and webhooks.
8. Run launch checklist and health validation.
9. Monitor for 30-60 minutes immediately after cutover.
10. Keep AWS online for 1-2 weeks as rollback.

## Acceptance Criteria

Production can move only when all of these are true:

- `docker compose --env-file .env -f compose.yml config` passes on the VM.
- `scripts/deploy.sh` completes without backup, pull, startup, or healthcheck failure.
- GitHub runner sync preserves VM-local `deploy/truenas/.env`.
- `scripts/healthcheck.sh` passes.
- Public `/health` returns 200 through the active public URL.
- PostgreSQL and Redis are healthy and not publicly exposed.
- A pre-cutover backup exists and has passed `pg_restore --list`.
- A restore test has been performed before final cutover.
- Active client audit has no critical errors.
- Shopify embedded app opens on the final hostname.
- Active Shopify store tokens validate against `shop.json`.
- Shopify app URL and redirect URLs match the final public hostname.
- Webhooks are updated or re-registered for the final public hostname.
- No live publishing is triggered during validation unless explicitly approved.
- AWS rollback path is available.
- The person approving rollback is known before cutover starts.

## Non-Negotiables

- Do not cut over without a verified database backup.
- Do not expose TrueNAS UI, PostgreSQL, Redis, Docker API, VNC, RDP, `.env`, runner folders, or backups publicly.
- Do not shut down AWS until the rollback window is complete.
- Do not run production from an undocumented manual state.
- Do not store real secrets in git.
- Do not run untrusted pull-request code on the production self-hosted runner.

## Open Items Before Real Hardware Cutover

| Item | Why It Matters | Owner |
|---|---|---|
| Confirm exact TrueNAS SCALE version | Apps, VM, and Docker behavior varies by version | Infrastructure Architect |
| Confirm hardware specs and UPS | Prevent under-sizing and unsafe power loss | Infrastructure Architect |
| Confirm public ingress mode | Cloudflare Tunnel and direct HTTPS have different firewall rules | Security Operator |
| Confirm domain names | Shopify and OAuth URLs must be exact | Shopify Integration Owner |
| Confirm offsite backup destination | Local server loss must not mean data loss | Database Steward |
| Confirm cutover window | Avoid changing production during active client work | Project Manager |
| Rotate previously exposed credentials | Past exposure must be handled outside git | Security Operator |

## Definition Of Done

The migration project is done when:

- TrueNAS is serving production traffic.
- AWS has remained available through the agreed rollback window.
- Backups and restore tests are documented.
- Daily and weekly operations are documented and assigned.
- All active client integrations are verified.
- DNS, Shopify URLs, and webhooks point to TrueNAS.
- AWS resources are intentionally decommissioned or retained with a documented reason.
