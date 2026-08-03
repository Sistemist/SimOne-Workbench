#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
remote_host="${SIMONE_KVM_HOST:-root@187.77.88.78}"
expected_ipv4="${SIMONE_KVM_IPV4:-${remote_host#*@}}"
tls_config="$repo_root/deploy/nginx/app.sysdom.ai.tls.conf"
remote_staged_config="/tmp/app.sysdom.ai.tls.conf"

test -f "$tls_config"
resolved_ipv4="$(dig +short app.sysdom.ai A | tail -n 1)"
if [ "$resolved_ipv4" != "$expected_ipv4" ]; then
  echo "Refusing TLS activation: app.sysdom.ai resolves to '${resolved_ipv4:-nothing}', expected '$expected_ipv4'." >&2
  exit 1
fi

scp -q "$tls_config" "$remote_host:$remote_staged_config"

ssh "$remote_host" bash -s -- "$remote_staged_config" <<'REMOTE_ACTIVATE'
set -euo pipefail

staged_config="$1"
site_available="/etc/nginx/sites-available/app.sysdom.ai"
backup_config="/etc/nginx/sites-available/app.sysdom.ai.pre-tls"

cp "$site_available" "$backup_config"
rollback() {
  status=$?
  trap - EXIT
  cp "$backup_config" "$site_available"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
  rm -f "$staged_config"
  exit "$status"
}
trap rollback EXIT

certbot certonly --webroot \
  --webroot-path /var/www/letsencrypt \
  --domain app.sysdom.ai \
  --non-interactive \
  --agree-tos

install -m 0644 "$staged_config" "$site_available"
nginx -t
systemctl reload nginx

root_status="$(curl -sS -o /dev/null -w '%{http_code}' https://app.sysdom.ai/)"
root_location="$(curl -sSI https://app.sysdom.ai/ | tr -d '\r' | sed -n 's/^[Ll]ocation: //p')"
if [ "$root_status" != "302" ] || [ "$root_location" != "/app" ]; then
  echo "App root must redirect to /app; received status=$root_status location=$root_location." >&2
  exit 1
fi
curl -fsS https://app.sysdom.ai/app | grep -q '<title>Sysdom AI'
curl -fsS https://app.sysdom.ai/scanner | grep -q '<title>Sysdom AI'
curl -fsS https://app.sysdom.ai/request-access | grep -q '<title>Sysdom AI'
curl -fsS https://app.sysdom.ai/auth/forgot-password | grep -q '<title>Sysdom AI'
curl -fsS https://sim.sysdom.org/app | grep -q '<title>Sysdom AI'

rm -f "$backup_config" "$staged_config"
trap - EXIT
printf '%s\n' \
  "APP_SYSDOM_TLS=active" \
  "APP_PRODUCT_SMOKE=passed" \
  "LEGACY_SIM_SMOKE=passed"
REMOTE_ACTIVATE
