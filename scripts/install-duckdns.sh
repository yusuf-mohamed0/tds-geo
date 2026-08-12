#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
set -euo pipefail

# ══════════════════════════════════════════════════════════════════
# SNEFERU Geo — Duck DNS Auto-Updater
#
# Keeps your free Duck DNS subdomain pointed at your server IP.
# Runs every 5 minutes via cron.
#
# Setup:
#   1. Go to https://duckdns.org and sign in
#   2. Create a subdomain (e.g. "tdsgeo")
#   3. Copy your token
#   4. Run: bash scripts/install-duckdns.sh
# ══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="/var/log/tdsgeo-duckdns.log"

echo "════════════════════════════════════════════════"
echo "  SNEFERU Geo — Duck DNS Installer"
echo "════════════════════════════════════════════════"
echo ""

read -p "Enter your Duck DNS subdomain (e.g. tdsgeo): " DUCK_NAME
read -p "Enter your Duck DNS token: " DUCK_TOKEN

if [ -z "$DUCK_NAME" ] || [ -z "$DUCK_TOKEN" ]; then
  echo "ERROR: Both subdomain and token are required."
  exit 1
fi

# Save to .env
if ! grep -q "DUCK_DNS_NAME" "$SCRIPT_DIR/../.env" 2>/dev/null; then
  cat >> "$SCRIPT_DIR/../.env" <<EOF

# ─── Duck DNS (free dynamic DNS) ────────────────
DUCK_DNS_NAME=$DUCK_NAME
DUCK_DNS_TOKEN=$DUCK_TOKEN
EOF
  echo "Saved to .env"
fi

# Remove existing duckdns cron entries
(crontab -l 2>/dev/null | grep -v duckdns || true) | crontab -

# Add cron entry (updates every 5 minutes)
CRON_LINE="*/5 * * * * curl -s \"https://www.duckdns.org/update?domains=$DUCK_NAME&token=$DUCK_TOKEN&ip=\" >> $LOG_FILE 2>&1"
(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo ""
echo "✅ Duck DNS installed!"
echo "   Subdomain: https://$DUCK_NAME.duckdns.org"
echo "   Updates every 5 minutes automatically"
echo "   Logs: $LOG_FILE"

# Test immediately
echo ""
echo "Testing now..."
RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=$DUCK_NAME&token=$DUCK_TOKEN&ip=")
echo "   Response: $RESPONSE"
