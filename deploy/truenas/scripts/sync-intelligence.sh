#!/usr/bin/env bash
# <YKS />  YUSUF KO STA  Code. Build. Ship.(TM)
# Keep exported n8n workflow files and GitNexus paired with the clean source checkout.
set -euo pipefail

SOURCE_DIR="${KIVO_SOURCE_DIR:-/opt/tds-geo/kivo-source}"
N8N_DB="${N8N_SQLITE_DB:-$HOME/.n8n/database.sqlite}"
EXPORT_DIR="${N8N_WORKFLOW_EXPORT_DIR:-$SOURCE_DIR/n8n/workflows/exported}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ ! -d "$SOURCE_DIR/.git" ] && [ ! -f "$SOURCE_DIR/.source-commit" ]; then
  echo "source checkout is missing both .git and .source-commit: $SOURCE_DIR" >&2
  exit 2
fi

if [ -f "$N8N_DB" ] && command -v sqlite3 >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  (cd "$SOURCE_DIR" && N8N_SQLITE_DB="$N8N_DB" N8N_WORKFLOW_EXPORT_DIR="$EXPORT_DIR" node scripts/export-n8n-workflows.mjs)
else
  echo "n8n export skipped: missing sqlite DB, sqlite3, or node ($N8N_DB)" >&2
fi

"$SCRIPT_DIR/refresh-gitnexus.sh"
"$SCRIPT_DIR/check-pairing.sh"
