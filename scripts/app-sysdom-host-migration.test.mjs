import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stageScript = fs.readFileSync(new URL("./stage-app-sysdom-host-kvm.sh", import.meta.url), "utf8");
const activateScript = fs.readFileSync(new URL("./activate-app-sysdom-host-kvm.sh", import.meta.url), "utf8");
const deployScript = fs.readFileSync(new URL("./deploy-simone-kvm.sh", import.meta.url), "utf8");
const compose = fs.readFileSync(new URL("../docker/docker-compose.simone-public.yml", import.meta.url), "utf8");
const preDnsNginx = fs.readFileSync(new URL("../deploy/nginx/app.sysdom.ai.pre-dns.conf", import.meta.url), "utf8");
const tlsNginx = fs.readFileSync(new URL("../deploy/nginx/app.sysdom.ai.tls.conf", import.meta.url), "utf8");

test("pre-DNS configuration fails closed while retaining ACME challenge routing", () => {
  assert.match(preDnsNginx, /server_name app\.sysdom\.ai/);
  assert.match(preDnsNginx, /\/\.well-known\/acme-challenge\//);
  assert.match(preDnsNginx, /return 503/);
  assert.doesNotMatch(preDnsNginx, /proxy_pass/);
  assert.match(stageScript, /APP_HTTP_EXPOSURE=503_fail_closed/);
  assert.match(stageScript, /LEGACY_SIM_SMOKE=passed/);
  assert.match(stageScript, /rollback/);
});

test("dual-host runtime trust preserves the verified legacy host", () => {
  assert.match(compose, /sim\.sysdom\.org,app\.sysdom\.ai,localhost/);
  assert.match(compose, /https:\/\/sim\.sysdom\.org/);
  assert.match(compose, /https:\/\/app\.sysdom\.ai/);
  assert.match(stageScript, /append_csv_env PAPERCLIP_ALLOWED_HOSTNAMES app\.sysdom\.ai/);
  assert.match(stageScript, /append_csv_env BETTER_AUTH_TRUSTED_ORIGINS https:\/\/app\.sysdom\.ai/);
});

test("TLS activation waits for exact DNS and routes the product-only host", () => {
  assert.match(activateScript, /Refusing TLS activation/);
  assert.match(activateScript, /certbot certonly --webroot/);
  assert.match(tlsNginx, /ssl_certificate \/etc\/letsencrypt\/live\/app\.sysdom\.ai\/fullchain\.pem/);
  assert.match(tlsNginx, /proxy_pass http:\/\/127\.0\.0\.1:3100/);
  assert.match(tlsNginx, /location = \/ \{\s+return 302 \/app;/);
  assert.doesNotMatch(tlsNginx, /127\.0\.0\.1:3200/);
  assert.match(activateScript, /https:\/\/app\.sysdom\.ai\/scanner/);
  assert.match(activateScript, /https:\/\/app\.sysdom\.ai\/request-access/);
  assert.match(activateScript, /App root must redirect to https:\/\/app\.sysdom\.ai\/app/);
  assert.match(activateScript, /for _ in \$\(seq 1 15\)/);
});

test("deploy smoke supports both the legacy split host and product-only app host", () => {
  assert.match(deployScript, /https:\/\/\$public_host\/request-access/);
  assert.match(deployScript, /if \[ "\$public_host" = "sim\.sysdom\.org" \]/);
  assert.match(deployScript, /<title>SimOne \\\| The conscious agent company/);
  assert.match(deployScript, /Product-only root smoke failed/);
  assert.match(deployScript, /\[ "\$root_location" != "https:\/\/\$public_host\/app" \]/);
});
