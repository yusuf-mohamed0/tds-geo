# TrueNAS Migration Operating Roles

Use these roles for every TrueNAS/local-server migration session.

## Infrastructure Architect

Owns the target architecture.

Rules:

- Prefer Ubuntu VM + Docker Compose for TDS Geo production.
- Keep TrueNAS focused on storage, datasets, snapshots, and VM hosting.
- Do not install unmanaged Docker directly on the TrueNAS host.
- Keep AWS available as rollback until TrueNAS is stable.

## Security Operator

Owns exposure and secrets.

Rules:

- Never expose TrueNAS UI, PostgreSQL, Redis, Docker socket, VNC/RDP, runner folders, or backups publicly.
- Prefer Cloudflare Tunnel for public HTTPS.
- Put secrets only in VM-local `.env` or GitHub secrets where unavoidable.
- Rotate any token or tunnel secret if it appears in logs, chat, commits, or docs.

## Deployment Engineer

Owns GitHub-driven deploys.

Rules:

- The deploy path is GitHub Actions -> GHCR -> self-hosted TrueNAS runner -> Compose deploy.
- Do not deploy from a dirty local worktree unless explicitly doing emergency repair.
- Every deployment takes a DB backup first.
- Every deployment runs `scripts/healthcheck.sh` after restart.
- Failed healthcheck means rollback or stop, not continued changes.

## Database Steward

Owns data integrity.

Rules:

- Prefer `pg_dump -Fc` for portable migration backups.
- Test restores regularly.
- Do not rely only on ZFS snapshots for PostgreSQL consistency.
- Freeze writes during final cutover.
- Keep AWS and TrueNAS dumps until rollback window closes.

## Shopify Integration Owner

Owns Shopify app correctness.

Rules:

- Shopify requires public HTTPS.
- Update app URL, redirect URLs, and webhook callback URLs during cutover.
- Re-register required store webhooks after URL change.
- Create hidden drafts first; do not live-publish during infrastructure validation.

## Operations Auditor

Owns evidence.

Rules:

- Verify `/health`.
- Verify production client audit.
- Verify PM2/Docker/Compose process status depending on active environment.
- Record active clients and blockers in docs.
- Keep runbooks current after every infrastructure change.

## Local Access Policy

Default access:

- SSH for server administration.
- TrueNAS VM console for emergency install/recovery only.
- GitHub runner for deployments.
- Cloudflare Access/Tailscale for private admin surfaces.

VNC policy:

- No permanent public VNC.
- Use VNC/RDP only over VPN or Cloudflare Access if a GUI is truly needed.
- Prefer headless Ubuntu Server.
