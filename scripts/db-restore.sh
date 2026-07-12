#!/usr/bin/env bash
set -euo pipefail

# ─── Database Restore ──────────────────────────────────────
# Usage: ./scripts/db-restore.sh <backup-file.dump[.gz]>
# ──────────────────────────────────────────────────────────

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.dump[.gz]>"
  echo ""
  echo "Available backups:"
  ls -1 /tmp/tdsgeo-backups/*.gz 2>/dev/null | head -10 || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
  # Try backup dir
  BACKUP_FILE="/tmp/tdsgeo-backups/$1"
  if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "❌ Backup file not found: $1"
    exit 1
  fi
fi

echo "=== Database Restore ==="
echo "  File: $BACKUP_FILE"

# Decompress if gzipped
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "  Decompressing..."
  gunzip -k "$BACKUP_FILE" 2>/dev/null || true
  BACKUP_FILE="${BACKUP_FILE%.gz}"
fi

# Confirm
echo ""
echo "⚠️  WARNING: This will REPLACE the current database!"
echo "  Source: $BACKUP_FILE"
echo "  Target: ${DATABASE_URL:-postgresql://postgres@localhost:5432/ai_seo_automation}"
echo ""
read -r -p "Type 'RESTORE' to continue: " CONFIRM
if [[ "$CONFIRM" != "RESTORE" ]]; then
  echo "Cancelled."
  exit 1
fi

# Restore
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ai_seo_automation}"

if command -v docker &>/dev/null && docker compose ps postgres 2>/dev/null | grep -q "Up"; then
  echo "Restoring via Docker..."
  docker compose cp "$BACKUP_FILE" "postgres:/tmp/restore.dump"
  docker compose exec -T postgres pg_restore -U postgres -d ai_seo_automation --clean --if-exists -F c "/tmp/restore.dump"
else
  echo "Restoring via local psql..."
  pg_restore "$DATABASE_URL" --clean --if-exists -F c "$BACKUP_FILE"
fi

echo "  ✅ Database restored from $(basename "$BACKUP_FILE")"
echo "=== Restore complete ==="
