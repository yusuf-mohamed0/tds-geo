# Client App Processes

Last updated: 2026-08-05

This file is the operating index for the production client process layer. Each active client has a dedicated `app-process.md` that defines how TDS Geo should onboard, verify, generate, review, publish, monitor, and recover that client.

## Production Clients

| Client | Slug | Platform | Process | Production Status |
|---|---|---|---|---|
| Alamein Outdoor Furniture | `alamein-2022` | Shopify | `alamein-2022/app-process.md` | Active, Shopify connected |
| Boston Pharmaceutical Industries | `boston-pharma` | WordPress | `boston-pharma/app-process.md` | Active, WordPress REST readable |
| Boston Veterinary Pharmaceutical | `boston-vet` | WordPress | `boston-vet/app-process.md` | Active, blocked from EC2 by WAF/403 |
| Caravanserai | `caravanserai` | Shopify | `caravanserai/app-process.md` | Active, billing status needs correction |
| Flaunt Cosmetics Global | `flaunt-cosmetics-global` | Shopify | `flaunt-cosmetics-global/app-process.md` | Active, Shopify connected |

## Non-Production / Not Active

| Client | Slug | Rule |
|---|---|---|
| Traffic Test | `traffic-test` | Inactive/cancelled; do not generate, schedule, or publish content. |
| Joe's Venture | `joes-venture` | Documented but not present in production DB; do not run app workflows until OAuth/client row exists. |
| Acme Maintenance | `acme-maintenance` | Documentation exists, but production DB row was corrected to inactive Traffic Test; do not run production workflows. |

## Shared Production Process

1. Verify client state with `npm run audit:clients` on `/opt/tds-geo/current`.
2. Confirm the client is active in DB and the platform connector is reachable from production.
3. Read the client `full-profile.md`, `brand-profile.md`, `seo-content-guide.md`, and `technical-reference.md` before content work.
4. Generate only EEAT-compliant, original, source-safe content following `doc/EEAT-content-framework.md`.
5. Keep Shopify content as hidden drafts first. TDS controls scheduling and later visibility.
6. Keep WordPress content in draft/pending review unless publishing credentials and client approval are confirmed.
7. Publish on Thursday 1:00 PM Cairo time unless the client process says otherwise.
8. After publishing, verify live URL, metadata, canonical/indexability, and internal links.
9. Update `doc/DASHBOARD.md`, relevant client notes, and rerun `graphify update .` after code or docs changes.

## Release Checks

Before relying on app automation for any client:

1. Public app health returns `200` at `https://traffic.16.192.29.174.nip.io/health`.
2. `/opt/tds-geo/current/frontend/dist/index.html` exists.
3. Root PM2 process `tds-geo-backend` is online and points to `/opt/tds-geo/current` or the intended release.
4. `npm run audit:clients` has no unsafe pending content findings.
5. Shopify webhook dry-run confirms only real Shopify shops and `app/uninstalled` topic management.
