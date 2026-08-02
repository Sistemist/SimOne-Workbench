import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_EXTERNAL_MIGRATION_EVIDENCE,
  evaluateSysdomRuntimeMigrationReadiness,
} from "./check-sysdom-runtime-migration-readiness.mjs";

const deployScript = `
public_host="\${SIMONE_PUBLIC_HOST:-sim.sysdom.org}"
docker-compose.simone-public.yml
simone-workbench
rollback_remote_deploy
rollback_on_exit
.deployments
current.env
previous.env
ROLLBACK_TAG=
PREVIOUS_IMAGE_REF=
curl "https://$public_host/app" | rg -q '<title>Sysdom AI'
curl "https://$public_host/scanner" | rg -q '<title>Sysdom AI'
curl "https://$public_host/auth/forgot-password" | rg -q '<title>Sysdom AI'
curl "https://$public_host/" | rg -q '<title>SimOne \\| The conscious agent company'
curl "https://$public_host/api/signup"
`;

const compose = `
PAPERCLIP_ALLOWED_HOSTNAMES: "\${PAPERCLIP_ALLOWED_HOSTNAMES:-sim.sysdom.org}"
BETTER_AUTH_TRUSTED_ORIGINS: "\${BETTER_AUTH_TRUSTED_ORIGINS:-https://sim.sysdom.org}"
SIMONE_PASSWORD_RESET_FROM: "\${SIMONE_PASSWORD_RESET_FROM:-}"
SIMONE_TISSUU_BRIDGE_BASE_URL: "\${SIMONE_TISSUU_BRIDGE_BASE_URL:-https://example.com}"
`;

function readyInput(overrides = {}) {
  return {
    deployScript,
    compose,
    uiIndex: "<title>Sysdom AI</title>",
    brandSurfaces: {
      "ui/src/pages/InviteLanding.tsx": "Create your Sysdom AI account",
      "ui/src/components/FrontDoor.tsx": "Welcome to Sysdom AI",
    },
    ...overrides,
  };
}

test("reports source readiness without authorizing runtime or DNS cutover", () => {
  const result = evaluateSysdomRuntimeMigrationReadiness(readyInput());

  assert.equal(result.schema, "sysdom_runtime_migration_readiness_v1");
  assert.equal(result.sourceStatus, "ready_for_external_verification");
  assert.equal(result.cutoverAuthorized, false);
  assert.ok(result.checks.every((item) => item.status === "pass"));
  assert.deepEqual(result.requiredExternalEvidence, REQUIRED_EXTERNAL_MIGRATION_EVIDENCE);
  assert.match(result.next, /does not deploy, publish, or change DNS/);
});

test("fails closed when a public account surface regresses to SimOne copy", () => {
  const result = evaluateSysdomRuntimeMigrationReadiness(readyInput({
    brandSurfaces: {
      "ui/src/pages/InviteLanding.tsx": "Create your SimOne account",
    },
  }));

  assert.equal(result.sourceStatus, "blocked");
  assert.equal(
    result.checks.find((item) => item.id === "brand.public_surfaces")?.status,
    "fail",
  );
});

test("fails closed when host/auth overrides or password-recovery smoke are missing", () => {
  const result = evaluateSysdomRuntimeMigrationReadiness(readyInput({
    deployScript: deployScript
      .replace('public_host="${SIMONE_PUBLIC_HOST:-sim.sysdom.org}"', 'public_host="sim.sysdom.org"')
      .replace(/curl "https:\/\/\$public_host\/auth\/forgot-password"[^\n]*\n/, ""),
    compose: compose.replace("BETTER_AUTH_TRUSTED_ORIGINS", "STATIC_TRUSTED_ORIGINS"),
  }));
  const failedIds = result.checks
    .filter((item) => item.status === "fail")
    .map((item) => item.id);

  assert.equal(result.sourceStatus, "blocked");
  assert.deepEqual(failedIds, [
    "runtime.target_host_override",
    "runtime.auth_origin_override",
    "smoke.public_paths",
  ]);
});

test("keeps legacy technical and landing boundaries explicit until cutover", () => {
  const result = evaluateSysdomRuntimeMigrationReadiness(readyInput({
    deployScript: deployScript
      .replace("docker-compose.simone-public.yml", "docker-compose.sysdom-public.yml")
      .replace("The conscious agent company", "The agentic venture builder"),
  }));

  assert.equal(result.sourceStatus, "blocked");
  assert.equal(
    result.checks.find((item) => item.id === "runtime.legacy_identifiers_preserved")?.status,
    "fail",
  );
  assert.equal(
    result.checks.find((item) => item.id === "landing.separate_boundary")?.status,
    "fail",
  );
});
