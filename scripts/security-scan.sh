#!/usr/bin/env bash
set -euo pipefail

# Security Scan Script — TDS Geo / AI SEO Automation
# Runs available Kali/security tools against the API and client targets
# Usage: ./scripts/security-scan.sh --api http://localhost:3000 [--target https://example.com]

API_URL="${API_URL:-http://localhost:3000}"
REPORT_DIR="${REPORT_DIR:-/tmp/security-scan-$(date +%Y%m%d_%H%M%S)}"
TARGET="${TARGET:-}"

mkdir -p "$REPORT_DIR"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ── Tool Detection ──────────────────────────
log "=== Tool Detection ==="
declare -A TOOLS
for tool in nmap nikto whatweb wpscan sqlmap grype trivy zap-cli; do
  if command -v "$tool" &>/dev/null; then
    TOOLS["$tool"]=1
    log "  ✓ $tool available"
  else
    TOOLS["$tool"]=0
    log "  ✗ $tool not found"
  fi
done

# ── API Health Check ────────────────────────
log "=== API Health Check ==="
if curl -sf --max-time 5 "$API_URL/health" > "$REPORT_DIR/api-health.json" 2>&1; then
  log "  ✓ API is up"
else
  log "  ✗ API is down — aborting"
  exit 1
fi

# ── API ZAP Scan ────────────────────────────
if [ "${TOOLS[zap-cli]}" -eq 1 ]; then
  log "=== ZAP API Scan ==="
  zap-cli quick-scan -s xss,sqli,csrf --spider "$API_URL" 2>&1 | tee "$REPORT_DIR/zap-report.txt"
  log "  ZAP scan saved to $REPORT_DIR/zap-report.txt"
fi

# ── nikto against API ───────────────────────
if [ "${TOOLS[nikto]}" -eq 1 ]; then
  log "=== nikto API Scan ==="
  nikto -h "$API_URL" -nointeractive -Format txt -output "$REPORT_DIR/nikto-api.txt" 2>/dev/null
  log "  nikto scan saved to $REPORT_DIR/nikto-api.txt"
fi

# ── grype dependency scan ───────────────────
if [ "${TOOLS[grype]}" -eq 1 ]; then
  log "=== grype Dependency Scan ==="
  grype dir:. --only-fixed --fail-on medium -o json > "$REPORT_DIR/grype-deps.json" 2>/dev/null || true
  log "  grype scan saved to $REPORT_DIR/grype-deps.json"
fi

# ── trivy vulnerability scan ────────────────
if [ "${TOOLS[trivy]}" -eq 1 ]; then
  log "=== trivy FS Scan ==="
  trivy filesystem --severity CRITICAL,HIGH --no-progress . -o "$REPORT_DIR/trivy-report.json" 2>/dev/null || true
  log "  trivy scan saved to $REPORT_DIR/trivy-report.json"
fi

# ── Target Scan ─────────────────────────────
if [ -n "$TARGET" ]; then
  DOMAIN=$(echo "$TARGET" | sed 's|https\?://||' | cut -d/ -f1)

  if [ "${TOOLS[whatweb]}" -eq 1 ]; then
    log "=== whatweb: $TARGET ==="
    whatweb "$TARGET" --colour=never -a 3 > "$REPORT_DIR/whatweb-$DOMAIN.txt" 2>&1
    log "  saved to $REPORT_DIR/whatweb-$DOMAIN.txt"
  fi

  if [ "${TOOLS[nmap]}" -eq 1 ]; then
    log "=== nmap: $DOMAIN ==="
    nmap -sV -p 80,443,8080,8443,3000,5000,5432,6379 --open -T4 "$DOMAIN" -oN "$REPORT_DIR/nmap-$DOMAIN.txt" 2>/dev/null
    log "  saved to $REPORT_DIR/nmap-$DOMAIN.txt"
  fi

  if [ "${TOOLS[wpscan]}" -eq 1 ]; then
    log "=== wpscan: $TARGET ==="
    wpscan --url "$TARGET" --enumerate vp,vt --no-banner --format json -o "$REPORT_DIR/wpscan-$DOMAIN.json" 2>/dev/null || true
    log "  saved to $REPORT_DIR/wpscan-$DOMAIN.json"
  fi

  if [ "${TOOLS[nikto]}" -eq 1 ]; then
    log "=== nikto: $TARGET ==="
    nikto -h "$TARGET" -nointeractive -Format txt -output "$REPORT_DIR/nikto-$DOMAIN.txt" 2>/dev/null
    log "  saved to $REPORT_DIR/nikto-$DOMAIN.txt"
  fi
fi

# ── Summary ─────────────────────────────────
log "=== Scan Complete ==="
log "Reports saved to: $REPORT_DIR"
find "$REPORT_DIR" -type f | while read -r f; do
  size=$(du -h "$f" | cut -f1)
  log "  $f ($size)"
done
