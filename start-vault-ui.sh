#!/bin/bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.™
# © 2026 Yusuf Mohamed. All rights reserved.
# Licensed under the ISC License.
# Start the Vault UI server
TDS_ROOT="/root/tds-geo"
cd "$TDS_ROOT/backend/vault-ui" || exit 1
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_seo_automation"
nohup npx tsx server.ts &>/tmp/vault-ui.log &
echo $! > /tmp/vault-ui.pid
sleep 3
echo "Vault UI: http://localhost:3456"
echo "Password: TrafficDSgeo@2024"
