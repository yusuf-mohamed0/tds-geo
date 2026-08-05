# TrueNAS Disaster Recovery Plan

This file defines recovery targets and procedures for losing the app, VM, database, TrueNAS host, or local network.

## Recovery Targets

| Scenario | RTO Target | RPO Target |
|---|---:|---:|
| Bad deploy | 15-30 minutes | No data loss expected |
| API container failure | 15 minutes | No data loss expected |
| Database corruption | 1-4 hours | Last good backup |
| VM failure | 2-6 hours | Last good backup or dataset snapshot |
| TrueNAS host failure | 4-24 hours | Last offsite backup |
| Local internet outage | Depends on ISP | No data loss expected |
| Secret compromise | 1-4 hours | No data loss expected |

## Backup Layers

Use multiple backup layers because no single backup method covers every failure.

| Layer | Purpose | Required |
|---|---|---|
| `pg_dump -Fc` | Portable logical database recovery | Yes |
| ZFS snapshots | Fast local dataset rollback | Yes |
| Offsite encrypted copy | Survive theft, fire, disk pool loss | Yes |
| AWS rollback window | Migration safety net | Required during migration |
| GitHub repo | Source and deployment recovery | Yes |
| GHCR images | Image rollback | Yes |

## Bad Deploy Recovery

1. Stop new deploys.
2. Check `docker compose --env-file .env -f compose.yml ps`.
3. Inspect API and worker logs.
4. If the previous image is known-good, retag or set `TDS_IMAGE` to the previous image.
5. Run `docker compose --env-file .env -f compose.yml up -d api worker`.
6. Run `./scripts/healthcheck.sh`.
7. If still broken, route traffic back to AWS during rollback window.

## Database Recovery

Use this only when the current database must be replaced.

```bash
cd /opt/tds-geo/deploy/truenas
./scripts/restore-db.sh /mnt/tds-geo/backups/tds-geo_latest.dump
./scripts/healthcheck.sh
```

After restore:

- Verify active clients.
- Verify Shopify tokens for active stores.
- Verify publishing queue state.
- Verify no duplicate live publishing occurred.

## VM Recovery

1. Create a new Ubuntu Server VM.
2. Mount or restore the TrueNAS-backed datasets.
3. Run `deploy/truenas/scripts/bootstrap-vm.sh`.
4. Clone the GitHub repository to `/opt/tds-geo`.
5. Restore VM-local `.env` from the secure secret store.
6. Start the Compose stack.
7. Run `./scripts/healthcheck.sh`.
8. Reinstall or reconnect the GitHub self-hosted runner.

## TrueNAS Host Loss

1. Provision replacement hardware or temporary cloud host.
2. Restore the GitHub repo.
3. Restore latest offsite encrypted database dump.
4. Recreate `.env` from the secret store.
5. Start Compose stack.
6. Point DNS or Cloudflare route to the replacement target.
7. Verify Shopify URLs and webhooks.

## Internet Outage

Cloudflare Tunnel and direct HTTPS both need outbound internet.

Response:

- Confirm local server and app are healthy on LAN.
- Confirm ISP outage or router failure.
- If outage exceeds business tolerance, route DNS and Shopify app URL back to AWS during rollback window.
- If AWS rollback window is closed, use a temporary cloud VM restored from the latest offsite backup.

## Secret Compromise Recovery

1. Disable public ingress if compromise is active.
2. Rotate exposed secret at the provider.
3. Update VM-local `.env` or GitHub secrets.
4. Restart affected services.
5. Verify integrations.
6. Review logs for abuse.
7. Document names of rotated secrets, not secret values.

## Restore Test Schedule

- Test one database restore before cutover.
- Test one restore weekly during the first month after cutover.
- Test one restore monthly after stability is proven.
- Record dump filename, restore time, restore target, and validation result.
