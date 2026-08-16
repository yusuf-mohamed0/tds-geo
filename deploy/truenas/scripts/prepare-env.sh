#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-$HOME/tds-geo-deploy}"
ENV_DIR="$DEPLOY_ROOT/deploy/truenas"
ENV_PATH="$ENV_DIR/.env"

mkdir -p "$ENV_DIR"
chmod 700 "$ENV_DIR"

install_env() {
  local src="$1"
  if [[ ! -s "$src" ]]; then
    echo "Refusing to install empty TrueNAS env file."
    exit 1
  fi
  bash -n <(printf 'set -a\n'; cat "$src"; printf '\nset +a\n')
  cp "$src" "$ENV_PATH"
  chmod 600 "$ENV_PATH"
}

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

quote_env_value() {
  local value="${1//$'\r'/}"
  value="${value//$'\n'/}"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}

set_env_pair() {
  local path="$1"
  local key="$2"
  local value="$3"
  local escaped

  [[ -n "$value" ]] || return 0
  escaped="$(quote_env_value "$value")"

  if grep -qE "^${key}=" "$path"; then
    local update_script="s|^${key}=.*|${key}=${escaped}|"
    sed -i "$update_script" "$path"
  else
    printf '%s=%s\n' "$key" "$escaped" >> "$path"
  fi
}

repair_existing_env() {
  local path="$1"
  local production_model="${TRUENAS_PRODUCTION_MODEL:-ministral-3:14b}"

  if ! grep -qE '^OLLAMA_MODEL=' "$path" || grep -qE '^OLLAMA_MODEL=["'"'']?llama3\.1:8b["'"'']?$' "$path"; then
    set_env_pair "$path" OLLAMA_MODEL "$production_model"
  fi

  if ! grep -qE '^OPENAI_MODEL=' "$path" || grep -qE '^OPENAI_MODEL=["'"'']?llama3\.1:8b["'"'']?$' "$path"; then
    set_env_pair "$path" OPENAI_MODEL "$production_model"
  fi
}

if [[ -s "$ENV_PATH" ]]; then
  repair_existing_env "$ENV_PATH"
  chmod 600 "$ENV_PATH"
  echo "truenas_env_ready existing"
  exit 0
fi

if [[ -n "${TRUENAS_ENV_B64:-}" ]]; then
  printf '%s' "$TRUENAS_ENV_B64" | base64 -d > "$tmp"
  install_env "$tmp"
  echo "truenas_env_ready secret_b64"
  exit 0
fi

if [[ -n "${TRUENAS_ENV:-}" ]]; then
  printf '%s\n' "$TRUENAS_ENV" > "$tmp"
  install_env "$tmp"
  echo "truenas_env_ready secret"
  exit 0
fi

for candidate in \
  /opt/kivo/deploy/truenas/.env \
  /opt/tds-geo/kivo-source/deploy/truenas/.env; do
  if [[ -r "$candidate" && -s "$candidate" ]]; then
    install_env "$candidate"
    echo "truenas_env_ready copied_existing"
    exit 0
  fi
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is unavailable and no TrueNAS env source exists."
  exit 1
fi

api_id="$(docker ps -q | while read -r id; do
  docker exec "$id" sh -c 'test -f /app/dist/backend/index.js' >/dev/null 2>&1 && echo "$id" && break
done)"

postgres_id="$(docker ps -q | while read -r id; do
  docker exec "$id" sh -c 'printenv POSTGRES_USER >/dev/null 2>&1 && printenv POSTGRES_DB >/dev/null 2>&1' >/dev/null 2>&1 && echo "$id" && break
done)"

redis_id="$(docker ps -q | while read -r id; do
  docker exec "$id" sh -c 'redis-cli ping >/dev/null 2>&1' >/dev/null 2>&1 && echo "$id" && break
done)"

if [[ -z "$api_id" ]]; then
  echo "No live API container found and no TrueNAS env source exists."
  exit 1
fi

write_pair() {
  local key="$1"
  local value="$2"
  if [[ -n "$value" ]]; then
    printf '%s=' "$key" >> "$tmp"
    quote_env_value "$value" >> "$tmp"
    printf '\n' >> "$tmp"
  fi
}

