import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = path.join(repoRoot, "scripts", "run-vitest-stable.mjs");
const fixture = path.join(
  repoRoot,
  "scripts",
  "__tests__",
  "fixtures",
  "run-vitest-child.mjs",
);
const runnerArgs = [
  script,
  "--mode",
  "general",
  "--group",
  "general-server",
];

function fixtureEnv(mode) {
  return {
    ...process.env,
    NODE_ENV: "test",
    PAPERCLIP_TEST_RUNNER_CHILD_FIXTURE: fixture,
    PAPERCLIP_TEST_RUNNER_CHILD_MODE: mode,
  };
}

function markerPayloads(output, marker) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith(marker))
    .map((line) => JSON.parse(line.slice(marker.length)));
}

function terminalSummary(output) {
  const summaries = markerPayloads(output, "[test:run] terminal-summary ");
  assert.equal(summaries.length, 1, "expected exactly one terminal summary");
  return summaries[0];
}

test("reports each successful child and one completed terminal summary", () => {
  const result = spawnSync(process.execPath, runnerArgs, {
    cwd: repoRoot,
    env: fixtureEnv("success"),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const outcomes = markerPayloads(result.stdout, "[test:run] outcome ");
  assert.equal(outcomes.length, 1);
  assert.deepEqual(
    {
      group: outcomes[0].group,
      status: outcomes[0].status,
      exitCode: outcomes[0].exitCode,
      signal: outcomes[0].signal,
    },
    {
      group: "general-server",
      status: "passed",
      exitCode: 0,
      signal: null,
    },
  );
  const groups = markerPayloads(result.stdout, "[test:run] group-outcome ");
  assert.deepEqual(groups.map(({ group, status, invocationCount }) => ({
    group,
    status,
    invocationCount,
  })), [{
    group: "general-server",
    status: "passed",
    invocationCount: 1,
  }]);
  const summary = terminalSummary(result.stdout);
  assert.deepEqual(
    {
      status: summary.status,
      exitCode: summary.exitCode,
      invocationCount: summary.invocationCount,
      counts: summary.counts,
      groupCount: summary.groupCount,
      groupCounts: summary.groupCounts,
    },
    {
      status: "completed",
      exitCode: 0,
      invocationCount: 1,
      counts: {
        passed: 1,
        failed: 0,
        interrupted: 0,
        skipped: 0,
      },
      groupCount: 1,
      groupCounts: {
        passed: 1,
        failed: 0,
        interrupted: 0,
        skipped: 0,
      },
    },
  );
});

test("preserves a child failure and identifies the failing invocation", () => {
  const result = spawnSync(process.execPath, runnerArgs, {
    cwd: repoRoot,
    env: fixtureEnv("failure"),
    encoding: "utf8",
  });

  assert.equal(result.status, 7);
  const outcomes = markerPayloads(result.stdout, "[test:run] outcome ");
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "failed");
  assert.equal(outcomes[0].exitCode, 7);
  const groups = markerPayloads(result.stdout, "[test:run] group-outcome ");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].status, "failed");
  const summary = terminalSummary(result.stdout);
  assert.equal(summary.status, "failed");
  assert.equal(summary.exitCode, 7);
  assert.equal(summary.counts.failed, 1);
  assert.match(summary.failureLabel, /general-server server suites/);
  assert.match(result.stderr, /Vitest child failed/);
});

test("classifies interruption, forwards the signal, and never reports green", async () => {
  const child = spawn(process.execPath, runnerArgs, {
    cwd: repoRoot,
    env: fixtureEnv("wait"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let interruptionSent = false;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    if (!interruptionSent && stdout.includes("[test-child] ready")) {
      interruptionSent = true;
      child.kill("SIGTERM");
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`interruption fixture timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 10_000);
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  assert.equal(interruptionSent, true);
  assert.deepEqual(result, { code: 143, signal: null });
  const outcomes = markerPayloads(stdout, "[test:run] outcome ");
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "interrupted");
  const groups = markerPayloads(stdout, "[test:run] group-outcome ");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].status, "interrupted");
  const summary = terminalSummary(stdout);
  assert.equal(summary.status, "interrupted");
  assert.equal(summary.exitCode, 143);
  assert.equal(summary.signal, "SIGTERM");
  assert.equal(summary.counts.passed, 0);
  assert.equal(summary.counts.interrupted, 1);
  assert.match(stderr, /interruption requested: SIGTERM/);
});
