# Draft Article Queue

Last updated: 2026-08-05

These are local editorial drafts only. They are not scheduled, not published, and not pushed to Shopify or WordPress until each client connector passes production audit and approval is explicit.

Monthly active-client article planning now lives in `ACTIVE-CLIENTS-MONTHLY-CONTENT-PLAN.md`. That file is the required source for this month's 4-article plan per active client and includes each client's brand/style requirements.

## New Drafts Created

| Client | Draft | Status | Publishing Blocker |
|---|---|---|---|
| Alamein Outdoor Furniture | `alamein-2022/articles/commercial-outdoor-furniture-egypt.md` | Shopify hidden draft created: `577305575481`; production CMS token repaired | None for draft creation; deploy route fixes and verify before scheduling |
| Boston Pharmaceutical Industries | `boston-pharma/articles/pharmaceutical-storage-quality-egypt.md` | Local draft | WordPress write credentials/approval must be confirmed |
| Boston Veterinary Pharmaceutical | `boston-vet/articles/poultry-health-program-egypt.md` | Archived local draft | Removed from active clients; do not publish |
| Caravanserai | `caravanserai/articles/layering-brass-wood-textiles-egyptian-home.md` | Local draft, not shared to Shopify | Shopify token and billing active; approval still required |
| Flaunt Cosmetics Global | `flaunt-cosmetics-global/articles/eyeliner-stamp-beginner-guide-uae-egypt.md` | Local draft, not shared to Shopify | Shopify token repaired; approval still required |

## Required Promotion Steps

1. Read the client `writer-role.md`, `seo-content-guide.md`, `geo-aeo-plan.md`, and `app-process.md`.
2. Expand/review draft against `doc/EEAT-content-framework.md` if needed.
3. Run production preflight with `npm run audit:clients`.
4. Confirm connector write access and client approval.
5. Create platform draft only: Shopify hidden draft or WordPress draft/pending review.
6. Verify metadata, summary/excerpt, canonical/live preview, and internal links.
7. Schedule only after approval and blocker clearance.

## Role Coverage

All drafts use `CONTENT-OPERATING-ROLES.md` plus each client writer role. Existing or newly added writer roles are:

| Client | Writer Role |
|---|---|
| Alamein Outdoor Furniture | `alamein-2022/writer-role.md` |
| Boston Pharmaceutical Industries | `boston-pharma/writer-role.md` |
| Boston Veterinary Pharmaceutical | `boston-vet/writer-role.md` (archived) |
| Caravanserai | `caravanserai/writer-role.md` |
| Flaunt Cosmetics Global | `flaunt-cosmetics-global/writer-role.md` |

## GEO/AEO Coverage

Each active production client now has a dedicated GEO/AEO plan:

| Client | GEO/AEO Plan |
|---|---|
| Alamein Outdoor Furniture | `alamein-2022/geo-aeo-plan.md` |
| Boston Pharmaceutical Industries | `boston-pharma/geo-aeo-plan.md` |
| Boston Veterinary Pharmaceutical | `boston-vet/geo-aeo-plan.md` (archived) |
| Caravanserai | `caravanserai/geo-aeo-plan.md` |
| Flaunt Cosmetics Global | `flaunt-cosmetics-global/geo-aeo-plan.md` |

## Monthly Content Generation Automation

The GitHub Actions workflow **Monthly Content Generation** (`.github/workflows/monthly-content-generation.yml`) creates **4 hidden CMS drafts per active client every month** on the first of the month at 03:00 UTC, or on demand via `workflow_dispatch`.

- **Schedule:** cron `0 3 1 * *` (1st of month, 03:00 UTC) on the TrueNAS self-hosted runner (`[self-hosted, Linux, X64, truenas, tdsgeo]`), running inside the `tds-geo-api-1` container.
- **Topics:** live in the committed machine-readable manifest `backend/scripts/monthly-topics.json`. Each month selects the entry where `monthOffset = (UTC year * 12 + UTC month) % 12` (Jan=0 … Dec=11). Topic pools are copied from `ACTIVE-CLIENTS-MONTHLY-CONTENT-PLAN.md`; the 4-topic pool per client repeats across the 12 offsets with a rotating order (offsets 0-3 base, 4-7 order+1, 8-11 order+2) — repeats are expected and the pipeline's semantic-dedup may skip near-duplicates.
- **Runner script:** `scripts/monthly-content-run.mjs`. It reads `process.env.DATABASE_URL`, calls the app's own `POST /api/articles/generate` (admin JWT, always `publish:false`), enforces the internal-marker guard, then uploads hidden drafts via the active `cms_connections` row (Shopify `published:false, published_at:null`; WordPress `status: draft` with `X-Kivo-Key`), and finally re-fetches each article to assert it is hidden. Output is a JSON summary `{ok:true, month, per_client:[{slug, count, articles:[{id,title,handle,published_at,has_image}]}]}`.
- **Dry-run (no writes):** on the runner, run
  `docker exec -i -w /app tds-geo-api-1 node --input-type=module - < scripts/monthly-content-run.mjs --dry-run` (resolves credentials and hits Shopify/WordPress GET only).
- **Force-run:** GitHub → Actions → **Monthly Content Generation** → *Run workflow* (uses the current month's rotation).
- **Verification:** the workflow's final step re-fetches every created article and fails the run (`{ok:false, error}` + exit 1) if any is not hidden.
