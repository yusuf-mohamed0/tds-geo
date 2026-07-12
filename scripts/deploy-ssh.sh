#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# TDS Geo — SSH Deploy Helper
# Usage: ./scripts/deploy-ssh.sh <staging|production> <command>
#
# Executes a command on the remote server via SSH.
# Reads SSH host from environment variables:
#   STAGING_SSH_HOST or PRODUCTION_SSH_HOST
# ──────────────────────────────────────────────────────────
set -euo pipefail

ENV="${1:-}"
CMD="${2:-}"

if [ -z "$ENV" ] || [ -z "$CMD" ]; then
  echo "Usage: $0 <staging|production> <command>"
  echo ""
  echo "Examples:"
  echo "  $0 staging 'docker ps'"
  echo "  $0 production 'docker compose -f docker-compose.prod.yml logs --tail=100'"
  exit 1
fi

# Resolve SSH host
SSH_HOST="${ENV}_SSH_HOST"
SSH_HOST="${!SSH_HOST:-}"

if [ -z "$SSH_HOST" ]; then
  echo "ERROR: \$${ENV}_SSH_HOST is not set."
  echo "Set it in your environment or .env file."
  exit 1
fi

SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"

echo "─── [$ENV] ssh $SSH_HOST ───"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$SSH_HOST" "$CMD"
