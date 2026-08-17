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

check_http_status() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local status
  status="$(curl -sk -o /dev/null -w '%{http_code}' "$url" || true)"
  if [[ "$status" != "$expected" ]]; then
    echo "${name}_failed ${url} expected_http=${expected} actual_http=${status}"
    return 1
  fi
  echo "${name}_ok ${url} http=${status}"
}

docker compose --env-file .env -f compose.yml ps
docker compose --env-file .env -f compose.yml exec -T postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}"
docker compose --env-file .env -f compose.yml exec -T redis redis-cli ping | grep -q PONG

HEALTH_OK=false
for _ in $(seq 1 30); do
  status="$(curl -sk -o /dev/null -w '%{http_code}' "${BASE_URL}/health" || true)"
  if [[ "$status" == "200" ]]; then
    echo "health_ok ${BASE_URL}/health"
    HEALTH_OK=true
    break
  fi
  sleep 2
done

if [[ "$HEALTH_OK" != "true" ]]; then
  echo "health_failed ${BASE_URL}/health expected_http=200 actual_http=${status}"
  docker compose --env-file .env -f compose.yml logs --tail=200 api
  exit 1
fi

check_http_status "frontend_root" "${BASE_URL}/" "200"
check_http_status "api_clients_unauthenticated" "${BASE_URL}/api/clients" "401"
check_http_status "api_articles_unauthenticated" "${BASE_URL}/api/articles" "401"
