#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${SENTINEL_CONFIG:-/opt/kivo/sentinel/sentinel.env}"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

COMPOSE_DIR="${SENTINEL_COMPOSE_DIR:-/opt/kivo/deploy/truenas}"
REPORT_DIR="${SENTINEL_REPORT_DIR:-/opt/kivo/sentinel/reports}"
STATE_DIR="${SENTINEL_STATE_DIR:-/opt/kivo/sentinel/state}"
HEALTH_URL="${SENTINEL_HEALTH_URL:-http://127.0.0.1/health}"
PUBLIC_URL="${SENTINEL_PUBLIC_URL:-https://ai.trafficdigitalsolutions.com/health}"
LOG_SINCE="${SENTINEL_LOG_SINCE:-10m}"
AUTO_RESTART="${SENTINEL_AUTO_RESTART:-true}"
RESTART_CONTAINERS="${SENTINEL_RESTART_CONTAINERS:-tds-geo-api-1 tds-geo-worker-1 tds-geo-caddy-1}"
WATCH_CONTAINERS="${SENTINEL_WATCH_CONTAINERS:-tds-geo-api-1 tds-geo-worker-1 tds-geo-caddy-1 tds-geo-postgres-1 tds-geo-redis-1 tds-geo-db-backup-1}"
ERROR_PATTERN="${SENTINEL_ERROR_PATTERN:-Internal server error|Unhandled error|uncaughtException|unhandledRejection|FATAL|panic|segmentation fault|ECONNREFUSED|database .*failed|migration .*failed}"
WEBHOOK_URL="${SENTINEL_WEBHOOK_URL:-}"

mkdir -p "$REPORT_DIR" "$STATE_DIR"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$STATE_DIR/sentinel.lock"
  flock -n 9 || exit 0
fi

NOW="$(date -u +%Y%m%dT%H%M%SZ)"
INCIDENT_FILE="$REPORT_DIR/${NOW}-incident.md"
ISSUES_FILE="$(mktemp)"
EVIDENCE_FILE="$(mktemp)"
trap 'rm -f "$ISSUES_FILE" "$EVIDENCE_FILE"' EXIT

add_issue() {
  printf -- '- %s\n' "$1" >> "$ISSUES_FILE"
}

add_evidence() {
  printf -- '\n### %s\n\n```text\n%s\n```\n' "$1" "$2" >> "$EVIDENCE_FILE"
}

http_status() {
  local url="$1"
  curl -k -sS -o /tmp/kivo-sentinel-body.$$ -w '%{http_code}' --max-time 20 "$url" 2>/tmp/kivo-sentinel-curl.$$ || true
}

check_url() {
  local label="$1"
  local url="$2"
  local code
  code="$(http_status "$url")"
  local body curl_err
  body="$(if [ -f /tmp/kivo-sentinel-body.$$ ]; then tr -d '\000' < /tmp/kivo-sentinel-body.$$ | head -c 3000; fi)"
  curl_err="$(if [ -f /tmp/kivo-sentinel-curl.$$ ]; then tr -d '\000' < /tmp/kivo-sentinel-curl.$$ | head -c 1000; fi)"
  rm -f /tmp/kivo-sentinel-body.$$ /tmp/kivo-sentinel-curl.$$
  if [ "$code" != "200" ]; then
    add_issue "$label returned HTTP $code for $url"
    add_evidence "$label response" "HTTP $code
$curl_err
$body"
  fi
}

