#!/usr/bin/env bash
# ──────────────────────────────────────────────
# start-vector-store.sh — turbovec Vector Store
# Starts the Python FastAPI microservice that
# wraps turbovec (TurboQuant) for vector search.
# ──────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TVEC_PORT="${TVEC_PORT:-8530}"
TVEC_HOST="${TVEC_HOST:-127.0.0.1}"
TVEC_DATA_DIR="${TVEC_DATA_DIR:-/tmp/turbovec_indices}"
TVEC_LOG="${TVEC_LOG:-/tmp/turbovec-server.log}"

echo "🔧 Starting turbovec Vector Store..."
echo "   Host: $TVEC_HOST"
echo "   Port: $TVEC_PORT"
echo "   Data: $TVEC_DATA_DIR"

# Kill any existing instance
if pgrep -f "turbovec.*server.py" > /dev/null 2>&1 || pgrep -f "vectorStore.*server.py" > /dev/null 2>&1; then
  echo "   Killing existing vector store process..."
  pkill -f "vectorStore.*server.py" 2>/dev/null || true
  sleep 1
fi

# Make sure deps are installed
python -c "from turbovec import TurboQuantIndex; print('turbovec ready')" 2>/dev/null || {
  echo "   Installing turbovec..."
  pip3 install turbovec --quiet 2>&1 || pip3 install turbovec --quiet --break-system-packages 2>&1 | tail -2
}

mkdir -p "$TVEC_DATA_DIR"

# Start the Python server
nohup python "$PROJECT_DIR/backend/services/vectorStore/server.py" \
  > "$TVEC_LOG" 2>&1 &

VEC_PID=$!
echo "   Started (PID: $VEC_PID)"

# Wait for it to be ready with retries
echo "   Waiting for server to be ready..."
for i in $(seq 1 20); do
  if curl -s http://$TVEC_HOST:$TVEC_PORT/health > /dev/null 2>&1; then
    echo "   ✅ Vector Store ready on http://$TVEC_HOST:$TVEC_PORT"
    exit 0
  fi
  sleep 1
done

echo "   ⚠️  Vector Store may not be ready yet (check $TVEC_LOG)"
tail -10 "$TVEC_LOG"
exit 0
