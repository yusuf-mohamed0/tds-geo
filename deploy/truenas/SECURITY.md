# TrueNAS Production Security Model

This file is the security baseline for the TrueNAS/local-server production deployment.

## Security Goal

Expose only the public HTTPS application surface. Keep storage, databases, secrets, backups, runners, host management, and internal service ports private.

## Public Exposure Policy

Publicly allowed:

- HTTPS application URL through Cloudflare Tunnel or Caddy.
- Shopify app callback URLs through the same HTTPS application URL.
- Health endpoint only if it returns non-sensitive status.

Never expose publicly:

- TrueNAS web UI.
- PostgreSQL.
- Redis.
- Docker socket or Docker API.
- GitHub runner directory.
- `.env` files.
- Backup directories.
- VNC or RDP.
- SSH unless restricted by keys and firewall policy.
- Admin dashboards without authentication or Cloudflare Access.

## Recommended Ingress

Use Cloudflare Tunnel as the default ingress.

Required behavior:

- Tunnel token lives only in VM-local `.env` or Cloudflare-managed runner config.
- Tunnel container makes outbound-only connections.
- Admin-only hostnames use Cloudflare Access.
- Config-file mode includes a final `http_status:404` catch-all rule.
- Tunnel logs must not print secrets.

Direct HTTPS fallback:

- Forward only ports `80` and `443` to the Ubuntu VM.
- Use Caddy for TLS and reverse proxying.
- Keep all internal services on the Compose network.

## Identity And Access

TrueNAS host:

- Use strong admin credentials and MFA if available.
- Restrict UI to LAN, VPN, or a private access path.
- Do not expose the UI through public port forwarding.

Ubuntu VM:

- Use SSH keys.
- Disable password SSH login.
- Use a non-root deploy user.
- Add the deploy user to `docker` only if required for the GitHub runner.
- Keep `sudo` access limited to trusted administrators.

GitHub runner:

- Install only inside the Ubuntu VM.
- Use labels `self-hosted,truenas,tds-geo`.
- Run as a normal deploy user, not root.
- Keep runner work directory private.
- Do not run public pull-request code on the self-hosted production runner.
- Rotate runner registration token during setup or reinstallation.

## Secrets

Secrets live in these places only:

| Secret Type | Location |
|---|---|
| Runtime app secrets | `/opt/tds-geo/deploy/truenas/.env` on the VM |
| GitHub build/deploy credentials | GitHub repository or environment secrets |
| Cloudflare Tunnel token | VM-local `.env` or Cloudflare-managed tunnel config |
| SSH private keys | Administrator machine or dedicated secret store |
| Database dumps | Encrypted backup location or protected local backup dataset |

Never commit:

- `.env`.
- Private keys.
- Shopify access tokens.
- OpenAI, SerpAPI, DataForSEO, Google, Cloudflare, or JWT secrets.
- Database dumps.
- Backup archives.

Minimum secret rotation triggers:

- Secret appears in chat, logs, commit history, issue text, screenshots, or terminal output.
- VM compromise suspected.
- GitHub runner compromise suspected.
- Administrator leaves or loses device access.
- Cloudflare Tunnel token is copied outside the VM or Cloudflare UI.

## Firewall Rules

Cloudflare Tunnel mode:

| Direction | Port | Rule |
|---|---:|---|
| Inbound LAN/VPN | 22 | Allow trusted admin networks only |
| Inbound internet | Any | Deny |
| Outbound | 443 | Allow GitHub, GHCR, Cloudflare, APIs |
| Compose internal | Postgres/Redis/API | Docker network only |

Direct HTTPS mode:

| Direction | Port | Rule |
|---|---:|---|
| Inbound internet | 80, 443 | Allow to VM proxy only |
| Inbound LAN/VPN | 22 | Allow trusted admin networks only |
| Inbound internet | 5432, 6379, 2375, 2376 | Deny |
| Inbound internet | TrueNAS UI, VNC, RDP | Deny |

## Database Security

- PostgreSQL listens only on the internal Compose network.
- Use strong `DB_PASSWORD` in VM-local `.env`.
- Do not reuse the AWS database password if moving to TrueNAS.
- Take `pg_dump -Fc` backups before deploys and before cutover.
- Store dumps in a protected dataset.
- Encrypt offsite copies.
- Test restore weekly.

## Container Security

- Pull application images from GHCR.
- Keep Compose files in git.
- Do not mount Docker socket into application containers.
- Do not run privileged containers unless a specific documented sidecar requires it.
- Keep database and Redis without published host ports.
- Use container healthchecks and restart policies.
- Update base images during normal maintenance windows.

## Application Security

- Enforce strong `JWT_SECRET` and `CREDENTIAL_VAULT_KEY`.
- Keep Shopify OAuth app URLs and redirect URLs exact.
- Create Shopify articles as hidden drafts first.
- Do not publish live content during infrastructure validation unless explicitly approved.
- Ensure `/health` does not expose secrets, tokens, stack traces, or DB credentials.
- Keep admin routes authenticated.

## Backup Security

- Local backups go to `/mnt/tds-geo/backups` or the configured backup dataset.
- Offsite backups must be encrypted.
- Backup access is admin-only.
- Do not expose backup datasets over unauthenticated SMB/NFS/web shares.
- Retain AWS and TrueNAS dumps during rollback window.

## Incident Response

If a secret is exposed:

1. Revoke or rotate the exposed secret at the source.
2. Update VM-local `.env` or GitHub secrets.
3. Redeploy the stack.
4. Verify `/health` and client integrations.
5. Audit logs for suspicious usage.
6. Record the incident and final rotated secret names, not secret values.

If the TrueNAS VM is compromised:

1. Remove public ingress or disable tunnel.
2. Stop the GitHub runner.
3. Snapshot for forensic preservation if needed.
4. Rotate all runtime secrets and runner tokens.
5. Restore from a known-good backup or rebuild the VM.
6. Keep AWS rollback path available if still inside migration window.
