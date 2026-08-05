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

BASE_URL="${TDS_PUBLIC_URL:-http://127.0.0.1}"

docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml exec -T postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}"
docker compose --env-file .env -f compose.yml exec -T redis redis-cli ping | grep -q PONG

for _ in $(seq 1 30); do
  status="$(curl -sk -o /dev/null -w '%{http_code}' "${BASE_URL}/health" || true)"
  if [[ "$status" == "200" ]]; then
    echo "health_ok ${BASE_URL}/health"
    exit 0
  fi
  sleep 2
done

echo "health_failed ${BASE_URL}/health"
docker compose --env-file .env -f compose.yml logs --tail=200 api
exit 1
