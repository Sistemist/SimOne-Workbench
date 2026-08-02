#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

remote_host="${SIMONE_KVM_HOST:-root@187.77.88.78}"
remote_root="${SIMONE_KVM_ROOT:-/root/simone-workbench}"
project_name="${SIMONE_COMPOSE_PROJECT:-simone-workbench}"
public_host="${SIMONE_PUBLIC_HOST:-sim.sysdom.org}"
required_branch="${SIMONE_DEPLOY_BRANCH:-simone-main}"

deploy_sha="$(git -C "$repo_root" rev-parse HEAD)"
deploy_short_sha="$(git -C "$repo_root" rev-parse --short=12 HEAD)"
deploy_branch="$(git -C "$repo_root" branch --show-current)"
deploy_timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

node "$repo_root/scripts/check-docker-runtime-pins.mjs"

if [ -n "$(git -C "$repo_root" status --porcelain --untracked-files=normal)" ]; then
  echo "Refusing to deploy a dirty worktree. Commit or remove local changes first." >&2
  exit 1
fi

if [ "$deploy_branch" != "$required_branch" ] && [ "${SIMONE_DEPLOY_ALLOW_NON_DEFAULT_BRANCH:-false}" != "true" ]; then
  echo "Refusing to deploy branch '$deploy_branch'; expected '$required_branch'." >&2
  exit 1
fi

if upstream_sha="$(git -C "$repo_root" rev-parse '@{upstream}' 2>/dev/null)"; then
  if [ "$upstream_sha" != "$deploy_sha" ] && [ "${SIMONE_DEPLOY_ALLOW_UNPUSHED:-false}" != "true" ]; then
    echo "Refusing to deploy commit $deploy_short_sha because it is not the pushed upstream commit." >&2
    exit 1
  fi
elif [ "${SIMONE_DEPLOY_ALLOW_UNPUSHED:-false}" != "true" ]; then
  echo "Refusing to deploy without an upstream branch. Push the commit first." >&2
  exit 1
fi

echo "Deploying clean commit $deploy_short_sha from $deploy_branch at $deploy_timestamp"

rsync -az \
  --exclude '.git/' \
  --exclude '.obsidian/' \
  --exclude '.env*' \
  --exclude 'node_modules/' \
  --exclude '**/node_modules/' \
  --exclude 'dist/' \
  --exclude 'ui/dist/' \
  --exclude 'ui/storybook-static/' \
  --exclude 'data/' \
  --exclude '.paperclip/' \
  --exclude '.playwright-cli/' \
  --exclude 'doc/' \
  --exclude 'docs/' \
  --exclude 'output/' \
  --exclude 'ARCHITECTURE.md' \
  --exclude 'Paperclip AI License Verification.md' \
  --exclude '.DS_Store' \
  "$repo_root/" "$remote_host:$remote_root/"

remote_deployed=false

rollback_remote_deploy() {
  ssh "$remote_host" bash -s -- "$remote_root" "$project_name" <<'REMOTE_ROLLBACK'
set -euo pipefail
remote_root="$1"
project_name="$2"
metadata_dir="$remote_root/.deployments"
current_file="$metadata_dir/current.env"

if [ ! -f "$current_file" ]; then
  echo "No deployment metadata is available for rollback." >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$current_file"
if [ -z "${ROLLBACK_TAG:-}" ] || [ -z "${PREVIOUS_IMAGE_REF:-}" ]; then
  echo "No previous image was recorded; automatic rollback is unavailable." >&2
  exit 1
fi

compose() {
  docker compose --project-name "$project_name" --env-file .env.simone-public \
    -f docker-compose.quickstart.yml -f docker-compose.simone-public.yml "$@"
}

cd "$remote_root/docker"
docker tag "$ROLLBACK_TAG" "$PREVIOUS_IMAGE_REF"
compose up -d --no-deps --force-recreate paperclip
cp "$current_file" "$metadata_dir/failed-${DEPLOY_SHA:-unknown}.env"
if [ -f "$metadata_dir/previous.env" ]; then
  cp "$metadata_dir/previous.env" "$current_file"
fi
echo "Rolled back SimOne to $ROLLBACK_TAG"
REMOTE_ROLLBACK
}

rollback_on_exit() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ] && [ "$remote_deployed" = true ]; then
    echo "Deploy smoke failed; restoring the previously recorded image." >&2
    rollback_remote_deploy || echo "Automatic rollback failed; use $remote_root/.deployments/current.env for recovery." >&2
  fi
  exit "$status"
}
trap rollback_on_exit EXIT

ssh "$remote_host" bash -s -- \
  "$remote_root" "$project_name" "$deploy_sha" "$deploy_short_sha" "$deploy_branch" "$deploy_timestamp" <<'REMOTE_DEPLOY'
set -euo pipefail
remote_root="$1"
project_name="$2"
deploy_sha="$3"
deploy_short_sha="$4"
deploy_branch="$5"
deploy_timestamp="$6"
metadata_dir="$remote_root/.deployments"
current_file="$metadata_dir/current.env"
previous_file="$metadata_dir/previous.env"
pending_file="$metadata_dir/pending.env"