container_env() {
  local id="$1"
  local key="$2"
  docker exec "$id" printenv "$key" 2>/dev/null || true
}

mount_source() {
  local id="$1"
  local destination="$2"
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "'"$destination"'"}}{{.Source}}{{end}}{{end}}' "$id" 2>/dev/null || true
}

: > "$tmp"
write_pair COMPOSE_PROJECT_NAME "tds-geo"
write_pair TDS_IMAGE "${TDS_IMAGE:-ghcr.io/yusuf-mohamed0/tds-geo:truenas}"
write_pair TDS_PUBLIC_HOSTNAME "ai.trafficdigitalsolutions.com"
write_pair TDS_PUBLIC_URL "https://ai.trafficdigitalsolutions.com"
write_pair NODE_ENV "production"
write_pair PORT "3000"

for key in \
  JWT_SECRET CREDENTIAL_VAULT_KEY ENCRYPTION_KEY DATABASE_URL REDIS_URL \
  OPENAI_API_KEY OPENAI_BASE_URL OPENAI_FALLBACK_KEY OPENAI_MODEL OPENAI_MAX_TOKENS \
  AI_PROVIDER OLLAMA_BASE_URL OLLAMA_API_KEY OLLAMA_MODEL OLLAMA_MAX_TOKENS OLLAMA_TEMPERATURE \
  SERPAPI_API_KEY DATAFORSEO_API_KEY \
  DATAFORSEO_LOGIN DATAFORSEO_PASSWORD SHOPIFY_API_KEY SHOPIFY_API_SECRET \
  SHOPIFY_APP_URL SHOPIFY_DEFAULT_SHOP SHOPIFY_DEFAULT_ACCESS_TOKEN \
  SHOPIFY_DEFAULT_API_VERSION GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GOOGLE_REDIRECT_URI \
  GSC_CLIENT_ID GSC_CLIENT_SECRET GSC_REDIRECT_URI CORS_ORIGIN KOZMO_AI_WORDPRESS_API_KEY \
  API_KEY VAULT_PAGE_PASSWORD AUTO_PUBLISH_ENABLED ENABLE_SIDECARS HEADROOM_BASE_URL \
  CRAWL4AI_URL OPENSEO_URL FREELMAPI_ENCRYPTION_KEY; do
  write_pair "$key" "$(container_env "$api_id" "$key")"
done

if [[ -n "$postgres_id" ]]; then
  write_pair DB_USER "$(container_env "$postgres_id" POSTGRES_USER)"
  write_pair DB_PASSWORD "$(container_env "$postgres_id" POSTGRES_PASSWORD)"
  write_pair DB_NAME "$(container_env "$postgres_id" POSTGRES_DB)"
  write_pair POSTGRES_DATA "$(mount_source "$postgres_id" /var/lib/postgresql/data)"
else
  write_pair DB_USER "tds_geo"
  write_pair DB_NAME "ai_seo_automation"
fi

if [[ -n "$redis_id" ]]; then
  write_pair REDIS_DATA "$(mount_source "$redis_id" /data)"
fi

write_pair BACKUP_DIR "${BACKUP_DIR:-/mnt/tds-geo/backups}"
write_pair LOG_DIR "${LOG_DIR:-/mnt/tds-geo/logs}"
write_pair CLOUDFLARED_DIR "${CLOUDFLARED_DIR:-/mnt/tds-geo/cloudflared}"
write_pair BACKUP_RETENTION_DAYS "${BACKUP_RETENTION_DAYS:-14}"
write_pair PRE_DEPLOY_BACKUP_REQUIRED "${PRE_DEPLOY_BACKUP_REQUIRED:-true}"
write_pair ENABLE_CLOUDFLARED "${ENABLE_CLOUDFLARED:-false}"
write_pair ENABLE_DIRECT_HTTPS "${ENABLE_DIRECT_HTTPS:-false}"
write_pair CLOUDFLARED_TOKEN "${CLOUDFLARED_TOKEN:-}"

install_env "$tmp"
repair_existing_env "$ENV_PATH"
echo "truenas_env_ready bootstrapped_from_live_containers"
