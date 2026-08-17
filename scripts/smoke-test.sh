#!/usr/bin/env bash
set -euo pipefail

# ─── Smoke Test Suite ────────────────────────────────────────
# Run after any deployment to verify the system is healthy.
# Usage: ./scripts/smoke-test.sh [--strict]
#
# --strict: fail on first error instead of collecting all
# ─────────────────────────────────────────────────────────────

BASE_URL="${SMOKE_TEST_URL:-http://localhost:3000}"
STRICT=false
FAILED=0
TOTAL=0
PASSED=0

if [[ "${1:-}" == "--strict" ]]; then
  STRICT=true
fi

pass() {
  PASSED=$((PASSED + 1))
  TOTAL=$((TOTAL + 1))
  echo "  ✅ $1"
}

fail() {
  FAILED=$((FAILED + 1))
  TOTAL=$((TOTAL + 1))
  echo "  ❌ $1"
  if $STRICT; then
    exit 1
  fi
}

check_http() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local token="${4:-}"
  local status
  if [[ -n "$token" ]]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -H "Authorization: Bearer $token" "$url" 2>/dev/null || true)
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || true)
  fi
  status="${status:-000}"
  if [[ "$status" == "$expected" ]]; then
    pass "$name (HTTP $status)"
  else
    fail "$name — expected HTTP $expected, got $status"
  fi
}

check_json() {
  local name="$1"
  local url="$2"
  local field="$3"
  local result
  result=$(curl -sf --max-time 10 "$url" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$field', 'MISSING'))" 2>/dev/null || echo "UNREACHABLE")
  if [[ "$result" != "UNREACHABLE" ]] && [[ "$result" != "MISSING" ]]; then
    pass "$name ($field=$result)"
  else
    fail "$name — could not read field '$field' (got: $result)"
  fi
}

echo ""
echo "══════════════════════════════════════════════"
echo "  Smoke Tests — $BASE_URL"
echo "══════════════════════════════════════════════"
echo ""

# ─── API Health ────────────────────────────────
echo "--- API Health ---"
check_http "Health endpoint" "$BASE_URL/health"
check_json "Health status" "$BASE_URL/health" "status"

# ─── API Endpoints ─────────────────────────────
echo "--- API Endpoints ---"
check_http "Clients list (unauthenticated)" "$BASE_URL/api/clients" 401
check_http "Articles list (unauthenticated)" "$BASE_URL/api/articles" 401
if [[ -n "${SMOKE_TEST_TOKEN:-}" ]]; then
  check_http "Clients list (authenticated)" "$BASE_URL/api/clients" 200 "$SMOKE_TEST_TOKEN"
  check_http "Articles list (authenticated)" "$BASE_URL/api/articles" 200 "$SMOKE_TEST_TOKEN"
fi

# ─── Database ──────────────────────────────────
echo "--- Database ---"
if [[ "${SMOKE_TEST_DOCKER:-false}" == "true" ]] && command -v docker &>/dev/null; then
  DB_CHECK=$(docker compose exec -T postgres pg_isready -U postgres 2>/dev/null || echo "FAILED")
  if echo "$DB_CHECK" | grep -q "accepting connections"; then
    pass "PostgreSQL accepting connections"
  else
    fail "PostgreSQL not responding"
  fi

  REDIS_CHECK=$(docker compose exec -T redis redis-cli ping 2>/dev/null || echo "FAILED")
  if echo "$REDIS_CHECK" | grep -q "PONG"; then
    pass "Redis responding"
  else
    fail "Redis not responding"
  fi
else
  echo "  ⚠️  Docker checks disabled — skipping database checks"
fi

# ─── Nginx / Frontend ─────────────────────────
echo "--- Frontend ---"
check_http "Nginx frontend" "$BASE_URL/" 200

# ─── Summary ───────────────────────────────────
echo ""
echo "══════════════════════════════════════════════"
echo "  Results: $PASSED/$TOTAL passed, $FAILED failed"
echo "══════════════════════════════════════════════"
echo ""

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
