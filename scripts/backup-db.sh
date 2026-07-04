#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
# ══════════════════════════════════════════════════════════════════
# TDS Geo — Database Backup Script
#
# Creates PostgreSQL dumps with rotation.
# Supports local storage and optional S3 upload.
#
# Setup:
#   1. chmod +x scripts/backup-db.sh
#   2. Set env vars or create .env.backup:
#        BACKUP_DIR=/var/backups/tds-geo
#        DB_URL=postgresql://user:pass@localhost:5432/ai_seo_automation
#        AWS_ACCESS_KEY_ID=xxx          # optional
#        AWS_SECRET_ACCESS_KEY=xxx      # optional
#        S3_BUCKET=s3://tds-geo-backups # optional
#   3. Add cron: 0 3 * * * /opt/tds-geo/scripts/backup-db.sh
# ══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config ─────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load backup-specific env if present
if [[ -f "$PROJECT_DIR/.env.backup" ]]; then
  set -a
  source "$PROJECT_DIR/.env.backup"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/tds-geo}"
DB_URL="${DB_URL:-${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ai_seo_automation}}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/tds-geo_${TIMESTAMP}.dump"
LATEST_LINK="${BACKUP_DIR}/tds-geo_latest.dump"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ─── Ensure backup directory exists ─────────
mkdir -p "$BACKUP_DIR"

# ─── Log function ───────────────────────────
log() {
  local level="$1"
  shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] $*" | tee -a "$LOG_FILE"
}

# ─── Pre-flight checks ──────────────────────
if ! command -v pg_dump &>/dev/null; then
  log "ERROR" "pg_dump not found. Install postgresql-client."
  exit 1
fi

# Test DB connection
if ! pg_isready -d "$DB_URL" &>/dev/null; then
  log "ERROR" "Cannot connect to database. Check DB_URL."
  exit 1
fi

# ─── Create backup ──────────────────────────
log "INFO" "Starting backup to ${BACKUP_FILE}"

# Use custom format (compressed, parallel-capable)
pg_dump "$DB_URL" \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_FILE" \
  --verbose \
  --no-owner \
  --no-privileges 2>> "$LOG_FILE"

# Check backup integrity
pg_restore --list "$BACKUP_FILE" &>/dev/null || {
  log "ERROR" "Backup integrity check failed"
  rm -f "$BACKUP_FILE"
  exit 1
}

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
log "INFO" "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Update latest symlink ──────────────────
ln -sf "$BACKUP_FILE" "$LATEST_LINK"

# ─── Optional: upload to S3 ─────────────────
if [[ -n "${S3_BUCKET:-}" ]] && [[ -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
  if command -v aws &>/dev/null; then
    log "INFO" "Uploading to S3: ${S3_BUCKET}/"
    aws s3 cp "$BACKUP_FILE" "${S3_BUCKET}/$(date +%Y/%m/%d)/tds-geo_${TIMESTAMP}.dump" \
      --storage-class STANDARD_IA 2>> "$LOG_FILE"
    log "INFO" "S3 upload complete"
  else
    log "WARN" "AWS CLI not found — skipping S3 upload"
  fi
else
  log "INFO" "S3 not configured — skipping cloud upload"
fi

# ─── Rotate old backups ─────────────────────
log "INFO" "Rotating backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'tds-geo_*.dump' -type f -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -name 'tds-geo_*.dump' -type f | sort | head -n -14 | while read -r old; do
  rm -f "$old"
  log "INFO" "Removed old backup: ${old}"
done

# ─── Summary ────────────────────────────────
TOTAL_BACKUPS="$(find "$BACKUP_DIR" -name 'tds-geo_*.dump' -type f | wc -l)"
TOTAL_SIZE="$(du -sh "$BACKUP_DIR" | cut -f1)"
log "INFO" "Backup complete. Total backups: ${TOTAL_BACKUPS}, total size: ${TOTAL_SIZE}"
