#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const PUBLIC_BRAND_SURFACE_FILES = [
  "ui/src/components/BootstrapPendingPage.tsx",
  "ui/src/components/CustomerEngineBridgeCard.tsx",
  "ui/src/components/FrontDoor.tsx",
  "ui/src/components/SidebarAccountMenu.tsx",
  "ui/src/pages/BootstrapSetupUxLab.tsx",
  "ui/src/pages/CustomerEngine.tsx",
  "ui/src/pages/Dashboard.tsx",
  "ui/src/pages/InviteLanding.tsx",
  "ui/src/pages/InviteUxLab.tsx",
  "ui/src/pages/IssueDetail.tsx",
  "ui/src/pages/SimCoach.tsx",
  "ui/src/pages/TeamCatalog.tsx",
];

const LEGACY_PUBLIC_COPY_PATTERNS = [
  /\bWelcome to SimOne\b/,
  /\bjoin SimOne\b/,
  /\bSet up SimOne\b/,
  /\bsetting up SimOne\b/,
  /\bSimOne account\b/,
  /\bSimOne company\b/,
  /\bSimOne workspace\b/,
  /\bSimOne user\b/,
  /\bSimOne v\{/,
  /\bSimOne applies\b/,
  /\bWhy SimOne\b/,
  /\buse SimOne\b/,
  /\bSimOne can\b/,
  /\bSimOne reads\b/,
  /\bSimOne flags\b/,
  /\bSimOne keeps\b/,
  /\bfrom SimOne\b/,
  /\bSimOne starter\b/i,
];

export const REQUIRED_EXTERNAL_MIGRATION_EVIDENCE = [
  "Landing experience, assets, signup endpoint, and container are migrated together or explicitly retained behind a verified route boundary.",
  "The production nginx configuration for root, app, Scanner, auth, API, and static assets is captured and reviewed.",
  "Target DNS and TLS resolve to the intended host without changing the legacy route prematurely.",
  "Signup and password-recovery delivery are exercised on the target origin.",
  "A previous image and route configuration are restored in a bounded rollback rehearsal.",
];

function check(id, passed, detail) {
  return {
    id,
    status: passed ? "pass" : "fail",
    detail,
  };
}

function legacyBrandFindings(brandSurfaces) {
  const findings = [];
  for (const [file, source] of Object.entries(brandSurfaces)) {
    for (const pattern of LEGACY_PUBLIC_COPY_PATTERNS) {
      if (pattern.test(source)) {
        findings.push(`${file}: ${pattern.source}`);
      }
    }
  }
  return findings;
}

export function evaluateSysdomRuntimeMigrationReadiness(input) {
  const deployScript = input.deployScript;
  const compose = input.compose;
  const brandFindings = legacyBrandFindings(input.brandSurfaces);
  const checks = [
    check(
      "brand.public_surfaces",
      brandFindings.length === 0,
      brandFindings.length === 0
        ? "selected public account and founder surfaces use Sysdom AI display copy"
        : `legacy public copy: ${brandFindings.slice(0, 10).join(", ")}`,
    ),
    check(
      "brand.document_title",
      /<title>Sysdom AI<\/title>/.test(input.uiIndex),
      "app document title must use the Sysdom AI masterbrand",
    ),
    check(
      "runtime.target_host_override",
      deployScript.includes('public_host="${SIMONE_PUBLIC_HOST:-sim.sysdom.org}"'),
      "deployment host can be changed explicitly while the verified legacy default remains stable",
    ),
    check(
      "runtime.auth_origin_override",
      compose.includes('PAPERCLIP_ALLOWED_HOSTNAMES: "${PAPERCLIP_ALLOWED_HOSTNAMES:-') &&
        compose.includes('BETTER_AUTH_TRUSTED_ORIGINS: "${BETTER_AUTH_TRUSTED_ORIGINS:-'),
      "allowed hostnames and trusted auth origins remain explicit deployment inputs",
    ),
    check(
      "runtime.legacy_identifiers_preserved",
      deployScript.includes("docker-compose.simone-public.yml") &&
        deployScript.includes("simone-workbench") &&
        compose.includes("SIMONE_PASSWORD_RESET_FROM") &&
        compose.includes("SIMONE_TISSUU_BRIDGE_BASE_URL"),
      "legacy technical identifiers remain stable until a separately verified migration changes them",
    ),
    check(
      "smoke.public_paths",
      [
        'https://$public_host/app',
        'https://$public_host/scanner',
        'https://$public_host/auth/forgot-password',
        'https://$public_host/',
        'https://$public_host/api/signup',
      ].every((marker) => deployScript.includes(marker)),
      "deploy smoke covers app, Scanner, password recovery entry, landing root, and signup API",
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
      "failed smoke can restore the recorded previous image",
    ),
    check(
      "landing.separate_boundary",
      deployScript.includes("<title>SimOne \\| The conscious agent company"),
      "legacy landing root remains an explicit, separately owned boundary before cutover",
    ),
  ];
  const failedChecks = checks.filter((item) => item.status === "fail");

  return {
    schema: "sysdom_runtime_migration_readiness_v1",
    sourceStatus:
      failedChecks.length === 0 ? "ready_for_external_verification" : "blocked",
    cutoverAuthorized: false,
    checks,
    requiredExternalEvidence: REQUIRED_EXTERNAL_MIGRATION_EVIDENCE,
    next:
      failedChecks.length === 0
        ? "Collect every external evidence item and obtain explicit cutover authorization; this source report does not deploy, publish, or change DNS."
        : "Resolve failed source checks before collecting external evidence or authorizing cutover.",
  };
}

function readRequired(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf8");
}

function collectInput(repoRoot) {
  return {
    deployScript: readRequired(repoRoot, "scripts/deploy-simone-kvm.sh"),
    compose: readRequired(repoRoot, "docker/docker-compose.simone-public.yml"),
    uiIndex: readRequired(repoRoot, "ui/index.html"),
    brandSurfaces: Object.fromEntries(
      PUBLIC_BRAND_SURFACE_FILES.map((file) => [file, readRequired(repoRoot, file)]),
    ),
  };
}

function main() {
  const result = evaluateSysdomRuntimeMigrationReadiness(collectInput(process.cwd()));
  const json = process.argv.includes("--json");

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`Sysdom runtime migration source preflight: ${result.sourceStatus}`);
    for (const item of result.checks) {
      console.log(`${item.status === "pass" ? "PASS" : "FAIL"} ${item.id}: ${item.detail}`);
    }
    console.log("External evidence still required before cutover:");
    for (const item of result.requiredExternalEvidence) console.log(`- ${item}`);
    console.log(result.next);
  }

  if (result.sourceStatus === "blocked") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
