#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run as the deploy user, not root. The script will use sudo when needed."
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git jq postgresql-client rsync ufw unattended-upgrades

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"

sudo ufw allow OpenSSH
if [[ "${ENABLE_DIRECT_HTTPS:-false}" == "true" ]]; then
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
else
  echo "Leaving 80/443 closed. Set ENABLE_DIRECT_HTTPS=true when using direct Caddy HTTPS instead of Cloudflare Tunnel."
fi
sudo ufw --force enable

sudo mkdir -p /mnt/tds-geo/{postgres,redis,backups,logs,cloudflared}
sudo chown -R "$USER:$USER" /mnt/tds-geo

echo "Bootstrap complete. Log out and back in so Docker group membership applies."
