#!/usr/bin/env bash
set -euo pipefail

# Apply pending backend/database/migration_*.sql files against the postgres
# container. Tracks applied files in a schema_migrations ledger table so each
# migration runs exactly once in filename order. All migration files are
# written idempotently (IF NOT EXISTS / IF EXISTS), so re-running is safe.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEPLOY_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

DB_USER="${DB_USER:?DB_USER is required}"
DB_NAME="${DB_NAME:?DB_NAME is required}"
MIGRATION_DIR="${MIGRATION_DIR:-$DEPLOY_DIR/../../backend/database}"

if [[ ! -d "$MIGRATION_DIR" ]]; then
  echo "Migration directory $MIGRATION_DIR not found; skipping DB migrations."
  exit 0
fi

psql_cmd() {
  docker compose --env-file .env -f compose.yml exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -qAt
}

if ! docker compose --env-file .env -f compose.yml ps postgres 2>/dev/null | grep -q postgres; then
  echo "Postgres container is not running; skipping DB migrations."
  exit 0
fi

echo "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW());" | psql_cmd

applied=0
for migration in "$MIGRATION_DIR"/migration_*.sql; do
  [[ -e "$migration" ]] || continue
  name="$(basename "$migration")"
  already="$(echo "SELECT 1 FROM schema_migrations WHERE filename = '$name';" | psql_cmd)"
  if [[ "$already" == "1" ]]; then
    continue
  fi
  echo "Applying $name ..."
  if docker compose --env-file .env -f compose.yml exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$migration" >/dev/null; then
    echo "INSERT INTO schema_migrations (filename) VALUES ('$name');" | psql_cmd >/dev/null
    applied=$((applied + 1))
  else
    echo "Migration $name FAILED; aborting deploy." >&2
    exit 1
  fi
done

echo "db_migrations_applied=$applied"
