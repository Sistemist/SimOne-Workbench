#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const EXPECTED_NODE_VERSION = "24.18.0";
const EXPECTED_NODE_ENGINE = "24.18.x";
const EXPECTED_PNPM_VERSION = "9.15.4";
const EXPECTED_BRANCH = "simone-main";

export const ALPHA_RELEASE_VERIFICATION_COMMANDS = [
  "pnpm test:run",
  "pnpm typecheck",
  "pnpm build",
  "pnpm test:simone-deploy",
  "pnpm test:docker-runtime-pins",
];

function check(id, passed, detail) {
  return {
    id,
    status: passed ? "pass" : "fail",
    detail,
  };
}

export function evaluateAlphaReleaseReadiness(input) {
  const requiredAssets = [
    ".dockerignore",
    "Dockerfile",
    "docker/docker-compose.quickstart.yml",
    "docker/docker-compose.simone-public.yml",
    "scripts/deploy-simone-kvm.sh",
  ];
  const dirtyPaths = input.git.statusLines
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  const deployScript = input.deployScript;
  const expectedBranch = input.expectedBranch || EXPECTED_BRANCH;
  const checks = [
    check(
      "runtime.node",
      input.runtime.node === EXPECTED_NODE_VERSION && input.packageJson.engines?.node === EXPECTED_NODE_ENGINE,
      `actual ${input.runtime.node}; package ${input.packageJson.engines?.node ?? "missing"}; required ${EXPECTED_NODE_VERSION}`,
    ),
    check(
      "runtime.pnpm",
      input.runtime.pnpm === EXPECTED_PNPM_VERSION &&
        input.packageJson.packageManager === `pnpm@${EXPECTED_PNPM_VERSION}`,
      `actual ${input.runtime.pnpm}; package ${input.packageJson.packageManager ?? "missing"}; required ${EXPECTED_PNPM_VERSION}`,
    ),
    check(
      "git.branch",
      input.git.branch === expectedBranch,
      input.git.branch
        ? `current ${input.git.branch}; required ${expectedBranch}`
        : `detached HEAD; required ${expectedBranch}`,
    ),
    check(
      "git.clean",
      dirtyPaths.length === 0,
      dirtyPaths.length === 0
        ? "worktree clean"
        : `dirty paths: ${dirtyPaths.slice(0, 20).join(", ")}${dirtyPaths.length > 20 ? ", …" : ""}`,
    ),
    check(
      "git.upstream",
      Boolean(input.git.upstreamSha) && input.git.upstreamSha === input.git.headSha,
      !input.git.upstreamSha
        ? "no upstream branch"
        : input.git.upstreamSha === input.git.headSha
          ? `HEAD matches upstream at ${input.git.headSha.slice(0, 12)}`
          : `HEAD ${input.git.headSha.slice(0, 12)} differs from upstream ${input.git.upstreamSha.slice(0, 12)}`,
    ),
    check(
      "deploy.assets",
      requiredAssets.every((asset) => input.assets[asset]),
      requiredAssets
        .filter((asset) => !input.assets[asset])
        .map((asset) => `missing ${asset}`)
        .join(", ") || "all required deploy assets present",
    ),
    check(
      "deploy.rollback",
      [
        "rollback_remote_deploy",
        "rollback_on_exit",
        ".deployments",
        "current.env",
        "previous.env",
        "ROLLBACK_TAG=",
        "PREVIOUS_IMAGE_REF=",
      ].every((marker) => deployScript.includes(marker)),
      "deploy records previous/current metadata and restores the previous image after failed smoke",
    ),
    check(
      "deploy.sysdom_brand_smoke",
      deployScript.includes("https://$public_host/app") &&
        deployScript.includes("https://$public_host/scanner") &&
        (deployScript.match(/rg -q '<title>Sysdom AI'/g)?.length ?? 0) >= 2,
      "app and Scanner smoke checks must expect the current Sysdom AI title",
    ),
    check(
      "deploy.landing_boundary",
      deployScript.includes("https://$public_host/") &&
        deployScript.includes("<title>SimOne \\| The conscious agent company"),
      "legacy landing-root assertion remains separate until its owning migration changes it",
    ),
  ];
  const failedChecks = checks.filter((item) => item.status === "fail");

  return {
    schema: "sysdom_alpha_release_readiness_v1",
    status: failedChecks.length === 0 ? "ready_for_verification" : "blocked",
    headSha: input.git.headSha,
    branch: input.git.branch,
    checks,
    requiredVerification: ALPHA_RELEASE_VERIFICATION_COMMANDS,
    next:
      failedChecks.length === 0
        ? "Run and retain every required verification command before deployment."
        : "Resolve failed preflight checks before running release verification or deployment.",
  };
}

function run(command, args, cwd, allowFailure = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.status === 0 ? result.stdout.trimEnd() : "";
}

function collectReadinessInput(repoRoot) {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const deployScriptPath = path.join(repoRoot, "scripts", "deploy-simone-kvm.sh");
  const requiredAssets = [
    ".dockerignore",
    "Dockerfile",
    "docker/docker-compose.quickstart.yml",
    "docker/docker-compose.simone-public.yml",
    "scripts/deploy-simone-kvm.sh",
  ];
  const gitStatus = run("git", ["status", "--porcelain", "--untracked-files=normal"], repoRoot);

  return {
    packageJson,
    runtime: {
      node: process.versions.node,
      pnpm: run("pnpm", ["--version"], repoRoot),
    },
    git: {
      headSha: run("git", ["rev-parse", "HEAD"], repoRoot),
      branch: run("git", ["branch", "--show-current"], repoRoot),
      upstreamSha: run("git", ["rev-parse", "@{upstream}"], repoRoot, true) || null,
      statusLines: gitStatus ? gitStatus.split(/\r?\n/) : [],
    },
    assets: Object.fromEntries(
      requiredAssets.map((asset) => [asset, existsSync(path.join(repoRoot, asset))]),
    ),
    deployScript: existsSync(deployScriptPath) ? readFileSync(deployScriptPath, "utf8") : "",
    expectedBranch: process.env.SIMONE_DEPLOY_BRANCH || EXPECTED_BRANCH,
  };
}

function main() {
  const repoRoot = process.cwd();
  const result = evaluateAlphaReleaseReadiness(collectReadinessInput(repoRoot));
  const json = process.argv.includes("--json");

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`Sysdom alpha release preflight: ${result.status}`);
    for (const item of result.checks) {
      console.log(`${item.status === "pass" ? "PASS" : "FAIL"} ${item.id}: ${item.detail}`);
    }
    console.log("Required verification before deployment:");
    for (const command of result.requiredVerification) console.log(`- ${command}`);
    console.log(result.next);
  }

  if (result.status === "blocked") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
