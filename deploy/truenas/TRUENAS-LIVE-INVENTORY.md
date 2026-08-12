# TrueNAS Live Inventory

Last checked: 2026-08-09

This file records the live TrueNAS state discovered during deployment preparation. It intentionally does not include API keys, passwords, private keys, tokens, or other secret values.

## System

| Item | Value |
|---|---|
| Hostname | `nas` |
| Domain | `trafficdigitalsolutions.com` |
| TrueNAS version | `25.10.5` Community Edition, Goldeye |
| Hardware | Dell PowerEdge R740xd |
| CPU | Intel Xeon Gold 6234, 16 logical cores / 8 physical cores |
| Memory | About 92.9 GiB ECC |
| Timezone | `Africa/Cairo` |

## Storage

| Item | Value |
|---|---|
| Pool | `Traffic` |
| Pool status | `ONLINE` / healthy |
| Approx raw size | 30.98 TB |
| Approx free | 15.63 TB |
| Approx used | 15.35 TB |
| Data vdevs | 2 x RAIDZ1 |
| Cache | 1 NVMe cache device |
| Spare | 1 spare disk |
| Scrub errors | 0 in latest reported scrub |

## Kivo Geo Datasets Created

These datasets were created through the TrueNAS API as the dedicated storage tree for the migration target:

| Dataset | Purpose |
|---|---|
| `Traffic/kivo` | Parent dataset for Kivo Geo production support data. |
| `Traffic/kivo/postgres` | Intended PostgreSQL persistent data location if mounted into the VM/runtime. |
| `Traffic/kivo/redis` | Intended Redis persistent data location if mounted into the VM/runtime. |
| `Traffic/kivo/backups` | Database dumps, restore-test dumps, and migration dumps. |
| `Traffic/kivo/logs` | Application and deploy logs. |
| `Traffic/kivo/cloudflared` | Cloudflare Tunnel config/state if config-file mode is used. |

## Network

| Item | Value |
|---|---|
| Main bridge | `br0` |
| NAS LAN IP | `192.168.0.2/24` |
| Gateway | `192.168.0.1` |
| Nameservers | `1.1.1.1`, `8.8.8.8` |
| Physical link | `eno1` link up, bridge member |

## Services

| Service | State | Enabled |
|---|---|---|
| SMB/CIFS | Running | Yes |
| SSH | Stopped | No |
| UPS | Running | Yes |
| FTP | Stopped | No |
| NFS | Stopped | No |
| iSCSI | Stopped | No |
| SNMP | Stopped | No |

## Apps

| App | State | Notes |
|---|---|---|
| Nextcloud | Running | App version `34.0.2`; TrueNAS app version `2.3.50`; image updates available; web portal reported on LAN port `30027`. |
| Nginx Proxy Manager | Running | Host ports `80`, `443`, and `81` are bound on all interfaces. This likely controls public ingress. |
| cxperts WordPress | Running | LAN port `30040`; likely unrelated to Kivo Geo production migration. |
| hik-odoo-sync | Running | Custom app; upgrade available. |

## Virtual Machines

| VM | State | Notes |
|---|---|---|
| `tdsGEO` | Running | Autostart enabled; 2 vCPU; about 4.6 GiB RAM; bridge `br0`; Ubuntu ISO still attached; display/VNC configured. |
| `Windows11` | Stopped | Not part of Kivo Geo deployment. |

## Security Findings

These must be fixed before production cutover:

- `https://nas.trafficdigitalsolutions.com/` redirects to `/ui/`, which appears to expose the TrueNAS web UI publicly.
- Nginx Proxy Manager admin port `81` is bound on all interfaces and is publicly reachable over HTTP. It should not be public.
- VM display/VNC devices are bound broadly. VNC should be LAN/VPN-only or disabled after installation.
- The API key originally pasted in chat was exposed and must be revoked.
- A later key attempt was also exposed in chat and must be revoked.
- A TrueNAS API response included certificate private-key material. Rotate the affected certificate/private key after setup.
- Rotate VM display passwords that appeared in API output.

## Current Deployment Progress

Completed:

- TrueNAS API access established through local `/tmp/opencode/truenas.env`.
- Read-only system, storage, app, VM, service, and network discovery completed.
- Dedicated `Traffic/kivo/*` datasets created.
- Repo already contains complete TrueNAS deployment kit, production-readiness docs, and Nextcloud workspace plan.

Blocked:

- No SSH access inside the `tdsGEO` Ubuntu VM yet.
- No confirmed IP address for the `tdsGEO` guest OS yet.
- No Nginx Proxy Manager admin/API access yet.
- No Cloudflare account/tunnel access yet.
- No GitHub runner registration token or repo admin access yet.
- No Shopify Partner/app admin access yet.

## Next Best Actions

1. Lock down public TrueNAS UI exposure through Nginx Proxy Manager and/or Cloudflare.
2. Restrict Nginx Proxy Manager admin UI port `81` and VM VNC to LAN/VPN/Cloudflare Access only.
3. Confirm whether `tdsGEO` has Ubuntu installed or is still at the installer.
4. Get SSH into `tdsGEO` or install/configure Ubuntu through the VM console.
5. Mount or map the `Traffic/kivo/*` datasets into the runtime path, or document that the VM disk is the primary runtime disk and host datasets are backup/support storage.
6. Bootstrap the VM with `deploy/truenas/scripts/bootstrap-vm.sh`.
7. Clone repo to `/opt/kivo` in the VM.
8. Configure VM-local `/opt/kivo/deploy/truenas/.env`.
9. Install GitHub self-hosted runner.
10. Deploy Compose stack and run healthchecks.
