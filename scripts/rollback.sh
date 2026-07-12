#!/usr/bin/env bash
set -euo pipefail

# ─── Rollback Script ──────────────────────────────────────────
# Reverts the production deployment to the previous Docker image.
# Usage: ./scripts/rollback.sh [--restore-db DUMP_FILE]
#
# --restore-db: also restore a pre-deploy database backup
# ──────────────────────────────────────────────────────────────

ENV_PATH="${DEPLOY_PATH:-/opt/ai-seo}"
REGISTRY="ghcr.io"
IMAGE_NAME="${GITHUB_REPOSITORY:-tds-geo/ai-seo-automation}"
RESTORE_DB=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --restore-db)
      RESTORE_DB="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo ""
echo "══════════════════════════════════════════════"
echo "  Rollback — $ENV_PATH"
echo "══════════════════════════════════════════════"
echo ""

# Step 1: Verify prev-production tag exists
PREV_IMAGE="$REGISTRY/$IMAGE_NAME:prev-production"
echo "Checking for previous image: $PREV_IMAGE"
if docker image inspect "$PREV_IMAGE" &>/dev/null; then
  echo "  ✅ Found previous image"
else
  echo "  ⚠️  Local image not found, pulling from registry..."
  docker pull "$PREV_IMAGE" || {
    echo "  ❌ Previous image not found in registry either"
    exit 1
  }
fi

# Step 2: Tag prev as production
echo "Tagging $PREV_IMAGE as production..."
docker tag "$PREV_IMAGE" "$REGISTRY/$IMAGE_NAME:production"

# Step 3: Restore DB if requested
if [[ -n "$RESTORE_DB" ]]; then
  if [[ -f "$RESTORE_DB" ]]; then
    echo "Restoring database from $RESTORE_DB..."
    docker compose exec -T postgres pg_restore -U postgres -d ai_seo_automation --clean --if-exists -F c < "$RESTORE_DB" || {
      echo "  ⚠️  DB restore had warnings — check logs"
    }
    echo "  ✅ Database restored"
  else
    echo "  ❌ Backup file not found: $RESTORE_DB"
    exit 1
  fi
fi

# Step 4: Redeploy previous version
echo "Redeploying previous version..."
docker compose up -d --no-deps api worker nginx

# Step 5: Health check
echo "Waiting for services to become healthy..."
for i in {1..30}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    echo "  ✅ API healthy (attempt $i)"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "  ❌ API failed to become healthy after 30 attempts"
    exit 1
  fi
  echo "  Waiting... attempt $i/30"
  sleep 2
done

# Step 6: Verify all services
echo "Verifying all services..."
for svc in api worker nginx; do
  if docker compose ps --format "{{.Status}}" "$svc" 2>/dev/null | grep -q "Up"; then
    echo "  ✅ $svc is running"
  else
    echo "  ❌ $svc is NOT running"
  fi
done

echo ""
echo "══════════════════════════════════════════════"
echo "  Rollback complete"
echo "══════════════════════════════════════════════"
echo ""
