#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

remote_host="${SIMONE_KVM_HOST:-root@187.77.88.78}"
remote_root="${SIMONE_KVM_ROOT:-/root/simone-workbench}"
project_name="${SIMONE_COMPOSE_PROJECT:-simone-workbench}"
public_host="${SIMONE_PUBLIC_HOST:-sim.sysdom.org}"

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
  --exclude 'output/playwright/' \
  --exclude '.DS_Store' \
  "$repo_root/" "$remote_host:$remote_root/"

ssh "$remote_host" "set -euo pipefail
cd '$remote_root/docker'
docker compose --project-name '$project_name' --env-file .env.simone-public -f docker-compose.quickstart.yml -f docker-compose.simone-public.yml build paperclip
docker compose --project-name '$project_name' --env-file .env.simone-public -f docker-compose.quickstart.yml -f docker-compose.simone-public.yml up -d --no-deps --force-recreate paperclip
for i in \$(seq 1 30); do
  if curl -fsS http://127.0.0.1:3100/api/health >/tmp/simone-workbench-health.json; then
    cat /tmp/simone-workbench-health.json
    break
  fi
  if [ \"\$i\" = 30 ]; then
    echo 'Workbench health check timed out' >&2
    exit 1
  fi
  sleep 2
done
"

curl -fsS --resolve "$public_host:443:${remote_host#*@}" "https://$public_host/app" | rg -q '<title>SimOne'
curl -fsS --resolve "$public_host:443:${remote_host#*@}" "https://$public_host/scanner" | rg -q '<title>SimOne'
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

echo "SimOne Workbench deploy smoke passed for https://$public_host/app"
