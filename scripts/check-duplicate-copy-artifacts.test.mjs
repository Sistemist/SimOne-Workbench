import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findDuplicateCopyArtifacts, runCheck } from "./check-duplicate-copy-artifacts.mjs";

function withRepo(run) {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), "duplicate-copy-check-"));
  try {
    mkdirSync(path.join(repoRoot, ".github/workflows"), { recursive: true });
    mkdirSync(path.join(repoRoot, "scripts/smoke"), { recursive: true });
    mkdirSync(path.join(repoRoot, "packages/teams-catalog/catalog"), { recursive: true });
    mkdirSync(path.join(repoRoot, "packages/skills-catalog/catalog"), { recursive: true });
    mkdirSync(path.join(repoRoot, "packages/plugins/plugin-llm-wiki/fixtures/basic-root"), {
      recursive: true,
    });
    run(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

test("finds numbered files and directories in sensitive trees", () => {
  withRepo((repoRoot) => {
    writeFileSync(path.join(repoRoot, ".github/workflows/release 2.yml"), "name: duplicate\n");
    writeFileSync(path.join(repoRoot, "scripts/smoke/deploy 3.sh"), "#!/bin/sh\n");
    mkdirSync(path.join(repoRoot, "packages/teams-catalog/catalog/ceo 2"));
    writeFileSync(
      path.join(repoRoot, "packages/skills-catalog/catalog/template 4.svg"),
      "<svg/>\n",
    );

    assert.deepEqual(findDuplicateCopyArtifacts(repoRoot), [
      ".github/workflows/release 2.yml",
      "packages/skills-catalog/catalog/template 4.svg",
      "packages/teams-catalog/catalog/ceo 2",
      "scripts/smoke/deploy 3.sh",
    ]);
  });
});

test("ignores canonical and versioned filenames without copy suffixes", () => {
  withRepo((repoRoot) => {
    writeFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "name: canonical\n");
    writeFileSync(path.join(repoRoot, "scripts/migrate-v2.sh"), "#!/bin/sh\n");
    writeFileSync(path.join(repoRoot, "scripts/report-v2.md"), "# Versioned evidence\n");

    assert.deepEqual(findDuplicateCopyArtifacts(repoRoot), []);
  });
});

test("runCheck fails closed and names every duplicate", () => {
  withRepo((repoRoot) => {
    writeFileSync(path.join(repoRoot, "scripts/deploy 2.sh"), "#!/bin/sh\n");
    const errors = [];

    assert.equal(runCheck({ repoRoot, log: () => {}, error: (message) => errors.push(message) }), 1);
    assert.ok(errors.some((message) => message.includes("scripts/deploy 2.sh")));
  });
});