check_container() {
  local name="$1"
  local inspect status health restart_allowed
  inspect="$(docker inspect "$name" 2>&1 || true)"
  if [[ "$inspect" == *"No such object"* ]]; then
    add_issue "Container $name is missing"
    add_evidence "docker inspect $name" "$inspect"
    return
  fi

  status="$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || true)"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$name" 2>/dev/null || true)"
  if [ "$status" != "running" ] || [ "$health" = "unhealthy" ]; then
    add_issue "Container $name is $status / health=$health"
    add_evidence "docker inspect $name" "$(docker inspect -f 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} exit={{.State.ExitCode}} error={{.State.Error}}' "$name" 2>&1 || true)"

    restart_allowed="false"
    for restart_name in $RESTART_CONTAINERS; do
      if [ "$restart_name" = "$name" ]; then restart_allowed="true"; fi
    done

    if [ "$AUTO_RESTART" = "true" ] && [ "$restart_allowed" = "true" ]; then
      docker restart "$name" >/tmp/kivo-sentinel-restart.$$ 2>&1 || true
      add_evidence "auto restart $name" "$(cat /tmp/kivo-sentinel-restart.$$ 2>/dev/null || true)"
      rm -f /tmp/kivo-sentinel-restart.$$
    fi
  fi
}

check_logs() {
  local name="$1"
  local matches state_key current_hash last_hash
  matches="$(docker logs --since "$LOG_SINCE" "$name" 2>&1 | grep -E "$ERROR_PATTERN" | tail -n 80 || true)"
  if [ -z "$matches" ]; then return; fi

  current_hash="$(printf '%s' "$matches" | sha256sum | awk '{print $1}')"
  state_key="$STATE_DIR/${name}.last-error-hash"
  last_hash="$(cat "$state_key" 2>/dev/null || true)"
  if [ "$current_hash" = "$last_hash" ]; then return; fi

  printf '%s' "$current_hash" > "$state_key"
  add_issue "Recent error-pattern logs found in $name"
  add_evidence "docker logs --since $LOG_SINCE $name" "$matches"
}

check_url "LAN health" "$HEALTH_URL"
check_url "Public health" "$PUBLIC_URL"

for container in $WATCH_CONTAINERS; do
  check_container "$container"
  check_logs "$container"
done

if [ ! -s "$ISSUES_FILE" ]; then
  printf '%s ok\n' "$NOW" > "$STATE_DIR/last-ok.txt"
  exit 0
fi

{
  printf '# Kivo Sentinel Incident\n\n'
  printf -- '- Time UTC: `%s`\n' "$NOW"
  printf -- '- Host: `%s`\n' "$(hostname)"
  printf -- '- Compose dir: `%s`\n' "$COMPOSE_DIR"
  printf -- '- Auto restart enabled: `%s`\n\n' "$AUTO_RESTART"
  printf '## Issues\n\n'
  cat "$ISSUES_FILE"
  printf '\n## Evidence\n'
  cat "$EVIDENCE_FILE"
  printf '\n## Fix Prompt For AI\n\n'
  printf 'You are Kivo Sentinel. Diagnose and fix the production issue below. Constraints: do not print secrets, do not delete data, do not run destructive git commands, prefer minimal safe changes, verify with health checks and targeted tests, and require explicit approval for risky database/auth/payment changes.\n\n'
  printf 'Project source on VM: `/opt/kivo/source` if present, otherwise `/opt/tds-geo/source`\n'
  printf 'Compose stack: `/opt/kivo/deploy/truenas` if present, otherwise `/opt/tds-geo/deploy/truenas`\n'
  printf 'Production URL: `https://ai.trafficdigitalsolutions.com/`\n\n'
  printf 'Use the Issues and Evidence sections above as the starting context.\n'
} > "$INCIDENT_FILE"

ln -sfn "$INCIDENT_FILE" "$REPORT_DIR/latest-incident.md"

if [ -n "$WEBHOOK_URL" ]; then
  python3 - "$WEBHOOK_URL" "$INCIDENT_FILE" <<'PY'
import json, sys, urllib.request
url, path = sys.argv[1], sys.argv[2]
with open(path, 'r', encoding='utf-8') as f:
    body = f.read()[:12000]
payload = json.dumps({"text": "Kivo Sentinel incident", "incident": body}).encode()
req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
try:
    urllib.request.urlopen(req, timeout=10).read()
except Exception:
    pass
PY
fi

exit 0
