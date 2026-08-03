#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
remote_host="${SIMONE_KVM_HOST:-root@187.77.88.78}"
remote_root="${SIMONE_KVM_ROOT:-/root/simone-workbench}"
project_name="${SIMONE_COMPOSE_PROJECT:-simone-workbench}"
pre_dns_config="$repo_root/deploy/nginx/app.sysdom.ai.pre-dns.conf"
remote_staged_config="/tmp/app.sysdom.ai.pre-dns.conf"

test -f "$pre_dns_config"
scp -q "$pre_dns_config" "$remote_host:$remote_staged_config"

ssh "$remote_host" bash -s -- \
  "$remote_root" "$project_name" "$remote_staged_config" <<'REMOTE_STAGE'
set -euo pipefail

remote_root="$1"
project_name="$2"
staged_config="$3"
env_file="$remote_root/docker/.env.simone-public"
site_available="/etc/nginx/sites-available/app.sysdom.ai"
site_enabled="/etc/nginx/sites-enabled/app.sysdom.ai"
backup_dir="$remote_root/.deployments/app-sysdom-pre-dns-$(date -u +%Y%m%dT%H%M%SZ)"
env_backup="$backup_dir/env.simone-public"
nginx_backup="$backup_dir/nginx.conf"
had_nginx_config=false
committed=false

mkdir -p "$backup_dir" /var/www/letsencrypt/.well-known/acme-challenge
cp "$env_file" "$env_backup"
if [ -f "$site_available" ]; then
  cp "$site_available" "$nginx_backup"
  had_nginx_config=true
fi

compose() {
  cd "$remote_root/docker"
  docker compose --project-name "$project_name" --env-file .env.simone-public \
    -f docker-compose.quickstart.yml -f docker-compose.simone-public.yml "$@"
}

append_csv_env() {
  key="$1"
  value="$2"
  current="$(sed -n "s/^${key}=//p" "$env_file" | head -n 1)"
  case ",$current," in
    *",$value,"*) return 0 ;;
  esac
  if [ -n "$current" ]; then
    replacement="$key=$current,$value"
  else
    replacement="$key=$value"
  fi
  temp_file="$(mktemp "${env_file}.XXXXXX")"
  awk -v prefix="$key=" -v replacement="$replacement" '
    index($0, prefix) == 1 { print replacement; found = 1; next }
    { print }
    END { if (!found) print replacement }
  ' "$env_file" >"$temp_file"
  chmod --reference="$env_file" "$temp_file"
  chown --reference="$env_file" "$temp_file"
  mv "$temp_file" "$env_file"
}

rollback() {
  status=$?
  trap - EXIT
  if [ "$committed" = false ]; then
    cp "$env_backup" "$env_file"
    if [ "$had_nginx_config" = true ]; then
      cp "$nginx_backup" "$site_available"
      ln -sfn "$site_available" "$site_enabled"
    else
      rm -f "$site_available" "$site_enabled"
    fi
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
    compose up -d --no-deps --force-recreate paperclip >/dev/null 2>&1 || true
  fi
  rm -f "$staged_config"
  exit "$status"
}
trap rollback EXIT

append_csv_env PAPERCLIP_ALLOWED_HOSTNAMES app.sysdom.ai
append_csv_env BETTER_AUTH_TRUSTED_ORIGINS https://app.sysdom.ai
append_csv_env BETTER_AUTH_TRUSTED_ORIGINS http://app.sysdom.ai

install -m 0644 "$staged_config" "$site_available"
ln -sfn "$site_available" "$site_enabled"
nginx -t
systemctl reload nginx

compose up -d --no-deps --force-recreate paperclip

healthy=false
for _ in $(seq 1 30); do
  if curl -fsS -H 'Host: app.sysdom.ai' http://127.0.0.1:3100/api/health >/tmp/app-sysdom-health.json; then
    healthy=true
    break
  fi
  sleep 2
done
if [ "$healthy" != true ]; then
  echo "App container did not accept app.sysdom.ai after runtime trust update." >&2
  exit 1
fi

curl -fsS -H 'Host: app.sysdom.ai' http://127.0.0.1:3100/scanner | grep -q '<title>Sysdom AI'
status="$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: app.sysdom.ai' http://127.0.0.1/)"
if [ "$status" != "503" ]; then
  echo "Pre-DNS hostname must fail closed with HTTP 503; received $status." >&2
  exit 1
fi

curl -fsS https://sim.sysdom.org/app | grep -q '<title>Sysdom AI'

committed=true
rm -f "$staged_config"
trap - EXIT
printf '%s\n' \
  "APP_SYSDOM_PRE_DNS=ready" \
  "APP_RUNTIME_HOST_TRUST=ready" \
  "APP_HTTP_EXPOSURE=503_fail_closed" \
  "LEGACY_SIM_SMOKE=passed" \
  "ROLLBACK_BACKUP=$backup_dir"
REMOTE_STAGE
