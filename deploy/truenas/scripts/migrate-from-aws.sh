#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEPLOY_DIR"

set -a
source .env
set +a

AWS_SSH_HOST="${AWS_SSH_HOST:-16.192.29.174}"
AWS_SSH_USER="${AWS_SSH_USER:-ubuntu}"
AWS_SSH_KEY_PATH="${AWS_SSH_KEY_PATH:-}"
REMOTE_RELEASE="${AWS_RELEASE_PATH:-/opt/tds-geo/current}"
REMOTE_DUMP="/tmp/tds-geo-migrate-$(date -u +%Y%m%d_%H%M%S).dump"
LOCAL_DUMP="${BACKUP_DIR:-/mnt/tds-geo/backups}/$(basename "$REMOTE_DUMP")"

mkdir -p "${BACKUP_DIR:-/mnt/tds-geo/backups}"

SSH_ARGS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -n "$AWS_SSH_KEY_PATH" ]]; then
  SSH_ARGS+=(-i "$AWS_SSH_KEY_PATH")
fi

ssh "${SSH_ARGS[@]}" "${AWS_SSH_USER}@${AWS_SSH_HOST}" \
  "sudo bash -lc 'set -a; . /home/ubuntu/tds-geo/.env; set +a; cd ${REMOTE_RELEASE}; pg_dump \"\$DATABASE_URL\" --format=custom --compress=9 --no-owner --no-privileges --file=${REMOTE_DUMP}'"

scp "${SSH_ARGS[@]}" "${AWS_SSH_USER}@${AWS_SSH_HOST}:${REMOTE_DUMP}" "$LOCAL_DUMP"
ssh "${SSH_ARGS[@]}" "${AWS_SSH_USER}@${AWS_SSH_HOST}" "rm -f ${REMOTE_DUMP}"

./scripts/restore-db.sh "$LOCAL_DUMP"
./scripts/healthcheck.sh

echo "migration_ok $LOCAL_DUMP"
