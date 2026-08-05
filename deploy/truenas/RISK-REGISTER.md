# TrueNAS Migration Risk Register

This file tracks project risks that can prevent a clean migration or stable local production operation.

| Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---:|---|---|
| Local internet outage | Public app unavailable | Medium | Cloudflare monitoring, ISP plan, AWS rollback during migration, offsite restore option after migration | Infrastructure Architect |
| Power outage | Server down or data corruption risk | Medium | UPS, graceful shutdown, ZFS, tested backups | Infrastructure Architect |
| Database backup failure | Data loss during deploy or recovery | Medium | Fail deploy on backup failure, daily backup monitor, restore tests | Database Steward |
| PostgreSQL corruption | Production data unavailable | Low | Logical dumps, ZFS snapshots, offsite backups, restore procedure | Database Steward |
| TrueNAS pool degradation | Data at risk | Medium | Redundant pool, SMART alerts, spare drive plan, offsite backups | Infrastructure Architect |
| Self-hosted runner compromise | Production VM compromise | Low | Private runner, no untrusted PR workflows, limited deploy user, token rotation | Security Operator |
| Secret exposure | Account or client compromise | Medium | No secrets in git, rotation triggers, provider-side revocation, secret inventory by name | Security Operator |
| Shopify URL mismatch | Embedded app or OAuth broken | Medium | Staging validation, exact redirect URL checklist, rollback URL plan | Shopify Integration Owner |
| Webhooks not updated | Uninstall/privacy/billing events missed | Medium | Re-register webhooks during cutover, verify deliveries | Shopify Integration Owner |
| Direct ports exposed | Attack surface increase | Medium | Prefer Cloudflare Tunnel, firewall review, no DB/Redis/Docker/VNC exposure | Security Operator |
| Backups stored only locally | Total data loss after theft/fire | Medium | Offsite encrypted backup requirement | Database Steward |
| Hardware under-sized | Slow app, failed jobs, DB pressure | Medium | Minimum/recommended specs, monitor CPU/RAM/disk, adjust VM resources | Infrastructure Architect |
| Sidecar image instability | Crawling or SEO tools fail | Medium | Keep sidecars optional, use profiles, validate before enabling | Deployment Engineer |
| Deploy script regression | Failed or unsafe deploys | Low | Local Compose config validation, pre-commit checks, healthcheck gate | Deployment Engineer |
| AWS shut down too early | No easy rollback | Medium | Keep AWS online for 1-2 weeks and require approval before shutdown | Project Manager |

## Highest Priority Controls

1. Keep AWS rollback available through the rollback window.
2. Fail production deploys when backup fails.
3. Monitor backup freshness.
4. Prefer Cloudflare Tunnel instead of public port forwarding.
5. Rotate any credential already exposed outside secure storage.
6. Test restore before cutover.
7. Verify Shopify app URLs and webhooks after cutover.
