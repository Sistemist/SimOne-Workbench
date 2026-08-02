#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const serverRoot = path.join(repoRoot, "server");
const serverSrcDir = path.join(repoRoot, "server", "src");
const serverTestsDir = path.join(repoRoot, "server", "src", "__tests__");
const nonServerProjects = [
  "@paperclipai/shared",
  "@paperclipai/skills-catalog",
  "@paperclipai/db",
  "@paperclipai/adapter-utils",
  "@paperclipai/adapter-acpx-local",
  "@paperclipai/adapter-codex-local",
  "@paperclipai/adapter-opencode-local",
  "@paperclipai/plugin-sdk",
  "@paperclipai/create-paperclip-plugin",
  "@paperclipai/ui",
  "paperclipai",
];
const routeTestPattern = /[^/]*(?:route|routes|authz)[^/]*\.test\.ts$/;
const additionalSerializedServerTests = new Set([
  "server/src/__tests__/approval-routes-idempotency.test.ts",
  "server/src/__tests__/assets.test.ts",
  "server/src/__tests__/authz-company-access.test.ts",
  "server/src/__tests__/companies-route-path-guard.test.ts",
  "server/src/__tests__/company-portability.test.ts",
  "server/src/__tests__/costs-service.test.ts",
  "server/src/__tests__/express5-auth-wildcard.test.ts",
  "server/src/__tests__/health-dev-server-token.test.ts",
  "server/src/__tests__/health.test.ts",
  "server/src/__tests__/heartbeat-dependency-scheduling.test.ts",
  "server/src/__tests__/heartbeat-issue-liveness-escalation.test.ts",
  "server/src/__tests__/heartbeat-process-recovery.test.ts",
  "server/src/__tests__/heartbeat-runtime-skills.test.ts",
  "server/src/__tests__/invite-accept-existing-member.test.ts",
  "server/src/__tests__/invite-accept-gateway-defaults.test.ts",
  "server/src/__tests__/invite-accept-replay.test.ts",
  "server/src/__tests__/invite-expiry.test.ts",
  "server/src/__tests__/invite-join-manager.test.ts",
  "server/src/__tests__/invite-onboarding-text.test.ts",
  "server/src/__tests__/issues-checkout-wakeup.test.ts",
  "server/src/__tests__/issues-service.test.ts",
  "server/src/__tests__/opencode-local-adapter-environment.test.ts",
  "server/src/__tests__/project-routes-env.test.ts",
  "server/src/__tests__/redaction.test.ts",
  "server/src/__tests__/routines-e2e.test.ts",
]);
let invocationIndex = 0;
const serializedModeName = "serialized";
const generalModeName = "general";
const allModeName = "all";
const generalServerGroupName = "general-server";
const generalWorkspacesAGroupName = "general-workspaces-a";
const generalWorkspacesBGroupName = "general-workspaces-b";
const generalWorkspacesAProjects = ["@paperclipai/ui", "paperclipai"];
const generalWorkspacesBProjects = nonServerProjects.filter((project) => !generalWorkspacesAProjects.includes(project));
const generalGroupNames = [generalServerGroupName, generalWorkspacesAGroupName, generalWorkspacesBGroupName];
const serializedServerVitestArgs = [
  "--no-file-parallelism",
  "--maxWorkers=1",
];
const runStartedAt = Date.now();
const groupOutcomes = [];
const invocationOutcomes = [];
let activeChild = null;
let forceKillTimer = null;
let interruptionSignal = null;

class TestRunFailure extends Error {
  constructor(message, { exitCode = 1, label = null } = {}) {
    super(message);
    this.name = "TestRunFailure";
    this.exitCode = exitCode;
    this.label = label;
  }
}

class TestRunInterrupted extends Error {
  constructor(signal, label = null) {
    super(`Test run interrupted by ${signal}`);
    this.name = "TestRunInterrupted";
    this.signal = signal;
    this.label = label;
  }
}

function signalExitCode(signal) {
  return signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
}

function clearForceKillTimer() {
  if (forceKillTimer !== null) {
    clearTimeout(forceKillTimer);
    forceKillTimer = null;
  }
}

