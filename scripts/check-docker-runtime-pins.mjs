#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function packageVersion(spec) {
  const separator = spec.lastIndexOf("@");
  if (separator <= 0) return null;
  return spec.slice(separator + 1);
}

export function findUnpinnedGlobalPackages(dockerfileText) {
  const logicalLines = dockerfileText
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
    .replace(/\\\r?\n/g, " ")
    .split(/\r?\n/);
  const findings = [];

  for (const logicalLine of logicalLines) {
    for (const command of logicalLine.split(/&&|\|\||;/)) {
      const match = command.match(/\bnpm\s+(?:install|i)\s+(.+)$/);
      if (!match) continue;

      const tokens = match[1].trim().split(/\s+/);
      if (!tokens.includes("-g") && !tokens.includes("--global")) continue;

      for (const token of tokens) {
        if (token.startsWith("-") || /^[A-Z_][A-Z0-9_]*=/.test(token)) continue;
        const version = packageVersion(token);
        if (!version || !exactVersionPattern.test(version)) findings.push(token);
      }
    }
  }

  return findings;
}

function dockerfilesUnder(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...dockerfilesUnder(entryPath));
    else if (entry.name === "Dockerfile" || entry.name.startsWith("Dockerfile.")) files.push(entryPath);
  }
  return files;
}

export function checkDockerRuntimePins(repoRoot) {
  const dockerfiles = [
    path.join(repoRoot, "Dockerfile"),
    path.join(repoRoot, "docker", "untrusted-review", "Dockerfile"),
    ...dockerfilesUnder(path.join(repoRoot, "docker", "agent-runtime")),
  ]
    .filter((file, index, all) => existsSync(file) && all.indexOf(file) === index);
  const failures = [];

  for (const dockerfile of dockerfiles) {
    const findings = findUnpinnedGlobalPackages(readFileSync(dockerfile, "utf8"));
    for (const spec of findings) {
      failures.push(`${path.relative(repoRoot, dockerfile)}: ${spec}`);
    }
  }

  return failures;
}

function main() {
  const repoRoot = process.cwd();
  const failures = checkDockerRuntimePins(repoRoot);
  if (failures.length > 0) {
    console.error("Global npm packages in Dockerfiles must use exact versions:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log("Docker runtime package pins are exact.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
