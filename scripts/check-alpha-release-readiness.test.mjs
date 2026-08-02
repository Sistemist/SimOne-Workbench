import assert from "node:assert/strict";
import test from "node:test";

import {
  ALPHA_RELEASE_VERIFICATION_COMMANDS,
  evaluateAlphaReleaseReadiness,
} from "./check-alpha-release-readiness.mjs";

const currentDeployScript = `
rollback_remote_deploy
rollback_on_exit
.deployments
current.env
previous.env
ROLLBACK_TAG=
PREVIOUS_IMAGE_REF=
curl "https://$public_host/app" | rg -q '<title>Sysdom AI'
curl "https://$public_host/scanner" | rg -q '<title>Sysdom AI'
curl "https://$public_host/" | rg -q '<title>SimOne \\| The conscious agent company'
`;

function readyInput(overrides = {}) {
  return {
    packageJson: {
      engines: { node: "24.18.x" },
      packageManager: "pnpm@9.15.4",
    },
    runtime: { node: "24.18.0", pnpm: "9.15.4" },
    git: {
      headSha: "a".repeat(40),
      branch: "simone-main",
      upstreamSha: "a".repeat(40),
      statusLines: [],
    },
    assets: {
      ".dockerignore": true,
      Dockerfile: true,
      "docker/docker-compose.quickstart.yml": true,
      "docker/docker-compose.simone-public.yml": true,
      "scripts/deploy-simone-kvm.sh": true,
    },
    deployScript: currentDeployScript,
    expectedBranch: "simone-main",
    ...overrides,
  };
}

test("returns ready_for_verification only after every source preflight passes", () => {
  const result = evaluateAlphaReleaseReadiness(readyInput());

  assert.equal(result.schema, "sysdom_alpha_release_readiness_v1");
  assert.equal(result.status, "ready_for_verification");
  assert.ok(result.checks.every((item) => item.status === "pass"));
  assert.deepEqual(result.requiredVerification, ALPHA_RELEASE_VERIFICATION_COMMANDS);
  assert.match(result.next, /Run and retain every required verification/);
});

test("fails closed on dirty worktrees without hiding the dirty path", () => {
  const result = evaluateAlphaReleaseReadiness(readyInput({
    git: {
      headSha: "a".repeat(40),
      branch: "simone-main",
      upstreamSha: "a".repeat(40),
      statusLines: [" M AGENTS.md"],
    },
  }));

  assert.equal(result.status, "blocked");
  const cleanliness = result.checks.find((item) => item.id === "git.clean");
  assert.equal(cleanliness?.status, "fail");
  assert.match(cleanliness?.detail ?? "", /AGENTS\.md/);
});

test("blocks obsolete SimOne app and Scanner smoke assertions", () => {
  const staleDeployScript = currentDeployScript
    .replaceAll("<title>Sysdom AI", "<title>SimOne");
  const result = evaluateAlphaReleaseReadiness(readyInput({
    deployScript: staleDeployScript,
  }));

  assert.equal(result.status, "blocked");
  assert.equal(
    result.checks.find((item) => item.id === "deploy.sysdom_brand_smoke")?.status,
    "fail",
  );
});

test("blocks runtime, branch, upstream, asset, and rollback drift independently", () => {
  const input = readyInput({
    runtime: { node: "24.19.0", pnpm: "10.0.0" },
    git: {
      headSha: "a".repeat(40),
      branch: "feature",
      upstreamSha: "b".repeat(40),
      statusLines: [],
    },
    assets: {
      ".dockerignore": true,
      Dockerfile: false,
      "docker/docker-compose.quickstart.yml": true,
      "docker/docker-compose.simone-public.yml": true,
      "scripts/deploy-simone-kvm.sh": true,
    },
    deployScript: currentDeployScript.replace("rollback_on_exit", "rollback_disabled"),
  });
  const result = evaluateAlphaReleaseReadiness(input);
  const failedIds = result.checks
    .filter((item) => item.status === "fail")
    .map((item) => item.id);

  assert.equal(result.status, "blocked");
  assert.deepEqual(failedIds, [
    "runtime.node",
    "runtime.pnpm",
    "git.branch",
    "git.upstream",
    "deploy.assets",
    "deploy.rollback",
  ]);
});
