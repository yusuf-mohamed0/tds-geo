#!/usr/bin/env bash
set -euo pipefail

# ─── Database Backup ───────────────────────────────────────
# Usage: ./scripts/db-backup.sh [--s3] [--rotate N]
#   --s3       Upload to S3 after backup
#   --rotate N Keep only N local backups (default: 7)
# ──────────────────────────────────────────────────────────

BACKUP_DIR="/tmp/tdsgeo-backups"
S3_BUCKET="${S3_BUCKET:-tdsgeo-backups}"
RETENTION="${2:-7}"
UPLOAD_S3=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --s3) UPLOAD_S3=true ;;
    --rotate) RETENTION="$2"; shift ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
  shift
done

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="tdsgeo-${TIMESTAMP}.dump"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

echo "=== Database Backup ==="

# Get database URL from env or Docker
if command -v docker &>/dev/null && docker compose ps postgres 2>/dev/null | grep -q "Up"; then
  echo "Using Docker postgres..."
  docker compose exec -T postgres pg_dump -U postgres -d ai_seo_automation -F c -f "/tmp/${FILENAME}"
  docker compose cp "postgres:/tmp/${FILENAME}" "$FILEPATH"
else
  echo "Using local postgres..."
  DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ai_seo_automation}"
  pg_dump "$DATABASE_URL" -F c -f "$FILEPATH"
fi

# Compress
gzip "$FILEPATH"
GZIPPED="${FILEPATH}.gz"
SIZE=$(du -h "$GZIPPED" | cut -f1)
echo "  ✅ Backup: $GZIPPED ($SIZE)"

# Upload to S3
if $UPLOAD_S3; then
  if command -v aws &>/dev/null; then
    aws s3 cp "$GZIPPED" "s3://${S3_BUCKET}/postgres/${FILENAME}.gz" --no-progress
    echo "  ✅ Uploaded to s3://${S3_BUCKET}/postgres/${FILENAME}.gz"
  else
    echo "  ⚠️  AWS CLI not found, skipping S3 upload"
  fi
fi

# Rotate old backups
if [[ "$RETENTION" -gt 0 ]]; then
  ls -t "$BACKUP_DIR"/*.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | while read -r old; do
    rm -f "$old"
    echo "  🗑️  Removed old backup: $(basename "$old")"
  done
fi

echo "=== Backup complete ==="
