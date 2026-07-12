#!/usr/bin/env bash
set -euo pipefail

# ─── Production Server Setup ──────────────────────────────
# One-time setup for a bare-metal Ubuntu server.
# Run as root on a fresh server.
# Usage: curl -fsSL https://raw.githubusercontent.com/.../setup-server.sh | bash
# ──────────────────────────────────────────────────────────

echo "══════════════════════════════════════════════"
echo "  TDS Geo — Server Provisioning"
echo "══════════════════════════════════════════════"

# ─── System ──────────────────────────────────────
echo "=== System Updates ==="
apt update -qq && apt upgrade -y -qq
apt install -y -qq curl wget git ufw fail2ban unattended-upgrades

# ─── Docker ──────────────────────────────────────
echo "=== Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
fi

if ! command -v docker compose &>/dev/null; then
  DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d'"' -f4)
  curl -fsSL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# ─── Node.js 22 ──────────────────────────────────
echo "=== Node.js ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi

# ─── PostgreSQL ──────────────────────────────────
echo "=== PostgreSQL Client ==="
apt install -y postgresql-client

# ─── Firewall ────────────────────────────────────
echo "=== Firewall ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 9090/tcp  # Prometheus
ufw --force enable

# ─── fail2ban ────────────────────────────────────
echo "=== fail2ban ==="
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true
EOF
systemctl restart fail2ban

# ─── Auto-updates ────────────────────────────────
echo "=== Unattended Upgrades ==="
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutoCleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl restart unattended-upgrades

# ─── Swap (for memory-constrained servers) ───────
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap created: 2G"
fi

# ─── SSH hardening ───────────────────────────────
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd

# ─── App directory ───────────────────────────────
mkdir -p /opt/ai-seo
mkdir -p /opt/ai-seo-staging

# ─── Monitoring cron ─────────────────────────────
cat > /etc/cron.d/tdsgeo-health << 'EOF'
*/5 * * * * root curl -sf http://localhost:3000/health > /dev/null 2>&1 || echo "TDS Geo health check failed" | mail -s "ALERT: TDS Geo Down" admin@tdsgeo.com
EOF

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ Server provisioning complete!"
echo ""
echo "  Next steps:"
echo "  1. Clone repo to /opt/ai-seo"
echo "  2. Copy .env.production to /opt/ai-seo/.env"
echo "  3. Run: cd /opt/ai-seo && docker compose up -d"
echo "  4. Set up SSL: certbot --nginx -d app.tdsgeo.com"
echo "══════════════════════════════════════════════"
