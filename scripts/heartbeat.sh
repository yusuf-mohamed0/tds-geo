#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
set -euo pipefail

# ══════════════════════════════════════════════════════════════════
# TDS Geo — Heartbeat Monitor
#
# Checks the server health endpoint and sends an email alert if
# the server is unreachable or returns a non-200 status.
#
# Setup:
#   1. Enable 2-factor auth on your Gmail account
#   2. Generate an App Password at https://myaccount.google.com/apppasswords
#   3. Set environment variables (add to .env or crontab):
#        SMTP_USER="your-email@gmail.com"
#        SMTP_PASS="your-16-char-app-password"
#        HEARTBEAT_EMAIL_TO="you@example.com"
#   4. Add to crontab (runs every 5 minutes):
#        */5 * * * * /root/my-project/scripts/heartbeat.sh >> /var/log/heartbeat.log 2>&1
# ══════════════════════════════════════════════════════════════════

# ─── Configuration ─────────────────────────────
HEARTBEAT_URL="${HEARTBEAT_URL:-http://localhost:3001/api/admin/health}"
HEARTBEAT_TIMEOUT="${HEARTBEAT_TIMEOUT:-10}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
HEARTBEAT_EMAIL_TO="${HEARTBEAT_EMAIL_TO:-youssif.m.h.g13@gmail.com}"
HEARTBEAT_EMAIL_FROM="${SMTP_USER}"

# ─── Health Check ──────────────────────────────
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$HEARTBEAT_TIMEOUT" --max-time 15 "$HEARTBEAT_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo "[$(date)] OK — HTTP $HTTP_CODE"
  exit 0
fi

# ─── Alert ─────────────────────────────────────
echo "[$(date)] DOWN — HTTP $HTTP_CODE"

