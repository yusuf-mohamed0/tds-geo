#!/usr/bin/env bash
set -euo pipefail

# Safe Kivo artifact sync to Nextcloud/WebDAV.
# Required env:
#   NEXTCLOUD_URL=https://cloud.trafficdigitalsolutions.com
#   NEXTCLOUD_USER=traffic
#   NEXTCLOUD_PASSWORD=...   # app password preferred
# Optional env:
#   NEXTCLOUD_REMOTE_DIR=Kivo/traffic
#   ADS_REPORTING_PROJECT=/root/tds-ads-reporting-automation
#   INCLUDE_SANITIZED_DB=true
#   KIVO_COMPOSE_DIR=/opt/kivo/deploy/truenas

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="${TMPDIR:-/tmp}/kivo-nextcloud-sync-${STAMP}"
STAGE_DIR="$WORK_DIR/kivo-${STAMP}"
ARCHIVE="$WORK_DIR/kivo-${STAMP}.tar.gz"
MANIFEST="$WORK_DIR/manifest-${STAMP}.txt"
REMOTE_DIR="${NEXTCLOUD_REMOTE_DIR:-Kivo/traffic}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: $name" >&2
    exit 1
  fi
}

copy_if_exists() {
  local source="$1"
  local target="$2"
  if [[ -e "$source" ]]; then
    mkdir -p "$(dirname "$target")"
    cp -a "$source" "$target"
  fi
}

upload_file() {
  local file="$1"
  local name="$2"
  local root="${NEXTCLOUD_URL%/}/remote.php/dav/files/${NEXTCLOUD_USER}"
  local base="$root"
  IFS='/' read -ra parts <<< "$REMOTE_DIR"
  for part in "${parts[@]}"; do
    [[ -n "$part" ]] || continue
    base="$base/$part"
    curl -fsS -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASSWORD}" -X MKCOL "$base" >/dev/null 2>&1 || true
  done
  curl -fsS -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASSWORD}" -T "$file" "$base/$name" >/dev/null
}

make_sanitized_db_export() {
  [[ "${INCLUDE_SANITIZED_DB:-false}" == "true" ]] || return 0
  mkdir -p "$STAGE_DIR/database"

  local query="\copy (select id, name, slug, shopify_shop, brand_voice, service_area, timezone, approval_mode, is_active, created_at, updated_at from clients) to stdout with csv header;"
  local out="$STAGE_DIR/database/clients-sanitized.csv"

  if [[ -n "${DATABASE_URL:-}" ]] && command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -c "$query" > "$out"
    return 0
  fi

  local compose_dir="${KIVO_COMPOSE_DIR:-$ROOT_DIR/deploy/truenas}"
  if [[ -f "$compose_dir/compose.yml" ]] && command -v docker >/dev/null 2>&1; then
    # shellcheck disable=SC1091
    source "$compose_dir/.env"
    (cd "$compose_dir" && docker compose --env-file .env -f compose.yml exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "$query") > "$out"
    return 0
  fi

  echo "Sanitized DB export requested but neither psql DATABASE_URL nor Docker compose DB access is available." >&2
}

require_env NEXTCLOUD_URL
require_env NEXTCLOUD_USER
require_env NEXTCLOUD_PASSWORD

mkdir -p "$STAGE_DIR"

copy_if_exists "$ROOT_DIR/doc/clients" "$STAGE_DIR/doc/clients"
copy_if_exists "$ROOT_DIR/doc/DASHBOARD.md" "$STAGE_DIR/doc/DASHBOARD.md"
copy_if_exists "$ROOT_DIR/doc/ADS-REPORTING-READINESS.md" "$STAGE_DIR/doc/ADS-REPORTING-READINESS.md"
copy_if_exists "$ROOT_DIR/doc/clients/APP-PROCESSES.md" "$STAGE_DIR/doc/clients/APP-PROCESSES.md"
copy_if_exists "$ROOT_DIR/outputs" "$STAGE_DIR/outputs"
copy_if_exists "$ROOT_DIR/reports" "$STAGE_DIR/reports"

if [[ -d "${ADS_REPORTING_PROJECT:-/root/tds-ads-reporting-automation}/reports" ]]; then
  copy_if_exists "${ADS_REPORTING_PROJECT:-/root/tds-ads-reporting-automation}/reports" "$STAGE_DIR/ads-reporting/reports"
fi

make_sanitized_db_export

find "$STAGE_DIR" \
  \( -name '.env' -o -name '*.pem' -o -name '*.key' -o -name '*token*' -o -name 'clients.yaml' -o -path '*/credential_vault*' \
     -o -name 'technical-reference.md' -o -name 'contacts.md' -o -name 'full-profile.md' -o -name 'brand-profile.md' \) \
  -print -delete > "$WORK_DIR/excluded-sensitive-files.txt"

(cd "$STAGE_DIR" && find . -type f | sort) > "$MANIFEST"
cp "$MANIFEST" "$STAGE_DIR/MANIFEST.txt"
tar -C "$WORK_DIR" -czf "$ARCHIVE" "$(basename "$STAGE_DIR")"

upload_file "$ARCHIVE" "$(basename "$ARCHIVE")"
upload_file "$MANIFEST" "$(basename "$MANIFEST")"

echo "nextcloud_sync_ok archive=$(basename "$ARCHIVE") manifest=$(basename "$MANIFEST") remote=${REMOTE_DIR}"
