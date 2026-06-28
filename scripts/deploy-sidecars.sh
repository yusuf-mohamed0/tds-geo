#!/usr/bin/env bash
set -euo pipefail

# Deploy Docker sidecars to AWS alongside PM2
# Usage: ./scripts/deploy-sidecars.sh [--install-docker]

HOST="${AWS_HOST:-13.48.59.201}"
USER="${AWS_USER:-ubuntu}"
SSH_KEY="${AWS_SSH_KEY:-/root/tds-geo.pem}"
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $USER@$HOST"
SCP_CMD="scp -i $SSH_KEY -o StrictHostKeyChecking=no"

echo "→ Deploying Docker sidecars to $HOST"

# ── Step 1: Ensure Docker is installed ──
if [[ "${1:-}" == "--install-docker" ]]; then
  echo "→ Installing Docker..."
  $SSH_CMD <<'DOCKER'
    if ! command -v docker &>/dev/null; then
      curl -fsSL https://get.docker.com | sh
      sudo usermod -aG docker $USER
      echo "Docker installed"
    else
      echo "Docker already installed: $(docker --version)"
    fi
    if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
      sudo apt-get install -y docker-compose-plugin
    fi
DOCKER
fi

# ── Step 2: Upload compose file ──
echo "→ Uploading docker-compose.sidecars.yml"
$SCP_CMD docker-compose.sidecars.yml "$USER@$HOST:/home/$USER/tds-geo/docker-compose.sidecars.yml"

# ── Step 3: Upload .env if local has sidecar vars ──
if [[ -f .env ]]; then
  echo "→ Syncing sidecar env vars"
  $SSH_CMD "touch /home/$USER/tds-geo/.env.sidecars"
  grep -E '^(CRAWL4AI_URL|HEADROOM_BASE_URL|FREELMAPI_ENCRYPTION_KEY|DATAFORSEO_API_KEY|OPENAI_FALLBACK_KEY|OPENSEO_URL)=' .env \
    > /tmp/.env.sidecars 2>/dev/null || true
  if [[ -s /tmp/.env.sidecars ]]; then
    $SCP_CMD /tmp/.env.sidecars "$USER@$HOST:/home/$USER/tds-geo/.env.sidecars"
  fi
  rm -f /tmp/.env.sidecars
fi

# ── Step 4: Start sidecars ──
echo "→ Starting sidecar containers"
$SSH_CMD <<'SIDECARS'
  cd /home/$USER/tds-geo
  export $(cat .env.sidecars 2>/dev/null | xargs)
  docker compose -f docker-compose.sidecars.yml pull
  docker compose -f docker-compose.sidecars.yml up -d
  echo "Sidecars started:"
  docker compose -f docker-compose.sidecars.yml ps
SIDECARS

# ── Step 5: Add PM2 env vars for sidecar URLs ──
echo "→ Updating PM2 env vars for sidecar connectivity"
$SSH_CMD <<'PM2ENV'
  cd /home/$USER/tds-geo
  # Read sidecar env and inject into PM2
  export $(cat .env.sidecars 2>/dev/null | xargs)
  pm2 restart tds-geo-backend --update-env
  sleep 6
  curl -s http://localhost:3000/health | python3 -c "
import sys,json
d=json.load(sys.stdin)
c=d.get('checks',{})
for k in ['crawl4ai','headroom','freellmapi','openseo']:
    s=c.get(k,{}).get('status','unknown')
    print(f'  {k}: {s}')
"
PM2ENV

echo "✓ Sidecars deployed. Check health endpoint for status."
