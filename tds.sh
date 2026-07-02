#!/bin/bash
# tds — main CLI entry for TDS ecosystem
TDS_ROOT="/root/tds-geo"
cd "$TDS_ROOT" || { echo "Error: TDS root not found at $TDS_ROOT"; exit 1; }

case "$1" in
  vault)
    shift
    exec npx tsx "$TDS_ROOT/backend/scripts/vault.ts" "$@"
    ;;
  import)
    exec npx tsx "$TDS_ROOT/backend/scripts/importCredentials.ts"
    ;;
  server)
    exec npx tsx "$TDS_ROOT/backend/index.ts"
    ;;
  vault-ui)
    bash "$TDS_ROOT/start-vault-ui.sh"
    ;;
  ui)
    bash "$TDS_ROOT/start-vault-ui.sh"
    ;;
  *)
    echo "TDS Geo — Password Vault & CLI Tools"
    echo ""
    echo "Commands:"
    echo "  vault list [cat] [svc]   List credentials"
    echo "  vault get <id>           Decrypt & show credential"
    echo "  vault set <svc> <label>  Add credential"
    echo "  vault del <id>           Delete credential"
    echo "  vault rotate <id>        Generate new password"
    echo "  vault export             Export all as JSON"
    echo "  vault import <file>      Import from JSON file"
    echo "  vault-ui / ui            Start browser UI (port 3456)"
    echo "  import                   Import from doc/clients/"
    echo "  server                   Start API server"
    echo ""
    echo "Examples:"
    echo "  tds vault list"
    echo "  tds vault list wordpress"
    echo "  tds vault get <uuid>"
    echo "  tds ui                   Open vault in browser"
    ;;
esac