if [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
  echo "WARNING: SMTP_USER and SMTP_PASS not set. Cannot send email alert."
  echo "To configure: https://myaccount.google.com/apppasswords"
  exit 1
fi

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S %Z")
HOSTNAME=$(hostname 2>/dev/null || echo "unknown")
EMAIL_SUBJECT="[TDS GEO] Server Down Alert — HTTP $HTTP_CODE"

HTML_BODY=$(cat <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f8; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #171414; padding: 36px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 14px; font-weight: 600; color: #838081; letter-spacing: 3px; text-transform: uppercase; }
    .header .status-badge { display: inline-block; margin-top: 16px; padding: 8px 24px; border-radius: 24px; background: #FCB900; color: #171414; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .header .logo { font-size: 28px; font-weight: 800; color: #FCF6F2; margin-bottom: 8px; letter-spacing: 2px; }
    .header .logo span { color: #FCB900; }
    .body { padding: 32px 40px; }
    .body h2 { margin: 0 0 8px 0; font-size: 18px; color: #171414; font-weight: 600; }
    .body p { margin: 0 0 24px 0; font-size: 14px; color: #3D3B3B; line-height: 1.6; }
    .details { background: #FCF6F2; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px; }
    .details .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e8ddd5; font-size: 14px; }
    .details .row:last-child { border-bottom: none; }
    .details .label { color: #838081; font-weight: 500; }
    .details .value { color: #171414; font-weight: 600; font-family: 'SF Mono', 'Fira Code', monospace; }
    .details .value.error { color: #F89D4B; }
    .causes { margin-bottom: 24px; }
    .causes h3 { font-size: 14px; font-weight: 600; color: #171414; margin: 0 0 12px 0; }
    .causes ul { margin: 0; padding: 0; list-style: none; }
    .causes li { padding: 6px 0 6px 20px; font-size: 13px; color: #3D3B3B; position: relative; }
    .causes li::before { content: "›"; position: absolute; left: 4px; color: #FCB900; font-weight: 700; font-size: 16px; }
    .action-box { background: #FFF7E6; border: 1px solid #FCB900; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
    .action-box h3 { font-size: 14px; font-weight: 600; color: #142444; margin: 0 0 8px 0; }
    .action-box p { margin: 0; font-size: 13px; color: #3D3B3B; line-height: 1.5; }
    .action-box code { display: inline-block; background: #FFF0CC; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #171414; font-family: 'SF Mono', 'Fira Code', monospace; }
    .footer { padding: 20px 40px; background: #FCF6F2; text-align: center; font-size: 12px; color: #838081; border-top: 1px solid #e8ddd5; }
    .footer .brand { font-weight: 700; color: #FCB900; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">TDS <span>GEO</span></div>
      <h1>Infrastructure Monitor</h1>
      <div class="status-badge">● Server Down</div>
    </div>
    <div class="body">
      <h2>Heartbeat Check Failed</h2>
      <p>TDS Geo could not reach the server at the configured endpoint. Immediate attention is required.</p>

      <div class="details">
        <div class="row">
          <span class="label">Endpoint</span>
          <span class="value">$HEARTBEAT_URL</span>
        </div>
        <div class="row">
          <span class="label">HTTP Status</span>
          <span class="value error">$HTTP_CODE</span>
        </div>
        <div class="row">
          <span class="label">Host</span>
          <span class="value">$HOSTNAME</span>
        </div>
        <div class="row">
          <span class="label">Timestamp</span>
          <span class="value">$TIMESTAMP</span>
        </div>
        <div class="row">
          <span class="label">Monitor Interval</span>
          <span class="value">Every 5 minutes</span>
        </div>
      </div>

      <div class="causes">
        <h3>Possible Causes</h3>
        <ul>
          <li>Server process crashed or terminated unexpectedly</li>
          <li>Database connection lost or PostgreSQL service is down</li>
          <li>Network issue — DNS, firewall, or port misconfiguration</li>
          <li>Operating system restart or resource exhaustion (OOM)</li>
          <li>SSL certificate expired or TLS handshake failure</li>
        </ul>
      </div>

      <div class="action-box">
        <h3>Recommended Actions</h3>
        <p>SSH into the server and check the logs:</p>
        <p><code>journalctl -u tds-geo --since "5 minutes ago"</code></p>
        <p><code>tail -100 /var/log/tdsgeo-heartbeat.log</code></p>
        <p style="margin-top: 8px;">Verify PostgreSQL is reachable and the API process is running with <code>pm2 status</code> or <code>systemctl status tds-geo</code>.</p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 4px 0;">Sent by <span class="brand">TDS Geo</span> Heartbeat Monitor</p>
      <p style="margin: 0;">This is an automated alert. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
EOF
)

TEXT_BODY=$(cat <<EOF
TDS GEO — Server Down Alert
================================

Heartbeat check failed for $HEARTBEAT_URL

  HTTP Status:  $HTTP_CODE
  Host:         $HOSTNAME
  Timestamp:    $TIMESTAMP

Possible causes:
  - Server process crashed or terminated unexpectedly
  - Database connection lost or PostgreSQL service is down
  - Network issue — DNS, firewall, or port misconfiguration
  - Operating system restart or resource exhaustion (OOM)

Recommended actions:
  1. SSH into the server
  2. Run: journalctl -u tds-geo --since "5 minutes ago"
  3. Run: tail -100 /var/log/tdsgeo-heartbeat.log
  4. Verify process: pm2 status or systemctl status tds-geo

This is an automated alert from Traffic Digital Solutions GEO Heartbeat Monitor.
EOF
)

# Build MIME multipart email
BOUNDARY="----=_Part_$(date +%s)_$$"
EMAIL_FILE=$(mktemp)

cat > "$EMAIL_FILE" <<EOF
From: TDS Geo Monitor <$HEARTBEAT_EMAIL_FROM>
To: $HEARTBEAT_EMAIL_TO
Subject: $EMAIL_SUBJECT
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="$BOUNDARY"

--$BOUNDARY
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: 7bit

$TEXT_BODY

--$BOUNDARY
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: 7bit

$HTML_BODY

--$BOUNDARY--
EOF

curl --url 'smtps://smtp.gmail.com:465' --ssl-reqd \
  --mail-from "$HEARTBEAT_EMAIL_FROM" \
  --mail-rcpt "$HEARTBEAT_EMAIL_TO" \
  --user "$SMTP_USER:$SMTP_PASS" \
  -T "$EMAIL_FILE" \
  --connect-timeout 15 --max-time 30 2>/dev/null \
  && echo "Alert email sent to $HEARTBEAT_EMAIL_TO" \
  || echo "Failed to send alert email (check SMTP_USER/SMTP_PASS)"

rm -f "$EMAIL_FILE"
