#!/usr/bin/env bash
# ──────────────────────────────────────────────
# start-all.sh — Launch the full AI stack
# Starts Python microservices (turbovec, AirLLM)
# then the Node.js backend, all in order.
# ──────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Load .env ────────────────────────────────
echo "📦 Loading environment..."
set -a
# shellcheck source=/dev/null
[ -f "$PROJECT_DIR/.env" ] && source "$PROJECT_DIR/.env"
set +a

# ─── Config ───────────────────────────────────
TVEC_PORT="${TVEC_PORT:-8530}"
TVEC_HOST="${TVEC_HOST:-127.0.0.1}"
AIRLLM_PORT="${AIRLLM_PORT:-8531}"
AIRLLM_HOST="${AIRLLM_HOST:-127.0.0.1}"
BACKEND_PORT="${PORT:-3000}"

TVEC_LOG="${TVEC_LOG:-/tmp/turbovec-server.log}"
AIRLLM_LOG="${AIRLLM_LOG:-/tmp/airllm-server.log}"
BACKEND_LOG="${BACKEND_LOG:-/tmp/backend-server.log}"

ALL_PIDS=()

# ─── Cleanup ─────────────────────────────────
cleanup() {
  echo ""
  echo "🛑 Shutting down all services..."
  for pid in "${ALL_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "   Stopping PID $pid..."
      kill "$pid" 2>/dev/null || true
    fi
  done
  # Also kill any stray processes by pattern
  pkill -f "vectorStore.*server.py" 2>/dev/null || true
  pkill -f "localLLM.*server.py" 2>/dev/null || true
  pkill -f "tsx.*backend/index.ts" 2>/dev/null || true
  echo "✅ All services stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

wait_for_service() {
  local name="$1" host="$2" port="$3" log="$4" timeout="${5:-20}"
  echo "   ⏳ Waiting for $name to be ready..."
  for i in $(seq 1 "$timeout"); do
    if curl -s "http://$host:$port/health" > /dev/null 2>&1; then
      echo "   ✅ $name ready on http://$host:$port"
      return 0
    fi
    sleep 1
  done
  echo "   ⚠️  $name may not be ready (check $log)"
  tail -5 "$log" 2>/dev/null || true
  return 1
}

# ══════════════════════════════════════════════
# 1. turbovec Vector Store
# ══════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo "  🔧 Step 1/3: turbovec Vector Store"
echo "═══════════════════════════════════════════"

# Kill existing
pkill -f "vectorStore.*server.py" 2>/dev/null || true
sleep 1

# Install dep if missing
python -c "from turbovec import TurboQuantIndex; print('turbovec ready')" 2>/dev/null || {
  echo "   Installing turbovec..."
  pip3 install turbovec --quiet 2>&1 || pip3 install turbovec --quiet --break-system-packages 2>&1 | tail -1
}

mkdir -p "${TVEC_DATA_DIR:-/tmp/turbovec_indices}"
nohup python "$PROJECT_DIR/backend/services/vectorStore/server.py" > "$TVEC_LOG" 2>&1 &
TVEC_PID=$!
ALL_PIDS+=("$TVEC_PID")
echo "   🟢 turbovec started (PID: $TVEC_PID)"
wait_for_service "turbovec" "$TVEC_HOST" "$TVEC_PORT" "$TVEC_LOG" 20 || true

# ══════════════════════════════════════════════
# 2. AirLLM Local Inference
# ══════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo "  🔧 Step 2/3: AirLLM Local Inference"
echo "═══════════════════════════════════════════"

pkill -f "localLLM.*server.py" 2>/dev/null || true
sleep 1

python -c "from airllm import AutoModel; print('airllm ready')" 2>/dev/null || {
  echo "   Installing airllm..."
  pip3 install airllm --quiet 2>&1 || pip3 install airllm --quiet --break-system-packages 2>&1 | tail -1
}

nohup python "$PROJECT_DIR/backend/services/localLLM/server.py" > "$AIRLLM_LOG" 2>&1 &
AIRLLM_PID=$!
ALL_PIDS+=("$AIRLLM_PID")
echo "   🟢 AirLLM started (PID: $AIRLLM_PID)"
wait_for_service "AirLLM" "$AIRLLM_HOST" "$AIRLLM_PORT" "$AIRLLM_LOG" 20 || true

# ══════════════════════════════════════════════
# 3. Backend (Node.js)
# ══════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo "  🚀 Step 3/3: Node.js Backend"
echo "═══════════════════════════════════════════"

# Kill any previous backend
pkill -f "tsx.*backend/index.ts" 2>/dev/null || true
sleep 1

cd "$PROJECT_DIR"

npx tsx backend/index.ts > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
ALL_PIDS+=("$BACKEND_PID")
echo "   🟢 Backend started (PID: $BACKEND_PID)"

# Wait for backend to come up
echo "   ⏳ Waiting for backend on port $BACKEND_PORT..."
for i in $(seq 1 30); do
  if curl -s "http://127.0.0.1:$BACKEND_PORT/health" > /dev/null 2>&1; then
    echo "   ✅ Backend ready on http://127.0.0.1:$BACKEND_PORT"
    break
  fi
  sleep 1
done

# ══════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ All services running!"
echo "═══════════════════════════════════════════"
echo "   📍 turbovec   → http://$TVEC_HOST:$TVEC_PORT"
echo "   📍 AirLLM     → http://$AIRLLM_HOST:$AIRLLM_PORT"
echo "   📍 Backend    → http://127.0.0.1:$BACKEND_PORT"
echo "   📍 Health     → http://127.0.0.1:$BACKEND_PORT/health"
echo ""
echo "   📋 Logs:"
echo "      turbovec  → $TVEC_LOG"
echo "      AirLLM    → $AIRLLM_LOG"
echo "      Backend   → $BACKEND_LOG"
echo ""
echo "   Press Ctrl+C to stop all services"
echo "═══════════════════════════════════════════"

# Wait forever (or until signal)
wait
