#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${SENTINEL_INSTALL_DIR:-/opt/kivo/sentinel}"

install_user_cron() {
  local cron_line="*/2 * * * * SENTINEL_CONFIG=${INSTALL_DIR}/sentinel.env ${INSTALL_DIR}/sentinel.sh >/dev/null 2>&1"
  local reboot_line="@reboot SENTINEL_CONFIG=${INSTALL_DIR}/sentinel.env ${INSTALL_DIR}/sentinel.sh >/dev/null 2>&1"
  (crontab -l 2>/dev/null | grep -v "${INSTALL_DIR}/sentinel.sh" || true; printf '%s\n%s\n' "$reboot_line" "$cron_line") | crontab -
  echo "Installed user cron schedule for Kivo Sentinel."
  crontab -l | grep "${INSTALL_DIR}/sentinel.sh"
}

if sudo -n true >/dev/null 2>&1; then
  sudo mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/reports" "$INSTALL_DIR/state"
  sudo install -m 0755 "$SRC_DIR/sentinel.sh" "$INSTALL_DIR/sentinel.sh"
  if [ ! -f "$INSTALL_DIR/sentinel.env" ]; then
    sudo install -m 0644 "$SRC_DIR/sentinel.env.example" "$INSTALL_DIR/sentinel.env"
  fi
  sudo chown -R "${USER}:${USER}" "$INSTALL_DIR/reports" "$INSTALL_DIR/state"

  sudo tee /etc/systemd/system/sneferu-sentinel.service >/dev/null <<SERVICE
[Unit]
Description=Kivo Sentinel production monitor
After=docker.service network-online.target
Wants=docker.service network-online.target

[Service]
Type=oneshot
User=${USER}
Group=${USER}
Environment=SENTINEL_CONFIG=${INSTALL_DIR}/sentinel.env
ExecStart=${INSTALL_DIR}/sentinel.sh
WorkingDirectory=${INSTALL_DIR}
SERVICE

  sudo tee /etc/systemd/system/sneferu-sentinel.timer >/dev/null <<'TIMER'
[Unit]
Description=Run Kivo Sentinel every 2 minutes

[Timer]
OnBootSec=90s
OnUnitActiveSec=2min
AccuracySec=20s
Persistent=true
Unit=sneferu-sentinel.service

[Install]
WantedBy=timers.target
TIMER

  sudo systemctl daemon-reload
  sudo systemctl enable --now sneferu-sentinel.timer
  sudo systemctl start sneferu-sentinel.service || true
  sudo systemctl --no-pager status sneferu-sentinel.timer
  exit 0
fi

mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/reports" "$INSTALL_DIR/state"
install -m 0755 "$SRC_DIR/sentinel.sh" "$INSTALL_DIR/sentinel.sh"
if [ ! -f "$INSTALL_DIR/sentinel.env" ]; then
  install -m 0644 "$SRC_DIR/sentinel.env.example" "$INSTALL_DIR/sentinel.env"
fi

if command -v crontab >/dev/null 2>&1; then
  install_user_cron
  SENTINEL_CONFIG="$INSTALL_DIR/sentinel.env" "$INSTALL_DIR/sentinel.sh" || true
  exit 0
fi

cat <<MSG
Installed Kivo Sentinel to ${INSTALL_DIR}, but neither passwordless sudo nor crontab is available.
Run it manually with:
  SENTINEL_CONFIG=${INSTALL_DIR}/sentinel.env ${INSTALL_DIR}/sentinel.sh
MSG
