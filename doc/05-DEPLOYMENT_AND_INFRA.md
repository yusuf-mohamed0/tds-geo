# Deployment & Infrastructure

## Server Details

| Property | Value |
|---|---|
| Provider | AWS EC2 |
| Instance ID | `i-075f4e5677510cbc5` |
| Public IP | `16.192.29.174` (Elastic IP) |
| Private IP | `172.31.32.190` |
| Hostname | `ec2-16-192-29-174.eu-north-1.compute.amazonaws.com` |
| Region | `eu-north-1` (Stockholm) |
| Instance type | `c7i-flex.large` (2 vCPU, 4GB RAM) |
| OS | Ubuntu 24.04 (Noble) |
| AMI | `ami-05bfa4a7765f38076` |
| Key pair | `kozmocore` |
| Disk | 38GB (26GB used — 67%) |

## App Process

Managed by **PM2** (process manager):

| Property | Value |
|---|---|
| Process name | `tds-geo-backend` |
| Mode | `fork` (single process) |
| Port | `3000` |
| Version | `2.0.1` |
| Max memory | ~74MB (current) |
| Max restarts | 10 (before PM2 gives up) |
| Restart delay | 5 seconds |
| Auto-start on boot | ✅ Yes (systemd service) |

## Services Running on Server

| Service | Port | Status |
|---|---|---|
| Express API | 3000 | ✅ Running |
| PostgreSQL 16 | 5432 | ✅ Running |
| Redis 7 | 6379 | ❌ Down (degraded gracefully) |
| Nginx (SSL proxy) | 443/80 | ✅ Running |
| Turbovec (vector) | 8530 | ❌ Down |
| AirLLM | 8531 | ❌ Down |

## Code Deployment Flow

```
Local development
  → git push origin main
  → server: git pull origin main
  → pm2 restart tds-geo-backend
  → verify: curl https://16.192.29.174.nip.io/api/health
```

The app runs on **source TypeScript via tsx** (no build step needed). PM2 uses `tsx` to run TypeScript directly.

## Health Checks

| Endpoint | Expected | Purpose |
|---|---|---|
| `/health` | 200 | Quick liveness check |
| `/api/health` | 200 | Full system health (DB, Redis, AI, etc.) |

## Shopify CLI & TOML Deployment

The `shopify.app.toml` file must be deployed separately via Shopify CLI:

```bash
cd /home/ubuntu/tds-geo
npx @shopify/cli@latest app deploy --config shopify.app.tds-geo.toml --allow-updates
```

This pushes the app configuration (webhooks, scopes, URLs) to Shopify's platform. The TOML file and the linked copy (`shopify.app.tds-geo.toml`) must be kept in sync.

## App Restart Safety

- PM2 auto-restarts the app if it crashes (up to 10 times)
- PM2 is registered as systemd service → auto-starts on server reboot
- Process list saved via `pm2 save`
- If PM2 exceeds max restarts, the app stays down until manually restarted

## Important .env Values

| Variable | Value |
|---|---|
| `SHOPIFY_API_KEY` | `a178c8740049e04eec663378b6e30ad8` |
| `SHOPIFY_API_SECRET` | `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` |
| `SHOPIFY_APP_URL` | `https://16.192.29.174.nip.io` |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ai_seo_automation` |
| `WORDPRESS_API_URL` | `https://trafficdigitalsolutions.com` |
| `WORDPRESS_APP_PASSWORD` | `trafficdigitalsolutions:PXgm Bc7X MS0G 2Eei QBCu kHeb` |

## Deployment Scripts

Located in `scripts/` directory:
- `deploy-aws.sh` — Automated deployment
- `backup-db.sh` — Database backup
- `install-duckdns.sh` — DuckDNS setup
- `start-all.sh` / `start-dev.sh` — Start services

## Monitoring

- **App logs:** `/home/ubuntu/.pm2/logs/tds-geo-backend-*.log`
- **PM2 status:** `pm2 status` or `pm2 show tds-geo-backend`
- **Health:** `curl http://localhost:3000/health`
- **Database:** `psql "$DATABASE_URL" -c "SELECT 1;"`

## Common Issues

1. **Swagger.json crash on startup** — File `dist/backend/public/swagger.json` may not exist. Fix: `cp backend/swagger.json dist/backend/public/`
2. **Redis not running** — Non-fatal. Queue operations degrade gracefully.
3. **PM2 max restarts exceeded** — Check error log, fix the crash, then `pm2 reset tds-geo-backend && pm2 restart tds-geo-backend`
4. **Disk space** — 67% used (26/38GB). Monitor and clean logs if needed.
