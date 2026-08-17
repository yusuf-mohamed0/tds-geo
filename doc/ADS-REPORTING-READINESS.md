# Meta And Google Ads Reporting Readiness

Last updated: 2026-08-17

## Status

Kivo Geo is production-ready for SEO/content operations, client publishing workflows, cost tracking, partial Google Search Console backend work, and the internal paid-ads reporting control plane.

The paid ads reporting worker lives in the separate local project:

```text
/root/tds-ads-reporting-automation
```

Kivo Geo owns the admin control plane at `/admin/ads-reports` and `/api/ads-reports`. The local Python project remains the specialized worker that fetches platform data and renders PDFs. Kivo Geo calls it for dry-runs and internal PDF generation without exposing secrets and without sending client emails.

## What Exists Today

In `/root/tds-geo`:

- Monthly SEO/content reporting via `scripts/monthly-ops.mjs`.
- Client content and publishing plans in `doc/clients/`.
- Google Search Console backend/database routes and services.
- Admin dashboard and sidebar entry for Ads Reports.
- `/api/ads-reports/status` exposes runner health, configured clients, internal PDFs, strict roles, and review gates.
- `/api/ads-reports/:clientId/dry-run` checks a report run without fetching/writing.
- `/api/ads-reports/:clientId/generate` generates an internal PDF through the local runner with no email flag.
- Secrets remain in the local reporting runner `.env`; Kivo Geo never returns token values in API responses.

In `/root/tds-ads-reporting-automation`:

- `README.md` and `docs/` with requirements, architecture, API setup, report template, QA, operations, and monthly automation runbook.
- `src/tds_ads_reporting/app.py` CLI with `run`, `run-all`, and `cache-list` commands.
- `src/tds_ads_reporting/meta/ads.py` for Meta Ads campaign insights.
- `src/tds_ads_reporting/meta/page.py` for Facebook Page and Instagram metrics.
- `src/tds_ads_reporting/google_ads/ads.py` for Google Ads GAQL campaign metrics.
- `templates/report.html.j2` and `reporting/pdf.py` for PDF rendering.
- `manual_inputs/lodge_2026-03.yaml` and `reports/lodge_2026-03.pdf` as a reference/sample path.
- `configs/clients.example.yaml` showing required per-client mappings.

## Required Before Real Monthly Reports

Paid ads reports cannot be treated as fully ready until these items are filled and validated:

- Real `/root/tds-ads-reporting-automation/configs/clients.yaml` for all active reporting clients.
- Meta Business Manager admin access.
- Meta Developer app owned by the business.
- Meta Marketing API access with a System User token or user token assigned to the needed assets.
- Meta permissions covering ads, pages, Instagram insights, and messaging metrics where needed.
- Per-client Meta ad account IDs in `act_<ID>` format.
- Per-client Facebook Page IDs and Instagram Business Account IDs for full Business Suite-style reports.
- Google Ads MCC access to client accounts.
- Google Ads API developer token.
- Google Ads OAuth client ID, client secret, refresh token, and login customer ID.
- Per-client Google Ads customer IDs.
- Per-client conversion action mapping for leads, messages, purchases, calls, traffic, and awareness.
- Manual monthly inputs: budget, VAT, remaining budget, report scope, insights, and recommendations.
- Email sending credentials for `reports@trafficdigitalsolutions.com` via Gmail API or SMTP app password.
- First-client data QA against Meta UI and Google Ads UI for the same date range and attribution settings.

## Current Verification Notes

The separate reporting repo was checked from `/root/tds-ads-reporting-automation`.

- The credential file at `/root/my-project/meta things/meta ` was inspected as secret material. Secret values must not be committed or printed.
- Meta app ID and app secret are present.
- One user token is valid, has `read_insights` and `ads_read`, and can list many ad accounts.
- One system-user token is valid and has broader scopes, including page and Instagram-related scopes, but currently lists no assigned ad accounts or pages.
- One user token is expired and should not be used.
- A local, gitignored `.env` was created in `/root/tds-ads-reporting-automation` from the valid tokens.
- A local `configs/clients.yaml` was created for confirmed Meta ad accounts only:
  - `alamein-2022` -> `act_272954367455662`
  - `caravanserai` -> `act_326559196172852`
- Dry-runs passed for `alamein-2022` and `caravanserai` for `2026-07`.
- No-email Meta Ads PDF generation succeeded:
  - `/root/tds-ads-reporting-automation/reports/alamein-2022_2026-07.pdf`
  - `/root/tds-ads-reporting-automation/reports/caravanserai_2026-07.pdf`
- Tests now pass with `PYTHONPATH=src .venv/bin/python -m pytest`: 13 passed, 3 warnings.

This means Meta Ads-only PDF generation is working for the two confirmed accounts above, both directly through the runner and through the Kivo Geo service wrapper. Full Business Suite reporting is not complete until page and Instagram assets are assigned and mapped. Google Ads reporting is not complete until Google Ads API credentials and customer IDs are provided.

## Company Operating Roles

Kivo Geo exposes the reporting process as one company workflow with strict internal roles:

- CEO / final approver: approves internal PDFs before any email leaves the company.
- Ads analyst: runs Meta and Google data pulls, checks spend, results, CTR, CPC, and campaign tables.
- Data QA reviewer: compares generated figures against platform UI for the same month and attribution settings.
- Account manager: adds budget, VAT, scope, insights, recommendations, and client-safe narrative.
- Automation operator: runs dry-runs, generates internal PDFs, and records failures without exposing secrets.

Review gates enforced by policy in the app:

- No report email is sent from Kivo Geo.
- Generated PDFs are internal until CEO/final approval.
- One client failure must not block other client reports.
- Secrets stay in the local reporting runner `.env` and never enter API responses.
- Google Ads reports remain blocked until Google Ads API credentials and customer IDs exist.
- Full Business Suite sections remain blocked until Page and Instagram assets are mapped.

## Safe First Operational Path

Use the reporting automation project externally first. Do not merge it into Kivo Geo until one real monthly cycle is validated.

Recommended sequence:

1. Assign the valid system user to the required Meta ad accounts, Facebook Pages, and Instagram Business accounts, or keep using the valid user token only for temporary internal reporting.
2. Add real page IDs and Instagram Business Account IDs to `configs/clients.yaml` after permissions are confirmed.
3. Add Google Ads API credentials and per-client customer IDs before claiming Google Ads reports are ready.
4. Add `manual_inputs/{client_id}_{YYYY-MM}.yaml` for one pilot client.
5. Compare generated Meta numbers against Meta UI for the same date range and attribution settings.
6. Email only to `reports@trafficdigitalsolutions.com` after internal approval.
7. Batch-run all configured clients only after one-client QA passes.
8. After the first accepted month, decide whether to keep this as a separate local runner or import summaries/PDF paths into Kivo Geo.

## Integration Gap In Kivo Geo

If the paid ads reporting output must appear inside the Kivo Geo admin app, the app still needs:

- A `client_report_runs` table.
- A `report_exports` table for generated PDF paths/status.
- Optional raw/normalized ads metric tables if Kivo Geo becomes the data store.
- A reports API route.
- A monthly reports admin page.
- A safe import job from `/root/tds-ads-reporting-automation/reports` and its SQLite/cache output.

Until then, Kivo Geo should treat paid ads reports as an internal control-plane process backed by a specialized local worker.
