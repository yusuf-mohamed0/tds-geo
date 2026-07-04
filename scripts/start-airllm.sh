#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
# ──────────────────────────────────────────────
# start-airllm.sh — AirLLM Local Inference
# Starts the Python FastAPI microservice that
# wraps AirLLM for running LLMs on low-VRAM.
# ──────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

AIRLLM_PORT="${AIRLLM_PORT:-8531}"
AIRLLM_HOST="${AIRLLM_HOST:-127.0.0.1}"
AIRLLM_LOG="${AIRLLM_LOG:-/tmp/airllm-server.log}"

echo "🔧 Starting AirLLM Local Inference..."
echo "   Host: $AIRLLM_HOST"
echo "   Port: $AIRLLM_PORT"
echo "   Model: ${AIRLLM_MODEL:-not set (lazy-load on first request)}"

# Kill any existing instance
if pgrep -f "localLLM.*server.py" > /dev/null 2>&1; then
  echo "   Killing existing AirLLM process..."
  pkill -f "localLLM.*server.py" 2>/dev/null || true
  sleep 1
fi

# Make sure API deps are installed. The airllm package itself is optional until a model is loaded.
python3 -c "import fastapi, uvicorn, pydantic; print('api deps ready')" 2>/dev/null || {
  echo "   Installing Python API deps..."
  python3 -m pip install -r "$PROJECT_DIR/backend/requirements.txt" --break-system-packages 2>&1 | tail -5
}

if ! python3 -c "from airllm import AutoModel; print('airllm ready')" 2>/dev/null; then
  if [ -n "${AIRLLM_MODEL:-}" ]; then
    echo "   Installing airllm for configured model..."
    python3 -m pip install airllm --break-system-packages 2>&1 | tail -5
  else
    echo "   airllm package not installed yet; service will start in standby mode"
  fi
fi

# Start the Python server
nohup python3 "$PROJECT_DIR/backend/services/localLLM/server.py" \
  > "$AIRLLM_LOG" 2>&1 &

LLM_PID=$!
echo "   Started (PID: $LLM_PID)"

# Wait for it to be ready
echo "   Waiting for server to be ready..."
for i in $(seq 1 20); do
  if curl -s http://$AIRLLM_HOST:$AIRLLM_PORT/health > /dev/null 2>&1; then
    echo "   ✅ AirLLM ready on http://$AIRLLM_HOST:$AIRLLM_PORT"
    exit 0
  fi
  sleep 1
done

echo "   ⚠️  AirLLM may not be ready yet (check $AIRLLM_LOG)"
tail -10 "$AIRLLM_LOG"
exit 0
