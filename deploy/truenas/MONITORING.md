# TrueNAS Monitoring And Alerting

This file defines what must be watched so the local production server does not fail silently.

## Monitoring Goals

- Detect public downtime quickly.
- Detect failed backups before a restore is needed.
- Detect storage pressure before PostgreSQL or TrueNAS fails.
- Detect broken Shopify integrations after URL or webhook changes.
- Detect repeated worker failures before publishing queues stall.

## Minimum Monitors

| Monitor | Target | Failure Meaning |
|---|---|---|
| Public health | `GET ${TDS_PUBLIC_URL}/health` | App, proxy, tunnel, or network failure |
| API container health | Compose healthcheck | Backend runtime failure |
| PostgreSQL health | `pg_isready` | Database unavailable |
| Redis health | `redis-cli ping` | Queue/cache unavailable |
| Backup freshness | Latest dump age | Recovery point is too old |
| Disk usage | `/mnt/kivo` and pool usage | Risk of DB/write failure |
| GitHub runner status | Runner online in GitHub | Deploys cannot reach TrueNAS |
| Cloudflare Tunnel status | Tunnel connected | Public ingress failure |
| Shopify embedded app | App opens in admin | App URL, auth, or iframe failure |

## Alert Thresholds

| Signal | Warning | Critical |
|---|---:|---:|
| Public health failures | 2 consecutive failures | 5 consecutive failures |
| Backup age | Older than 26 hours | Older than 48 hours |
| Dataset usage | Above 75% | Above 85% |
| Pool health | Any degraded status | Any faulted status |
| API restart count | More than 2 per hour | More than 5 per hour |
| Worker errors | Repeated publishing/job failures | Queue blocked or publishing broken |

## Recommended Tools

Start simple and reliable:

- UptimeRobot, Better Stack, or Cloudflare Health Checks for public `/health`.
- GitHub Actions email notifications for failed deployments.
- TrueNAS built-in alerts for pool health, disk failure, and SMART failures.
- Cloudflare Tunnel dashboard for tunnel health.
- Daily backup freshness check from a cron or uptime check.

Optional later:

- Prometheus and Grafana.
- Loki or another central log store.
- Alertmanager, email, Slack, or Telegram alerts.

## Manual Health Command

```bash
cd /opt/kivo/deploy/truenas
./scripts/healthcheck.sh
```

## Backup Freshness Check

Use this logic in whichever monitoring tool is available:

```bash
test -f /mnt/kivo/backups/kivo_latest.dump
find /mnt/kivo/backups/kivo_latest.dump -mtime -1
```

Expected result:

- The latest dump exists.
- The latest dump is less than one day old.

## Dashboard View

The production dashboard should show:

- Public app status.
- Last deploy SHA and time.
- Last successful backup time.
- Current active clients.
- Database status.
- Redis status.
- Worker status.
- Cloudflare Tunnel status.
- Disk usage.
- Open incidents.

## Alert Routing

| Alert | First Responder | Backup Responder |
|---|---|---|
| Public app down | Deployment Engineer | Infrastructure Architect |
| Database down | Database Steward | Deployment Engineer |
| Backup stale | Database Steward | Operations Auditor |
| Pool degraded | Infrastructure Architect | Project Manager |
| Shopify app broken | Shopify Integration Owner | Deployment Engineer |
| Security exposure | Security Operator | Project Manager |

## Incident Record

For every incident, record:

- Start time.
- Detection source.
- User impact.
- Commit SHA or infrastructure change involved.
- Actions taken.
- Rollback or restore decision.
- End time.
- Follow-up prevention task.
