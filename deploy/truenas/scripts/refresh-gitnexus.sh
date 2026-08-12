#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
# Refresh the TrueNAS GitNexus graph for the clean Kivo source checkout.
set -euo pipefail

SOURCE_DIR="${KIVO_SOURCE_DIR:-/opt/tds-geo/kivo-source}"
DATA_DIR="${GITNEXUS_DATA_DIR:-/opt/tds-geo/gitnexus-data}"
IMAGE="${GITNEXUS_IMAGE:-akonlabs/gitnexus:latest}"
STATUS_FILE="${GITNEXUS_STATUS_FILE:-/opt/tds-geo/gitnexus-status.json}"
LOG_FILE="${GITNEXUS_LOG_FILE:-/opt/tds-geo/logs/gitnexus-refresh.log}"
MAX_FILE_SIZE_KB="${GITNEXUS_MAX_FILE_SIZE_KB:-1024}"
WORKER_TIMEOUT="${GITNEXUS_WORKER_TIMEOUT:-120}"

mkdir -p "$DATA_DIR" "$(dirname "$STATUS_FILE")" "$(dirname "$LOG_FILE")"

if [ -d "$SOURCE_DIR/.git" ]; then
  commit="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
elif [ -f "$SOURCE_DIR/.source-commit" ]; then
  commit="$(tr -d '[:space:]' < "$SOURCE_DIR/.source-commit")"
else
  echo "source checkout is missing both .git and .source-commit: $SOURCE_DIR" >&2
  exit 2
fi

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "[$started_at] refreshing GitNexus for $SOURCE_DIR at $commit"
  docker run --rm \
    -v "$DATA_DIR:/data/gitnexus" \
    -v "$SOURCE_DIR:/workspace/kivo-source" \
    -e HOME=/data/gitnexus \
    -e GITNEXUS_HOME=/data/gitnexus \
    -w /workspace/kivo-source \
    "$IMAGE" gitnexus analyze --max-file-size "$MAX_FILE_SIZE_KB" --worker-timeout "$WORKER_TIMEOUT"
  docker run --rm \
    -v "$DATA_DIR:/data/gitnexus" \
    -v "$SOURCE_DIR:/workspace/kivo-source:ro" \
    -e HOME=/data/gitnexus \
    -e GITNEXUS_HOME=/data/gitnexus \
    -w /workspace/kivo-source \
    "$IMAGE" gitnexus status
} >> "$LOG_FILE" 2>&1

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$STATUS_FILE" <<JSON
{
  "status": "ok",
  "sourceDir": "$SOURCE_DIR",
  "commit": "$commit",
  "startedAt": "$started_at",
  "finishedAt": "$finished_at",
  "logFile": "$LOG_FILE"
}
JSON

echo "GitNexus refreshed for $commit"
