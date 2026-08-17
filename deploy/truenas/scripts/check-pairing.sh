#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
# Verify source, exported workflows, GitNexus, and production health are paired.
set -euo pipefail

SOURCE_DIR="${KIVO_SOURCE_DIR:-/opt/tds-geo/kivo-source}"
MANIFEST="${N8N_WORKFLOW_MANIFEST:-$SOURCE_DIR/n8n/workflows/exported/manifest.json}"
GITNEXUS_STATUS_FILE="${GITNEXUS_STATUS_FILE:-/opt/tds-geo/gitnexus-status.json}"
HEALTH_URL="${KIVO_HEALTH_URL:-https://ai.trafficdigitalsolutions.com/health}"

if [ -d "$SOURCE_DIR/.git" ]; then
  commit="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
  dirty="$(git -C "$SOURCE_DIR" status --short | grep -Ev '^( M|\?\?) (CLAUDE\.md|AGENTS\.md|\.source-commit|\.claude/|\.agents/|\.gitnexus/)' || true)"
else
  commit="$(tr -d '[:space:]' < "$SOURCE_DIR/.source-commit")"
  dirty=""
fi
health_body="$(curl -fsS --max-time 10 "$HEALTH_URL")"
case "$health_body" in
  *'"status":"healthy"'*) health_status="healthy" ;;
  *) health_status="unknown" ;;
esac

workflow_count="missing"
if [ -f "$MANIFEST" ]; then
  workflow_count="$(grep -m1 '"workflowCount"' "$MANIFEST" | tr -cd '0-9')"
  workflow_count="${workflow_count:-unknown}"
fi

gitnexus_commit="missing"
if [ -f "$GITNEXUS_STATUS_FILE" ]; then
  gitnexus_commit="$(grep -m1 '"commit"' "$GITNEXUS_STATUS_FILE" | cut -d'"' -f4)"
  gitnexus_commit="${gitnexus_commit:-unknown}"
fi

printf 'source_commit=%s\n' "$commit"
printf 'unexpected_source_drift=%s\n' "$([ -z "$dirty" ] && echo no || echo yes)"
printf 'workflow_manifest=%s\n' "$MANIFEST"
printf 'workflow_count=%s\n' "$workflow_count"
printf 'gitnexus_commit=%s\n' "$gitnexus_commit"
printf 'production_health=%s\n' "$health_status"

if [ -n "$dirty" ]; then
  printf 'unexpected_source_drift_detail=\n%s\n' "$dirty" >&2
fi

test -z "$dirty"
test "$workflow_count" != "missing"
test "$gitnexus_commit" = "$commit"
test "$health_status" = "healthy"
