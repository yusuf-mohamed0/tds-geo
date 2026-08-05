#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEPLOY_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/mnt/tds-geo/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/tds-geo_${TIMESTAMP}.dump"
LATEST_LINK="${BACKUP_DIR}/tds-geo_latest.dump"

mkdir -p "$BACKUP_DIR"

if ! docker compose --env-file .env -f compose.yml ps postgres 2>/dev/null | grep -q postgres; then
  echo "Postgres container is not running; skipping backup."
  exit 0
fi

docker compose --env-file .env -f compose.yml exec -T postgres \
  pg_dump -U "${DB_USER}" -d "${DB_NAME}" --format=custom --compress=9 --no-owner --no-privileges \
  > "$BACKUP_FILE"

pg_restore --list "$BACKUP_FILE" >/dev/null
ln -sf "$BACKUP_FILE" "$LATEST_LINK"

find "$BACKUP_DIR" -name 'tds-geo_*.dump' -type f -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -name 'tds-geo_*.dump' -type f | sort | head -n -20 | xargs -r rm -f

echo "backup_ok $BACKUP_FILE"
