#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
# ──────────────────────────────────────────────
# start-dev.sh — Dev server with auto ngrok tunnel
# Starts ngrok, waits for it to be ready, then
# launches the backend for Shopify OAuth testing.
# ──────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env vars (dotenv format)
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

NGROK_DOMAIN="${NGROK_DOMAIN:-mothproof-choosy-irritable.ngrok-free.dev}"
# In dev mode, point ngrok at Vite dev server (5173) which proxies API calls to backend (3000)
BACKEND_PORT="${PORT:-5173}"
NGROK_LOG="/tmp/ngrok-dev.log"

echo "🔧 Starting dev environment..."
echo "   Backend port: $BACKEND_PORT"
echo "   Ngrok domain: $NGROK_DOMAIN"

# ─── Kill any old ngrok ───────────────────────
if pgrep -x ngrok > /dev/null 2>&1; then
  echo "   Killing existing ngrok process..."
  pkill -x ngrok 2>/dev/null || true
  sleep 1
fi

# ─── Start ngrok tunnel ───────────────────────
echo "   Starting ngrok tunnel..."
nohup ngrok http "$BACKEND_PORT" --url "$NGROK_DOMAIN" > "$NGROK_LOG" 2>&1 &
NGROK_PID=$!

# ─── Wait for ngrok to be ready ───────────────
echo "   Waiting for ngrok to be ready..."
for i in $(seq 1 15); do
  if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null || echo "")
    if [ -n "$NGROK_URL" ]; then
      echo "   ✅ Ngrok tunnel ready: $NGROK_URL"
      break
    fi
  fi
  sleep 1
done

# If ngrok still isn't ready, warn but continue
if ! curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
  echo "   ⚠️  Ngrok may not be ready yet (check $NGROK_LOG)"
  tail -5 "$NGROK_LOG"
fi

# ─── Export ngrok URL for the backend ─────────
export SHOPIFY_APP_URL="${NGROK_URL:-https://$NGROK_DOMAIN}"
echo "   SHOPIFY_APP_URL=$SHOPIFY_APP_URL"

# ─── Start the backend ────────────────────────
echo ""
echo "🚀 Starting backend server..."
echo "   Run: npx tsx backend/index.ts"
echo ""

# Trap SIGINT/SIGTERM to clean up ngrok on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  if [ -n "$NGROK_PID" ] && kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "   Stopping ngrok (PID $NGROK_PID)..."
    kill "$NGROK_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start the backend in foreground
npx tsx backend/index.ts &

BACKEND_PID=$!

# Wait for either process to exit
wait -n $BACKEND_PID $NGROK_PID 2>/dev/null || true
cleanup
