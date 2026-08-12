#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
set -euo pipefail

# ══════════════════════════════════════════════════════════════════
# SNEFERU Geo — Install Heartbeat Cron Job
#
# Adds a crontab entry that runs the heartbeat monitor every 5 minutes.
#
# Usage:
#   # First, set your Gmail App Password in the environment
#   export SMTP_USER="your-email@gmail.com"
#   export SMTP_PASS="your-16-char-app-password"
#
#   # Then run:
#   bash scripts/install-heartbeat.sh
# ══════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HEARTBEAT_SCRIPT="$SCRIPT_DIR/heartbeat.sh"
LOG_FILE="/var/log/tdsgeo-heartbeat.log"

# Ensure script exists
if [ ! -f "$HEARTBEAT_SCRIPT" ]; then
  echo "ERROR: $HEARTBEAT_SCRIPT not found"
  exit 1
fi

# Inject current SMTP env into the crontab entry
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
HEARTBEAT_EMAIL_TO="${HEARTBEAT_EMAIL_TO:-youssif.m.h.g13@gmail.com}"

if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
  echo "WARNING: SMTP_USER and SMTP_PASS are not set."
  echo "The heartbeat will still check the server but won't send emails."
  echo "Set them later in your crontab or environment."
  echo ""
fi

# Remove existing heartbeat cron entries
(crontab -l 2>/dev/null | grep -v heartbeat.sh || true) | crontab -

# Add new crontab entry
CRON_LINE="*/5 * * * * SMTP_USER='$SMTP_USER' SMTP_PASS='$SMTP_PASS' HEARTBEAT_EMAIL_TO='$HEARTBEAT_EMAIL_TO' bash $HEARTBEAT_SCRIPT >> $LOG_FILE 2>&1"

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo "Heartbeat cron installed (every 5 minutes)."
echo "Logs: $LOG_FILE"
echo ""
echo "To test immediately:"
echo "  bash $HEARTBEAT_SCRIPT"
echo ""
echo "To view logs:"
echo "  tail -f $LOG_FILE"
