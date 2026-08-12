# Kivo Sentinel

Kivo Sentinel runs on the TrueNAS Ubuntu VM, not on a developer laptop. It watches production containers, health endpoints, and recent logs, then writes AI-ready incident prompts under `/opt/kivo/sentinel/reports`.

## What It Does

- Checks LAN and public health URLs.
- Checks Docker container status and health.
- Scans recent container logs for severe error patterns.
- Writes `/opt/kivo/sentinel/reports/latest-incident.md` when something needs attention.
- Optionally posts the incident to `SENTINEL_WEBHOOK_URL`.
- Conservatively restarts only app/proxy containers if they are stopped or unhealthy and `SENTINEL_AUTO_RESTART=true`.

## What It Does Not Do

- It does not print secrets.
- It does not edit production code by itself.
- It does not run database-destructive commands.
- It does not auto-deploy risky fixes without human approval.

## Install On The VM

```bash
cd /opt/kivo/source/deploy/truenas/sentinel
./install.sh
```

If the deploy user has passwordless sudo, the installer creates a systemd timer. Otherwise it installs a user cron schedule that runs every 2 minutes plus `@reboot`.

## Useful Commands

```bash
systemctl status kivo-sentinel.timer
systemctl start kivo-sentinel.service
journalctl -u kivo-sentinel.service -n 100 --no-pager
crontab -l | grep kivo-sentinel
ls -la /opt/kivo/sentinel/reports
cat /opt/kivo/sentinel/reports/latest-incident.md
```
