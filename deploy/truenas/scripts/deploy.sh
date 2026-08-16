#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
cd "$DEPLOY_DIR"

if [[ ! -f .env ]]; then
  echo ".env is missing. Copy .env.example to .env and fill secrets on the VM."
  exit 1
fi

set -a
source .env
set +a

if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
  export TDS_IMAGE="${TDS_IMAGE:-ghcr.io/${GITHUB_REPOSITORY}:truenas}"
fi

CURRENT_IMAGE="$(docker compose --env-file .env -f compose.yml images -q api 2>/dev/null || true)"
if [[ -n "$CURRENT_IMAGE" ]]; then
  echo "$CURRENT_IMAGE" > .previous-image
fi

if ! ./scripts/backup-db.sh; then
  if [[ "${PRE_DEPLOY_BACKUP_REQUIRED:-true}" == "true" ]]; then
    echo "Pre-deploy backup failed. Set PRE_DEPLOY_BACKUP_REQUIRED=false only for a documented first initialization."
    exit 1
  fi
  echo "Pre-deploy backup failed, but PRE_DEPLOY_BACKUP_REQUIRED=false; continuing."
fi

docker compose --env-file .env -f compose.yml pull api worker
docker compose --env-file .env -f compose.yml pull caddy || true
docker compose --env-file .env -f compose.yml up -d postgres redis
./scripts/sync-shopify-tokens.sh
docker compose --env-file .env -f compose.yml up -d api worker caddy db-backup

if [[ -n "${CLOUDFLARED_TOKEN:-}" || "${ENABLE_CLOUDFLARED:-false}" == "true" ]]; then
  docker compose --env-file .env -f compose.yml --profile tunnel pull cloudflared || true
  docker compose --env-file .env -f compose.yml --profile tunnel up -d cloudflared
fi

if [[ "${ENABLE_SIDECARS:-false}" == "true" ]]; then
  docker compose --env-file .env -f compose.yml --profile sidecars pull freellmapi crawl4ai headroom openseo || true
  docker compose --env-file .env -f compose.yml --profile sidecars up -d freellmapi crawl4ai headroom openseo
fi

./scripts/healthcheck.sh
