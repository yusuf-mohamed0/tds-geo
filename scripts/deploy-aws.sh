#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
set -euo pipefail

# ══════════════════════════════════════════════════════════════════
# TDS Geo — AWS Deployment Script
#
# Run this ON the AWS server after SSH-ing in.
# It installs everything and starts the app.
#
# Usage:
#   ssh -i tds-geo.pem ubuntu@13.48.59.201
#   curl -sL https://raw.githubusercontent.com/.../deploy-aws.sh | bash
#   (or copy-paste the commands below)
# ══════════════════════════════════════════════════════════════════

set -a; source /home/ubuntu/tdsgeo/.env 2>/dev/null || true; set +a

SERVER_IP=$(curl -s http://checkip.amazonaws.com)
DOMAIN="${SERVER_IP}.nip.io"

echo "════════════════════════════════════════════════"
echo "  TDS Geo — AWS Deploy"
echo "  IP: $SERVER_IP"
echo "  Domain: $DOMAIN"
echo "════════════════════════════════════════════════"

# ─── 1. System Dependencies ─────────────────────
echo ">>> Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl gnupg ca-certificates nginx certbot python3-certbot-nginx postgresql postgresql-contrib

# ─── 2. Node.js 22 ──────────────────────────────
echo ">>> Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y -qq nodejs

# ─── 3. PostgreSQL Database ──────────────────────
echo ">>> Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE USER tdsgeo WITH PASSWORD 'tdsgeo_pass' CREATEDB;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ai_seo_automation OWNER tdsgeo;" 2>/dev/null || true

# ─── 4. Application Setup ────────────────────────
echo ">>> Setting up TDS Geo..."
mkdir -p /home/ubuntu/tdsgeo
cd /home/ubuntu/tdsgeo

# Copy .env if it exists from the cloned repo
if [ ! -f .env ]; then
  cat > .env <<EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 32)
DATABASE_URL=postgresql://tdsgeo:tdsgeo_pass@localhost:5432/ai_seo_automation
OPENAI_API_KEY=
OPENAI_BASE_URL=https://openrouter.ai/api/v1
AI_PROVIDER=openrouter
HEARTBEAT_URL=http://localhost:3000/api/admin/health
HEARTBEAT_EMAIL_TO=youssif.m.h.g13@gmail.com
SMTP_USER=youssif.m.h.g13@gmail.com
SMTP_PASS=aizm fyqo clja tgsm
SERVER_IP=$SERVER_IP
DOMAIN=$DOMAIN
EOF
fi

# Install npm dependencies
npm install --production 2>&1 | tail -3

# ─── 5. Database Migration ───────────────────────
echo ">>> Running database migrations..."
psql "$DATABASE_URL" -f backend/database/schema.sql 2>/dev/null || echo "Schema may already exist"

# ─── 6. Start Application ────────────────────────
echo ">>> Starting TDS Geo..."
sudo npm install -g pm2 2>&1 | tail -1
pm2 delete tds-geo 2>/dev/null || true
pm2 start backend/index.ts --name tds-geo --interpreter tsx 2>&1 | tail -3
pm2 save
sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | tail -1

# ─── 7. Nginx Reverse Proxy + SSL ───────────────
echo ">>> Configuring Nginx..."
sudo tee /etc/nginx/sites-available/tdsgeo > /dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50m;
    }

    location /api/admin/health {
        proxy_pass http://127.0.0.1:3000/api/admin/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/tdsgeo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# ─── 8. SSL Certificate (Let's Encrypt) ─────────
echo ">>> Getting SSL certificate..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email youssif.m.h.g13@gmail.com --redirect 2>&1 || echo "SSL failed — will retry after DNS propagates"

# ─── 9. Heartbeat Cron ──────────────────────────
echo ">>> Installing heartbeat monitor..."
(crontab -l 2>/dev/null | grep -v heartbeat.sh || true) | crontab -
CRON_LINE="*/5 * * * * SMTP_USER='youssif.m.h.g13@gmail.com' SMTP_PASS='aizm fyqo clja tgsm' HEARTBEAT_EMAIL_TO='youssif.m.h.g13@gmail.com' bash /home/ubuntu/tdsgeo/scripts/heartbeat.sh >> /var/log/tdsgeo-heartbeat.log 2>&1"
(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

# ─── 10. Test ───────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
echo "  ✅ TDS Geo Deployed!"
echo "  🌐 http://$DOMAIN"
echo "  🔒 https://$DOMAIN (after SSL)"
echo "  📊 Heartbeat: every 5 min → youssif.m.h.g13@gmail.com"
echo "════════════════════════════════════════════════"
echo ""
echo "To check status:  curl http://localhost:3000/api/admin/health"
echo "To view logs:     pm2 logs tds-geo"
echo ""

# Test
sleep 3
curl -s -o /dev/null -w "Health check: HTTP %{http_code}\n" http://localhost:3000/api/admin/health
