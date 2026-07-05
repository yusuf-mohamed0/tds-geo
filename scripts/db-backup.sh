#!/usr/bin/env bash
set -euo pipefail

# Database Backup Script — TDS Geo / AI SEO Automation
# Usage: ./scripts/db-backup.sh [--s3] [--local]
# Runs pg_dump, rotates backups, optionally uploads to S3
# Add to crontab: 0 3 * * * /path/to/scripts/db-backup.sh --s3

BACKUP_DIR="${BACKUP_DIR:-/data/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_NAME="${PGDATABASE:-tds_geo}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"
S3_BUCKET="${S3_BUCKET:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
LATEST_LINK="${BACKUP_DIR}/latest.sql.gz"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Starting backup of $DB_NAME..."

pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-owner \
  --no-acl \
  --verbose \
  2>/dev/null | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Update latest symlink
ln -sf "$BACKUP_FILE" "$LATEST_LINK"

# Rotate old backups
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+$RETENTION_DAYS" -delete
log "Rotated backups older than $RETENTION_DAYS days"

# Optional S3 upload
if [ -n "$S3_BUCKET" ]; then
  if command -v aws &>/dev/null; then
    aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/postgres/${DB_NAME}_${TIMESTAMP}.sql.gz" --only-show-errors
    log "Uploaded to s3://${S3_BUCKET}/postgres/"
  else
    log "WARNING: aws CLI not found, skipping S3 upload"
  fi
fi

# Verify backup integrity
if command -v gzip &>/dev/null; then
  if gzip -t "$BACKUP_FILE" 2>/dev/null; then
    log "Backup integrity check: PASSED"
  else
    log "ERROR: Backup integrity check FAILED — $BACKUP_FILE is corrupt"
    exit 1
  fi
fi

log "Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"