function requestInterruption(signal) {
  if (interruptionSignal !== null) {
    if (activeChild && activeChild.exitCode === null && activeChild.signalCode === null) {
      activeChild.kill("SIGKILL");
    }
    return;
  }

  interruptionSignal = signal;
  console.error(`[test:run] interruption requested: ${signal}`);
  if (activeChild && activeChild.exitCode === null && activeChild.signalCode === null) {
    activeChild.kill(signal);
    forceKillTimer = setTimeout(() => {
      if (activeChild && activeChild.exitCode === null && activeChild.signalCode === null) {
        activeChild.kill("SIGKILL");
      }
    }, 5_000);
    forceKillTimer.unref();
  }
}

const signalHandlers = new Map([
  ["SIGINT", () => requestInterruption("SIGINT")],
  ["SIGTERM", () => requestInterruption("SIGTERM")],
]);
for (const [signal, handler] of signalHandlers) {
  process.on(signal, handler);
}

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      files.push(...walk(absolute));
    } else if (stats.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

function toRepoPath(file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

function toServerPath(file) {
  return path.relative(serverRoot, file).split(path.sep).join("/");
}

function isRouteOrAuthzTest(file) {
  if (routeTestPattern.test(file)) {
    return true;
  }

  return additionalSerializedServerTests.has(file);
}

function fail(message) {
  throw new TestRunFailure(message);
}

function readOptionValue(argv, index, argName) {
  const value = argv[index + 1];
  if (value === undefined) {
    fail(`Missing value for ${argName}`);
  }

  return value;
}

function parseNonNegativeInteger(value, argName) {
  const parsed = Number(value);
  if (value.trim() === "" || !Number.isInteger(parsed) || parsed < 0) {
    fail(`${argName} must be a non-negative integer. Received "${value}".`);
  }

  return parsed;
}

function parsePositiveInteger(value, argName) {
  const parsed = Number(value);
  if (value.trim() === "" || !Number.isInteger(parsed) || parsed < 1) {
    fail(`${argName} must be a positive integer. Received "${value}".`);
  }

  return parsed;
}

function parseCliOptions(argv) {
  let mode = allModeName;
  let shardIndex = null;
  let shardCount = null;
  let group = null;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }

    if (arg === "--mode") {
      mode = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
      continue;
    }

    if (arg === "--shard-index") {
      shardIndex = parseNonNegativeInteger(readOptionValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--shard-index=")) {
      shardIndex = parseNonNegativeInteger(arg.slice("--shard-index=".length), "--shard-index");
      continue;
    }

    if (arg === "--shard-count") {
      shardCount = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--shard-count=")) {
      shardCount = parsePositiveInteger(arg.slice("--shard-count=".length), "--shard-count");
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--group") {
      group = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--group=")) {
      group = arg.slice("--group=".length);
      continue;
    }

    fail(`Unknown argument "${arg}".`);
  }

  if (!new Set([allModeName, generalModeName, serializedModeName]).has(mode)) {
    fail(`Unknown mode "${mode}". Expected one of: ${allModeName}, ${generalModeName}, ${serializedModeName}.`);
  }

  if ((shardIndex === null) !== (shardCount === null)) {
    fail("--shard-index and --shard-count must be provided together.");
  }

  const shardAllowed =
    mode === serializedModeName ||
    (mode === generalModeName && group === generalServerGroupName);
  if (!shardAllowed && shardIndex !== null) {
    fail(
      "--shard-index/--shard-count are only valid with --mode serialized or --mode general --group general-server.",
    );
  }

  if (group !== null && mode !== generalModeName) {
    fail("--group is only valid with --mode general.");
  }

  if (group !== null && !generalGroupNames.includes(group)) {
    fail(`Unknown group "${group}". Expected one of: ${generalGroupNames.join(", ")}.`);
  }

  if (shardIndex !== null) {
    if (shardIndex >= shardCount) {
      fail(`--shard-index must be less than --shard-count. Received ${shardIndex} of ${shardCount}.`);
    }
  }

  if (mode === serializedModeName) {
    return {
      mode,
      shardIndex: shardIndex ?? 0,
      shardCount: shardCount ?? 1,
      group: null,
      dryRun,
    };
  }

  return {
    mode,
    shardIndex,
    shardCount,
    group,
    dryRun,
  };
}

function selectSerializedSuites(routeTests, shardIndex, shardCount) {
  return routeTests.filter((_, index) => index % shardCount === shardIndex);
}

function recordInvocationOutcome(outcome) {
  invocationOutcomes.push(outcome);
  console.log(`[test:run] outcome ${JSON.stringify(outcome)}`);
}

async function runTrackedGroup(group, run) {
  const startedAt = Date.now();
  const firstInvocationIndex = invocationOutcomes.length;
  let caughtError = null;
  try {
    await run();
  } catch (error) {
    caughtError = error;
  }

  const invocations = invocationOutcomes.slice(firstInvocationIndex);
  const status = caughtError instanceof TestRunInterrupted
    ? "interrupted"
    : caughtError !== null || invocations.some((outcome) => outcome.status === "failed")
      ? "failed"
      : invocations.length > 0 && invocations.every((outcome) => outcome.status === "skipped")
        ? "skipped"
        : "passed";
  const outcome = {
    group,
    status,
    invocationCount: invocations.length,
    passedCount: invocations.filter((invocation) => invocation.status === "passed").length,
    failedCount: invocations.filter((invocation) => invocation.status === "failed").length,
    interruptedCount: invocations.filter(
      (invocation) => invocation.status === "interrupted",
    ).length,
    skippedCount: invocations.filter((invocation) => invocation.status === "skipped").length,
    durationMs: Date.now() - startedAt,
  };
  groupOutcomes.push(outcome);
  console.log(`[test:run] group-outcome ${JSON.stringify(outcome)}`);

  if (caughtError !== null) {
    throw caughtError;
  }
}

async function runVitest(args, label, group) {
  if (interruptionSignal !== null) {
    throw new TestRunInterrupted(interruptionSignal, label);
  }

  console.log(`\n[test:run] ${label}`);
  invocationIndex += 1;
  const startedAt = Date.now();
  const tempRootParent = process.platform === "win32" ? os.tmpdir() : "/tmp";
  const testRoot = mkdtempSync(path.join(tempRootParent, `pcvt-${process.pid}-${invocationIndex}-`));
  // Keep per-run paths compact so Unix socket fixtures stay under macOS path limits.
  const env = {
    ...process.env,
    NODE_ENV: "test",
    PAPERCLIP_HOME: path.join(testRoot, "h"),
    PAPERCLIP_INSTANCE_ID: `vt-${process.pid}-${invocationIndex}`,
    TMPDIR: path.join(testRoot, "t"),
  };
  mkdirSync(env.PAPERCLIP_HOME, { recursive: true });
  mkdirSync(env.TMPDIR, { recursive: true });
  const testChildFixture = process.env.NODE_ENV === "test"
    ? process.env.PAPERCLIP_TEST_RUNNER_CHILD_FIXTURE
    : null;
  const command = testChildFixture ? process.execPath : "pnpm";
  const commandArgs = testChildFixture
    ? [testChildFixture, ...args]
    : ["exec", "vitest", "run", ...args];
  const child = spawn(command, commandArgs, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  activeChild = child;
  const result = await new Promise((resolve) => {
    child.once("error", (error) => resolve({ error, status: null, signal: null }));
    child.once("close", (status, signal) => resolve({ error: null, status, signal }));
  });
  activeChild = null;
  clearForceKillTimer();

  const status = interruptionSignal !== null
    ? "interrupted"
    : result.error || result.status !== 0
      ? "failed"
      : "passed";
  recordInvocationOutcome({
    group,
    label,
    status,
    exitCode: result.status,
    signal: result.signal,
    durationMs: Date.now() - startedAt,
  });

  if (interruptionSignal !== null) {
    throw new TestRunInterrupted(interruptionSignal, label);
  }
  if (result.error) {
    throw new TestRunFailure(`Failed to start Vitest: ${result.error.message}`, { label });
  }
  if (result.status !== 0) {
    throw new TestRunFailure(`Vitest child failed for ${label}`, {
      exitCode: result.status ?? 1,
      label,
    });
  }
}

async function runGeneralSuites(routeTests) {
  for (const groupName of generalGroupNames) {
    await runTrackedGroup(groupName, () => runGeneralGroup(routeTests, groupName));
  }
}

async function runProjectGroup(projects, groupName) {
  for (const project of projects) {
    await runVitest(["--project", project], `${groupName} project ${project}`, groupName);
  }
}

async function runGeneralGroup(routeTests, groupName, shardIndex = null, shardCount = null) {
  if (groupName === generalServerGroupName) {
    if (shardCount !== null && shardCount > 1) {
      const shardFiles = generalServerTestFiles.filter(
        (_, index) => index % shardCount === shardIndex,
      );
      console.log(
        `\n[test:run] general-server shard ${shardIndex + 1}/${shardCount} running ${shardFiles.length} of ${generalServerTestFiles.length} suites`,
      );
      if (shardFiles.length === 0) {
        recordInvocationOutcome({
          group: `${groupName}-shard-${shardIndex + 1}-of-${shardCount}`,
          label: `${groupName} shard ${shardIndex + 1}/${shardCount}`,
          status: "skipped",
          exitCode: 0,
          signal: null,
          durationMs: 0,
        });
        return;
      }

      await runVitest(
        [
          "--project",
          "@paperclipai/server",
          ...serializedServerVitestArgs,
          ...shardFiles,
        ],
        `${groupName} shard ${shardIndex + 1}/${shardCount}`,
        `${groupName}-shard-${shardIndex + 1}-of-${shardCount}`,
      );
      return;
    }

    const excludeRouteArgs = routeTests.flatMap((file) => ["--exclude", file.serverPath]);
    await runVitest(
      [
        "--project",
        "@paperclipai/server",
        ...serializedServerVitestArgs,
        ...excludeRouteArgs,
      ],
      `${groupName} server suites excluding ${routeTests.length} serialized suites`,
      groupName,
    );
    return;
  }

  if (groupName === generalWorkspacesAGroupName) {
    await runProjectGroup(generalWorkspacesAProjects, groupName);
    return;
  }

  if (groupName === generalWorkspacesBGroupName) {
    await runProjectGroup(generalWorkspacesBProjects, groupName);
    return;
  }

  fail(`Unknown group "${groupName}".`);
}

async function runSerializedSuites(routeTests, shardIndex, shardCount) {
  const shardTests = selectSerializedSuites(routeTests, shardIndex, shardCount);
  const group = `serialized-shard-${shardIndex + 1}-of-${shardCount}`;
  console.log(
    `\n[test:run] serialized shard ${shardIndex + 1}/${shardCount} running ${shardTests.length} of ${routeTests.length} suites`,
  );
  if (shardTests.length === 0) {
    recordInvocationOutcome({
      group,
      label: `serialized shard ${shardIndex + 1}/${shardCount}`,
      status: "skipped",
      exitCode: 0,
      signal: null,
      durationMs: 0,
    });
    return;
  }

  for (const routeTest of shardTests) {
    await runVitest(
      [
        "--project",
        "@paperclipai/server",
        routeTest.repoPath,
        "--pool=forks",
        "--isolate",
      ],
      routeTest.repoPath,
      group,
    );
  }
}

const routeTests = walk(serverTestsDir)
  .filter((file) => isRouteOrAuthzTest(toRepoPath(file)))
  .map((file) => ({
    repoPath: toRepoPath(file),
    serverPath: toServerPath(file),
  }))
  .sort((a, b) => a.repoPath.localeCompare(b.repoPath));

// Every server test file that the general-server group is responsible for,
// i.e. the whole server project minus the route/authz suites that run in the
// dedicated serialized shards. Sharding this list across runners is what keeps
// the general-server lane from becoming the PR critical path: the server vitest
// config pins maxWorkers to 1, so the only way to parallelize is across jobs.
const generalServerTestFiles = walk(serverSrcDir)
  .map((file) => toRepoPath(file))
  .filter((repoPath) => repoPath.endsWith(".test.ts"))
  .filter((repoPath) => !isRouteOrAuthzTest(repoPath))
  .sort((a, b) => a.localeCompare(b));

function terminalSummary(status, exitCode, signal, failureLabel) {
  const counts = {
    passed: invocationOutcomes.filter((outcome) => outcome.status === "passed").length,
    failed: invocationOutcomes.filter((outcome) => outcome.status === "failed").length,
    interrupted: invocationOutcomes.filter((outcome) => outcome.status === "interrupted").length,
    skipped: invocationOutcomes.filter((outcome) => outcome.status === "skipped").length,
  };
  const groupCounts = {
    passed: groupOutcomes.filter((outcome) => outcome.status === "passed").length,
    failed: groupOutcomes.filter((outcome) => outcome.status === "failed").length,
    interrupted: groupOutcomes.filter((outcome) => outcome.status === "interrupted").length,
    skipped: groupOutcomes.filter((outcome) => outcome.status === "skipped").length,
  };
  return {
    version: "paperclip_test_run_summary_v1",
    status,
    exitCode,
    signal,
    invocationCount: invocationOutcomes.length,
    counts,
    groupCount: groupOutcomes.length,
    groupCounts,
    failureLabel,
    durationMs: Date.now() - runStartedAt,
  };
}

function removeSignalHandlers() {
  clearForceKillTimer();
  for (const [signal, handler] of signalHandlers) {
    process.off(signal, handler);
  }
}

let shouldEmitTerminalSummary = true;
let finalStatus = "completed";
let finalExitCode = 0;
let finalSignal = null;
let failureLabel = null;

try {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.dryRun) {
    const serializedSuites =
      options.mode === serializedModeName
        ? selectSerializedSuites(routeTests, options.shardIndex, options.shardCount)
        : routeTests;
    console.log(
      JSON.stringify(
        {
          mode: options.mode,
          shardIndex: options.shardIndex,
          shardCount: options.shardCount,
          group: options.group,
          availableGeneralGroups: generalGroupNames,
          serializedSuiteCount: routeTests.length,
          selectedSerializedSuites: serializedSuites.map((routeTest) => routeTest.repoPath),
          generalServerSuiteCount: generalServerTestFiles.length,
          selectedGeneralServerSuites:
            options.mode === generalModeName &&
            options.group === generalServerGroupName &&
            options.shardCount !== null
              ? generalServerTestFiles.filter(
                  (_, index) => index % options.shardCount === options.shardIndex,
                )
              : null,
        },
        null,
        2,
      ),
    );
    shouldEmitTerminalSummary = false;
  } else {
    if (options.mode === generalModeName || options.mode === allModeName) {
      if (options.group) {
        const group = options.group === generalServerGroupName && options.shardCount !== null
          ? `${options.group}-shard-${options.shardIndex + 1}-of-${options.shardCount}`
          : options.group;
        await runTrackedGroup(group, () =>
          runGeneralGroup(routeTests, options.group, options.shardIndex, options.shardCount)
        );
      } else {
        await runGeneralSuites(routeTests);
      }
    }

    if (options.mode === serializedModeName || options.mode === allModeName) {
      const shardIndex = options.shardIndex ?? 0;
      const shardCount = options.shardCount ?? 1;
      const group = `serialized-shard-${shardIndex + 1}-of-${shardCount}`;
      await runTrackedGroup(group, () =>
        runSerializedSuites(routeTests, shardIndex, shardCount)
      );
    }
  }
} catch (error) {
  if (error instanceof TestRunInterrupted) {
    finalStatus = "interrupted";
    finalSignal = error.signal;
    finalExitCode = signalExitCode(error.signal);
    failureLabel = error.label;
  } else {
    finalStatus = "failed";
    finalExitCode = error instanceof TestRunFailure ? error.exitCode : 1;
    failureLabel = error instanceof TestRunFailure ? error.label : null;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[test:run] ${message}`);
  }
} finally {
  removeSignalHandlers();
  if (shouldEmitTerminalSummary) {
    console.log(
      `[test:run] terminal-summary ${JSON.stringify(
        terminalSummary(finalStatus, finalExitCode, finalSignal, failureLabel),
      )}`,
    );
  }
  process.exitCode = finalExitCode;
}