compose() {
  docker compose --project-name "$project_name" --env-file .env.simone-public \
    -f docker-compose.quickstart.yml -f docker-compose.simone-public.yml "$@"
}

mkdir -p "$metadata_dir"
if [ -f "$current_file" ]; then
  cp "$current_file" "$previous_file"
fi

cd "$remote_root/docker"
previous_container_id="$(compose ps -q paperclip 2>/dev/null || true)"
previous_image_id=""
previous_image_ref=""
rollback_tag=""
if [ -n "$previous_container_id" ]; then
  previous_image_id="$(docker inspect --format '{{.Image}}' "$previous_container_id")"
  previous_image_ref="$(docker inspect --format '{{.Config.Image}}' "$previous_container_id")"
  previous_release_sha="$(sed -n 's/^DEPLOY_SHA=//p' "$current_file" 2>/dev/null | head -n 1 || true)"
  previous_release_sha="${previous_release_sha:-pre-$deploy_short_sha}"
  previous_release_sha="${previous_release_sha//[^a-zA-Z0-9_.-]/-}"
  rollback_tag="simone-workbench-paperclip:rollback-${previous_release_sha:0:40}"
  docker tag "$previous_image_id" "$rollback_tag"
fi

printf '%s\n' \
  "DEPLOY_SHA=$deploy_sha" \
  "DEPLOY_BRANCH=$deploy_branch" \
  "DEPLOYED_AT=$deploy_timestamp" \
  "PREVIOUS_IMAGE_ID=$previous_image_id" \
  "PREVIOUS_IMAGE_REF=$previous_image_ref" \
  "ROLLBACK_TAG=$rollback_tag" \
  >"$pending_file"

rollback_to_previous() {
  if [ -z "$rollback_tag" ] || [ -z "$previous_image_ref" ]; then
    echo "No previous image was recorded; automatic rollback is unavailable." >&2
    return 1
  fi
  docker tag "$rollback_tag" "$previous_image_ref"
  compose up -d --no-deps --force-recreate paperclip
  cp "$pending_file" "$metadata_dir/failed-$deploy_sha.env"
  rm -f "$pending_file"
  echo "Restored previous image $rollback_tag" >&2
}

rm -rf \
  "$remote_root/doc" \
  "$remote_root/docs" \
  "$remote_root/output" \
  "$remote_root/ARCHITECTURE.md" \
  "$remote_root/Paperclip AI License Verification.md"

compose build paperclip
if ! compose up -d --no-deps --force-recreate paperclip; then
  rollback_to_previous || true
  exit 1
fi

healthy=false
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3100/api/health >/tmp/simone-workbench-health.json; then
    cat /tmp/simone-workbench-health.json
    healthy=true
    break
  fi
  sleep 2
done
if [ "$healthy" != true ]; then
  echo 'Workbench health check timed out' >&2
  rollback_to_previous || true
  exit 1
fi

new_container_id="$(compose ps -q paperclip)"
new_image_id="$(docker inspect --format '{{.Image}}' "$new_container_id")"
new_image_ref="$(docker inspect --format '{{.Config.Image}}' "$new_container_id")"
printf '%s\n' "IMAGE_ID=$new_image_id" "IMAGE_REF=$new_image_ref" >>"$pending_file"
mv "$pending_file" "$current_file"
cat "$current_file"
REMOTE_DEPLOY

remote_deployed=true

curl -fsS --resolve "$public_host:443:${remote_host#*@}" "https://$public_host/app" | rg -q '<title>Sysdom AI'
curl -fsS --resolve "$public_host:443:${remote_host#*@}" "https://$public_host/scanner" | rg -q '<title>Sysdom AI'
curl -fsS --resolve "$public_host:443:${remote_host#*@}" "https://$public_host/" | rg -q '<title>SimOne \| The conscious agent company'

signup_status="$(
  curl -sS -o /tmp/simone-signup-smoke.json -w '%{http_code}' \
    --resolve "$public_host:443:${remote_host#*@}" \
    "https://$public_host/api/signup" \
    -H 'content-type: application/json' \
    --data '{"email":"bad"}'
)"
if [ "$signup_status" != "400" ] || ! rg -q 'Please enter a valid email address' /tmp/simone-signup-smoke.json; then
  echo "Landing signup smoke failed with status $signup_status" >&2
  cat /tmp/simone-signup-smoke.json >&2
  exit 1
fi

curl -fsSI https://dify.tissuu.ai/apps >/dev/null

ssh "$remote_host" bash -s -- "$remote_root" <<'REMOTE_PRUNE'
set -u
remote_root="$1"
docker builder prune --force --filter 'until=168h' --keep-storage 10GB \
  || echo 'Warning: Docker builder cache prune did not complete.' >&2
docker image prune --force --filter 'until=168h' \
  || echo 'Warning: dangling image prune did not complete.' >&2
cat "$remote_root/.deployments/current.env"
REMOTE_PRUNE

remote_deployed=false
trap - EXIT
echo "SimOne Workbench deploy smoke passed for https://$public_host/app at commit $deploy_short_sha"
