#!/usr/bin/env node

import { readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_SCAN_ROOTS = [
  ".github/workflows",
  "scripts",
  "packages/teams-catalog/catalog",
  "packages/skills-catalog/catalog",
  "packages/plugins/plugin-llm-wiki/fixtures/basic-root",
];
const DUPLICATE_COPY_PATTERN = / \d+(?:\.[^/]+)?$/;

export function findDuplicateCopyArtifacts(repoRoot, scanRoots = DEFAULT_SCAN_ROOTS) {
  const matches = [];

  for (const scanRoot of scanRoots) {
    const absoluteRoot = path.resolve(repoRoot, scanRoot);
    const stack = [absoluteRoot];

    while (stack.length > 0) {
      const current = stack.pop();
      let entries;
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const absolute = path.join(current, entry.name);
        if (DUPLICATE_COPY_PATTERN.test(entry.name)) {
          matches.push(path.relative(repoRoot, absolute).split(path.sep).join("/"));
          continue;
        }
        if (entry.isDirectory()) {
          stack.push(absolute);
        }
      }
    }
  }

  return matches.sort();
}

export function runCheck({ repoRoot = process.cwd(), log = console.log, error = console.error } = {}) {
  const matches = findDuplicateCopyArtifacts(repoRoot);
  if (matches.length === 0) {
    log("  ✓  No numbered duplicate-copy artifacts found in sensitive repository trees.");
    return 0;
  }

  error("ERROR: numbered duplicate-copy artifacts found in sensitive directories:");
  for (const match of matches) error(`  ${match}`);
  error("Remove the duplicate and update the canonical file or directory intentionally instead.");
  return 1;
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) process.exit(runCheck());
