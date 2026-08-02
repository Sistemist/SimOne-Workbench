#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_root="$repo_root/packages/sysdom-canon-mcp"
remote_host="${SYSDOM_CANON_KVM_HOST:-simone-kvm}"
remote_root="${SYSDOM_CANON_KVM_ROOT:-/root/sysdom-canon-mcp}"
dataset_id="${SYSDOM_CANON_DATASET_ID:-973465e9-a163-4797-81f8-102fa3c61e45}"
dataset_tenant_id="${SYSDOM_CANON_DATASET_TENANT_ID:-2ccbe888-c75d-4edc-9a56-9cd41fa6118f}"

deploy_sha="$(git -C "$repo_root" rev-parse HEAD)"
deploy_short_sha="$(git -C "$repo_root" rev-parse --short=12 HEAD)"
image_ref="sysdom-canon-mcp:$deploy_short_sha"
stage_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$stage_dir"
}
trap cleanup EXIT

if [ -n "$(git -C "$repo_root" status --porcelain --untracked-files=normal)" ]; then
  echo "Refusing to deploy a dirty worktree. Commit the MCP slice first." >&2
  exit 1
fi

node "$package_root/node_modules/typescript/bin/tsc" --noEmit -p "$package_root/tsconfig.json"
node "$package_root/node_modules/vitest/vitest.mjs" run --config "$package_root/vitest.config.ts" \
  "$package_root/src"
node "$package_root/node_modules/typescript/bin/tsc" -p "$package_root/tsconfig.build.json"

COREPACK_ENABLE_STRICT=0 corepack pnpm --config.engine-strict=false \
  --filter @sysdomai/canon-mcp deploy --prod "$stage_dir/release"
cp "$package_root/deploy/Dockerfile" "$stage_dir/release/Dockerfile"
cp "$package_root/deploy/docker-compose.yml" "$stage_dir/docker-compose.yml"

ssh "$remote_host" "mkdir -p '$remote_root/releases/$deploy_short_sha'"
rsync -az --delete "$stage_dir/release/" \
  "$remote_host:$remote_root/releases/$deploy_short_sha/"
rsync -az "$stage_dir/docker-compose.yml" \
  "$remote_host:$remote_root/docker-compose.yml"

ssh "$remote_host" bash -s -- \
  "$remote_root" "$deploy_short_sha" "$image_ref" "$dataset_id" "$dataset_tenant_id" <<'REMOTE'
set -euo pipefail
remote_root="$1"
deploy_short_sha="$2"
image_ref="$3"
dataset_id="$4"
dataset_tenant_id="$5"
service_env="$remote_root/.env.service"
deploy_env="$remote_root/.deploy.env"
previous_env="$remote_root/.deploy.previous.env"

mkdir -p "$remote_root"
umask 077

if [ ! -f "$service_env" ]; then
  dify_token_id="$(cat /proc/sys/kernel/random/uuid)"
  dify_token="dataset-$(openssl rand -hex 12)"
  mcp_token="$(openssl rand -hex 32)"

  docker exec -i dify-db sh -lc \
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
INSERT INTO api_tokens (id, app_id, type, token, last_used_at, created_at, tenant_id)
VALUES ('$dify_token_id', NULL, 'dataset', '$dify_token', NULL, NOW(), '$dataset_tenant_id');
SQL

  printf '%s\n' \
    "DIFY_API_URL=https://dify.tissuu.ai/v1" \
    "DIFY_API_KEY=$dify_token" \
    "DIFY_DATASET_ID=$dataset_id" \
    "DIFY_RETRIEVAL_SEARCH_METHOD=full_text_search" \
    "DIFY_RETRIEVAL_TOP_K=5" \
    "DIFY_RETRIEVAL_TIMEOUT_MS=10000" \
    "SYSDOM_CANON_MAX_PASSAGE_CHARS=4000" \
    "SYSDOM_CANON_MAX_TOTAL_CHARS=16000" \
    "SYSDOM_CANON_MCP_TOKEN=$mcp_token" \
    "SYSDOM_CANON_HTTP_HOST=0.0.0.0" \
    "SYSDOM_CANON_HTTP_PORT=3215" \
    "SYSDOM_CANON_ALLOWED_HOSTS=mcp.sysdom.ai,localhost,127.0.0.1" \
    "SYSDOM_CANON_MAX_REQUEST_BYTES=262144" \
    >"$service_env"
  chmod 600 "$service_env"
  printf '%s\n' "$dify_token_id" >"$remote_root/.dify-token-id"
  chmod 600 "$remote_root/.dify-token-id"
fi

# Early private deployments used keyword_search, but this collection's
# deterministic text index is exposed through full_text_search.
if grep -q '^DIFY_RETRIEVAL_SEARCH_METHOD=keyword_search$' "$service_env"; then
  sed -i 's/^DIFY_RETRIEVAL_SEARCH_METHOD=keyword_search$/DIFY_RETRIEVAL_SEARCH_METHOD=full_text_search/' \
    "$service_env"
fi

docker build --pull -t "$image_ref" "$remote_root/releases/$deploy_short_sha"

if [ -f "$deploy_env" ]; then
  cp "$deploy_env" "$previous_env"
fi
printf 'SYSDOM_CANON_IMAGE=%s\n' "$image_ref" >"$deploy_env"

rollback() {
  if [ -f "$previous_env" ]; then
    cp "$previous_env" "$deploy_env"
    docker compose --env-file "$deploy_env" -f "$remote_root/docker-compose.yml" up -d
    echo "Restored the previous Sysdom canon MCP image." >&2
  else
    docker compose --env-file "$deploy_env" -f "$remote_root/docker-compose.yml" down || true
  fi
}

if ! docker compose --env-file "$deploy_env" -f "$remote_root/docker-compose.yml" up -d; then
  rollback
  exit 1
fi

healthy=false
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3215/healthz >/tmp/sysdom-canon-health.json; then
    healthy=true
    break
  fi
  sleep 2
done

if [ "$healthy" != true ]; then
  docker logs --tail 80 sysdom-canon-mcp >&2 || true
  rollback
  exit 1
fi

jq -e '.status == "ok" and .retrievalOnly == true' \
  /tmp/sysdom-canon-health.json >/dev/null
cat /tmp/sysdom-canon-health.json
docker inspect --format '{{.Name}} {{.Config.Image}} {{.State.Health.Status}}' sysdom-canon-mcp
printf 'DEPLOY_SHA=%s\n' "$deploy_short_sha" >"$remote_root/current.env"
REMOTE

echo "Sysdom canon MCP deployed privately on KVM2 at commit $deploy_short_sha"
