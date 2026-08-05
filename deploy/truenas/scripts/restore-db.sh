#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/backup.dump"
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEPLOY_DIR"

set -a
source .env
set +a

docker compose --env-file .env -f compose.yml up -d postgres
docker compose --env-file .env -f compose.yml exec -T postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}"

docker compose --env-file .env -f compose.yml exec -T postgres dropdb -U "${DB_USER}" --if-exists "${DB_NAME}"
docker compose --env-file .env -f compose.yml exec -T postgres createdb -U "${DB_USER}" "${DB_NAME}"
docker compose --env-file .env -f compose.yml exec -T postgres pg_restore -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges < "$BACKUP_FILE"

echo "restore_ok $BACKUP_FILE"
