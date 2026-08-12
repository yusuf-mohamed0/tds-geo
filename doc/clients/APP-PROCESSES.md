# Client App Processes

Last updated: 2026-08-05

This file is the operating index for the production client process layer. Each active client has a dedicated `app-process.md` that defines how Kivo Geo should onboard, verify, generate, review, publish, monitor, and recover that client.

Shared operating roles are in `CONTENT-OPERATING-ROLES.md`. New local drafts are indexed in `DRAFT-ARTICLE-QUEUE.md`. GEO/AEO plans live at `doc/clients/{slug}/geo-aeo-plan.md`.

## Production Clients

| Client | Slug | Platform | Process | Production Status |
|---|---|---|---|---|
| Alamein Outdoor Furniture | `alamein-2022` | Shopify | `alamein-2022/app-process.md` | Active, Shopify token and CMS token verified |
| Boston Pharmaceutical Industries | `boston-pharma` | WordPress | `boston-pharma/app-process.md` | Active, WordPress REST readable |
| Caravanserai | `caravanserai` | Shopify | `caravanserai/app-process.md` | Active, Shopify token verified; billing active |
| Flaunt Cosmetics Global | `flaunt-cosmetics-global` | Shopify | `flaunt-cosmetics-global/app-process.md` | Active, Shopify token verified |

## Non-Production / Not Active

| Client | Slug | Rule |
|---|---|---|
| Traffic Test | `traffic-test` | Inactive/cancelled; do not generate, schedule, or publish content. |
| Boston Veterinary Pharmaceutical | `boston-vet` | Removed from active production clients on 2026-08-05; CMS connection disabled; keep docs for history only. |
| Joe's Venture | `joes-venture` | Documented but not present in production DB; do not run app workflows until OAuth/client row exists. |
| Acme Maintenance | `acme-maintenance` | Documentation exists, but production DB row was corrected to inactive Traffic Test; do not run production workflows. |

## Shared Production Process

1. Verify client state with `npm run audit:clients` on `/opt/kivo/current`.
2. Confirm the client is active in DB and the platform connector is reachable from production.
3. Read the client `full-profile.md`, `brand-profile.md`, `seo-content-guide.md`, `technical-reference.md`, `writer-role.md`, `geo-aeo-plan.md`, and `app-process.md` before content work.
4. Generate only EEAT-compliant, original, source-safe content following `doc/EEAT-content-framework.md` and `CONTENT-OPERATING-ROLES.md`.
5. Keep Shopify content as hidden drafts first. TDS controls scheduling and later visibility.
6. Keep WordPress content in draft/pending review unless publishing credentials and client approval are confirmed.
7. Publish on Thursday 1:00 PM Cairo time unless the client process says otherwise.
8. After publishing, verify live URL, metadata, canonical/indexability, and internal links.
9. Update `doc/DASHBOARD.md`, relevant client notes, and rerun `graphify update .` after code or docs changes.

## Release Checks

Before relying on app automation for any client:

1. Public app health returns `200` at `https://traffic.16.192.29.174.nip.io/health`.
2. `/opt/kivo/current/frontend/dist/index.html` exists.
3. Root PM2 process `kivo-backend` is online and points to `/opt/kivo/current` or the intended release.
4. `npm run audit:clients` has no unsafe pending content findings.
5. Shopify webhook dry-run confirms only real Shopify shops and `app/uninstalled` topic management.

## 2026-08-05 Connector Repair Notes

- Production DB now has publishing-history compatibility fields for Shopify and generic CMS writes.
- Production DB now has a partial unique index enforcing one active CMS connection per client/provider.
- `alamein-2022`, `caravanserai`, and `flaunt-cosmetics-global` CMS Shopify tokens were synchronized from valid client tokens and verified with Shopify Admin `shop.json`.
- `caravanserai` billing is active; 7 items remain pending for review/publishing workflow.
- `boston-vet` was removed from active production clients; do not run publishing workflows for it.
