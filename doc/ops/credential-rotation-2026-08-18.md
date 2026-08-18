# Credential Rotation Runbook — 2026-08-18

## Context
Two Kivo Geo API keys were exposed in source and a Nextcloud sync archive:
- boston-pharma: `kai_021761d9b88ecca6842877e5bdc651b794024a08fc8d09e1` (LEAKED — REVOKED)
- boston-vet: `kai_46f0d5d6cf30f13fd45463d8082e645323ead5c731b1b58f` (LEAKED — REVOKED)

Source scrub committed (`3f2fce3`), prod deploy fixed + rotated (`370a7bb`, `7d95551`).

## TDS side — COMPLETE
New keys generated (kai_ + 48 hex) and stored at:
`/root/my-project/local-credentials/kivo-rotation.env` (chmod 600)

Prod updated via API:
- `credential_vault` — both "TDS Geo API Key" entries (ids below) re-encrypted under current prod key, decrypt OK (52 chars)
- `api_keys` — new rows created (ids below)

| Client | clientId | vault entry id | api_key id |
|---|---|---|---|
| boston-pharma | `6554060c-3618-485f-b705-1c69c10b524c` | `c0b103f3-89f1-4dd2-b7ea-ebc7965799ea` | `c306273b-fad5-4457-bf86-002fb41e46b6` |
| boston-vet | `74a7bf73-315f-4ad5-a5ec-f4f1ba4ecd8d` | `777ae628-e6b1-4bbd-a108-1ab72db41b73` | `318436fc-03f3-47bf-ae37-691e727dbafd` |

## WP side — REQUIRED (external)
The Kivo Geo plugin on each client site validates `X-Kivo-Key`. The new keys are NOT yet accepted (verified: boston-pharma `/wp-json/kivo/v1/posts` → 404, boston-vet → 403 Cloudflare bot-block). Provisioning steps per client:

1. **boston-pharma.com** — log into `https://boston-pharma.com/wp-admin`
   - Kivo Geo → Settings/API Keys → replace the API key with the new boston-pharma value from `kivo-rotation.env`
   - Save; confirm a test call returns 200 (see Verification below)
2. **boston-vet.com** — log into `https://boston-vet.com/wp-admin`
   - Cloudflare bot protection currently blocks API probes (403); whitelist the integration UA/IP or use an Application Password
   - Kivo Geo → Settings/API Keys → replace with the new boston-vet value
   - Save; confirm test call returns 200

## Consumer env
Wherever content scripts run (operator machines, cron), set:
```
export BOSTON_PHARMA_API_KEY=<new boston-pharma key>
export BV_API_KEY=<new boston-vet key>
```
Scripts already read these (no hardcoded fallbacks). If previously automated via other env names, update those runners.

## Verification
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://boston-pharma.com/wp-json/kivo/v1/posts?per_page=1" \
  -H "X-Kivo-Key: $BOSTON_PHARMA_API_KEY"      # expect 200
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://boston-vet.com/wp-json/kivo/v1/posts?per_page=1" \
  -H "X-Kivo-Key: $BV_API_KEY"                 # expect 200 (may need CF whitelist)
```

## Old keys
REVOKED: do not reuse. If any consumer still holds the old values, they will fail after the WP-side swap; update them to the new keys.

## Known issue (pre-existing)
`GET /api/vault/:id` decrypts to empty for entries created before this rotation (import ran under a different CREDENTIAL_VAULT_KEY). Rotated entries now decrypt OK. Follow-up: re-import/re-encrypt legacy vault entries under the current key.

## Nextcloud: swap master password for an app password (DONE 2026-08-18)
Sync script uses WebDAV basic auth (`remote.php/dav/files/traffic`); app password works transparently. No OCS API exists to create app passwords; created via web UI (headless Chromium via Playwright 1.60, module resolved from n8n's global deps).

App password created:
- Name: `kivo-sync-2026-08-18`
- Stored in /root/my-project/local-credentials/nextcloud.env as NEXTCLOUD_USER/NEXTCLOUD_PASSWORD (file 0600). Login is `traffic`; the password is the 29-char app token (shown once at creation).
- Verification: PROPFIND `/remote.php/dav/files/traffic/` → HTTP 207; `scripts/sync-nextcloud-safe.sh` ran clean → uploaded `kivo-20260818T091020Z.tar.gz` to `Kivo/traffic/`.

Notes for future headless runs:
- Login URL is `/index.php/login` (bare `/login` is 404). App-password creation form is `#generate-app-token-section`; creation requires a password-confirm dialog (`input[type=password]` + Confirm). Result token lives in the `New app password` modal (`.token-dialog__name input`, `.token-dialog__password input`).
- Web UI login requires the master password — app passwords only authenticate API/WebDAV, not the browser UI.
- Revoking a token requires clicking the row's Device-settings menu → Revoke → confirm, then re-authenticate in the "Authentication required" dialog.

Orphaned test tokens created during automation (ids 821, 823, 825, 827) were revoked. Only `kivo-sync-2026-08-18` remains.

Master password (`Lucky@2024`, in Next cloude/credintials backup) no longer used by the sync path; keep as web-UI login only.
