import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  companySkills,
  costEvents,
  createDb,
  modelRouteDecisions,
} from "@paperclipai/db";
import type { AdapterExecutionResult } from "@paperclipai/adapter-utils";
import type { PaperclipSkillEntry } from "@paperclipai/adapter-utils/server-utils";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { companySkillService } from "../services/company-skills.ts";
import { heartbeatService } from "../services/heartbeat.ts";
import { modelRouteDecisionService } from "../services/model-route-decisions.ts";
import { registerServerAdapter, unregisterServerAdapter } from "../adapters/index.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const TEST_ADAPTER_TYPE = "runtime_skill_capture";

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres heartbeat runtime skill tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

async function waitForRunToFinish(
  heartbeat: ReturnType<typeof heartbeatService>,
  runId: string,
  timeoutMs = 5_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await heartbeat.getRun(runId);
    if (run && !["queued", "running"].includes(run.status)) return run;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return await heartbeat.getRun(runId);
}

async function waitForRouteDecisionReview(
  db: ReturnType<typeof createDb>,
  runId: string,
  timeoutMs = 5_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const decision = await db
      .select()
      .from(modelRouteDecisions)
      .where(eq(modelRouteDecisions.heartbeatRunId, runId))
      .then((rows) => rows[0] ?? null);
    if (decision && decision.reviewStatus !== "pending") return decision;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return db
    .select()
    .from(modelRouteDecisions)
    .where(eq(modelRouteDecisions.heartbeatRunId, runId))
    .then((rows) => rows[0] ?? null);
}

async function waitForRouteDecisionCost(
  db: ReturnType<typeof createDb>,
  runId: string,
  timeoutMs = 5_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const decision = await db
      .select()
      .from(modelRouteDecisions)
      .where(eq(modelRouteDecisions.heartbeatRunId, runId))
      .then((rows) => rows[0] ?? null);
    if (decision) {
      const linkedCosts = await db
        .select()
        .from(costEvents)
        .where(eq(costEvents.modelRouteDecisionId, decision.id));
      if (linkedCosts.length > 0) return { decision, linkedCosts };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const decision = await db
    .select()
    .from(modelRouteDecisions)
    .where(eq(modelRouteDecisions.heartbeatRunId, runId))
    .then((rows) => rows[0] ?? null);
  const linkedCosts = decision
    ? await db
        .select()
        .from(costEvents)
        .where(eq(costEvents.modelRouteDecisionId, decision.id))
    : [];
  return { decision, linkedCosts };
}

describeEmbeddedPostgres("heartbeat runtime skill version pins", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let oldPaperclipHome: string | undefined;
  let paperclipHome: string | null = null;
  const capturedRuns: Array<{ agentId: string; skills: PaperclipSkillEntry[] }> = [];
  const cleanupDirs = new Set<string>();

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("heartbeat-runtime-skills-");
    db = createDb(tempDb.connectionString);
    oldPaperclipHome = process.env.PAPERCLIP_HOME;
    paperclipHome = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-runtime-skills-home-"));
    process.env.PAPERCLIP_HOME = paperclipHome;
    registerServerAdapter({
      type: TEST_ADAPTER_TYPE,
      execute: async (ctx) => {
        capturedRuns.push({
          agentId: ctx.agent.id,
          skills: (ctx.config.paperclipRuntimeSkills ?? []) as PaperclipSkillEntry[],
        });
        const configuredResult =
          ctx.config.testExecutionResult && typeof ctx.config.testExecutionResult === "object"
            ? ctx.config.testExecutionResult as Partial<AdapterExecutionResult>
            : {};
        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          label: "Captured runtime skills",
          provider: TEST_ADAPTER_TYPE,
          model: typeof ctx.config.model === "string" ? ctx.config.model : "test-model",
          billingType: "api" as const,
          costUsd: 0.12,
          usage: {
            inputTokens: 1200,
            cachedInputTokens: 100,
            outputTokens: 450,
          },
          ...configuredResult,
        };
      },
      testEnvironment: async () => ({
        adapterType: TEST_ADAPTER_TYPE,
        status: "pass",
        checks: [],
        testedAt: new Date().toISOString(),
      }),
    });
  }, 20_000);

  afterEach(async () => {
    capturedRuns.length = 0;
    await db.execute(sql.raw(`
      TRUNCATE TABLE
        "activity_log",
        "environment_leases",
        "environments",
        "heartbeat_run_events",
        "heartbeat_runs",
        "agent_wakeup_requests",
        "agent_runtime_state",
        "model_route_decisions",
        "company_skill_versions",
        "company_skills",
        "agents",
        "companies"
      RESTART IDENTITY CASCADE
    `));
    await Promise.all(Array.from(cleanupDirs, (dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  afterAll(async () => {
    unregisterServerAdapter(TEST_ADAPTER_TYPE);
    if (oldPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = oldPaperclipHome;
    if (paperclipHome) {
      await fs.rm(paperclipHome, { recursive: true, force: true });
    }
    await tempDb?.cleanup();
  });

  it("blocks an explicitly governed model route before the adapter runs when spend controls are incomplete", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Sysdom AI",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Governed Route",
      role: "engineer",
      status: "idle",
      adapterType: TEST_ADAPTER_TYPE,
      adapterConfig: {
        model: "test-model",
        modelExecutionSafety: {
          billingType: "metered_api",
          provider: TEST_ADAPTER_TYPE,
          model: "test-model",
          maxRuns: 2,
          maxRetries: 1,
          concurrency: 2,
        },
      },
      runtimeConfig: {},
      permissions: {},
    });

    const heartbeat = heartbeatService(db);
    const run = await heartbeat.invoke(agentId, "on_demand", {}, "manual");
    expect(run).not.toBeNull();

    const finished = await waitForRunToFinish(heartbeat, run!.id);
    expect(finished).toMatchObject({
      status: "failed",
      errorCode: "configuration_incomplete",
    });
    expect(capturedRuns).toHaveLength(0);

    const decision = await waitForRouteDecisionReview(db, run!.id);
    expect(decision).toMatchObject({
      provider: TEST_ADAPTER_TYPE,
      model: "test-model",
      reviewStatus: "needs_revision",
      outputConfidence: "low",
      metadata: {
        executionSafety: {
          status: "blocked",
          enforced: true,
          billingType: "metered_api",
          blockers: expect.arrayContaining([
            "timeout_missing",
            "max_turns_missing",
            "max_runs_not_one",
            "automatic_retries_enabled",
            "concurrency_not_one",
            "provider_cap_missing",
            "provider_cap_verification_missing",
            "run_cap_missing",
          ]),
        },
      },
    });

  });

  it("runs a fully pinned mock route once when independent and runtime controls agree", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Sysdom AI",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Governed Mock Route",
      role: "engineer",
      status: "idle",
      adapterType: TEST_ADAPTER_TYPE,
      adapterConfig: {
        model: "test-model",
        timeoutSec: 60,
        maxTurnsPerRun: 5,
        modelExecutionSafety: {
          billingType: "metered_api",
          provider: TEST_ADAPTER_TYPE,
          model: "test-model",
          providerHardCapCents: 100,
          providerHardCapEvidenceSource: "Recorded provider fixture",
          providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
          providerHardCapExpiresAt: "2099-07-31T08:00:00.000Z",
          maxRunCostCents: 25,
          maxRuns: 1,
          maxRetries: 0,
          concurrency: 1,
        },
      },
      runtimeConfig: {
        heartbeat: {
          maxConcurrentRuns: 1,
          maxDailyRuns: 1,
          maxTurnContinuation: {
            enabled: false,
            maxAttempts: 0,
          },
        },
      },
      permissions: {},
    });

    const heartbeat = heartbeatService(db);
    const run = await heartbeat.invoke(agentId, "on_demand", {}, "manual");
    expect(run).not.toBeNull();
    expect((await waitForRunToFinish(heartbeat, run!.id))?.status).toBe("succeeded");
    expect(capturedRuns).toHaveLength(1);

    // A terminal run precedes post-run runtime ledger bookkeeping. Wait for
    // that promised evidence before teardown removes the suite's shared rows.
    const { decision, linkedCosts } = await waitForRouteDecisionCost(db, run!.id);
    expect(decision?.metadata).toMatchObject({
      executionSafety: {
        status: "ready",
        enforced: true,
        billingType: "metered_api",
        blockers: [],
        controls: {
          timeoutSec: 60,
          maxTurnsPerRun: 5,
          maxRuns: 1,
          maxRetries: 0,
          concurrency: 1,
          maxRunCostCents: 25,
          providerHardCapCents: 100,
        },
      },
      executionReconciliation: {
        status: "reconciled",
        terminalOutcome: "succeeded",
        blockers: [],
        expected: {
          provider: TEST_ADAPTER_TYPE,
          model: "test-model",
          billingType: "metered_api",
          maxRunCostCents: 25,
        },
        actual: {
          provider: TEST_ADAPTER_TYPE,
          model: "test-model",
          billingType: "metered_api",
          costKnown: true,
          costCents: 12,
          inputTokens: 1200,
          cachedInputTokens: 100,
          outputTokens: 450,
        },
      },
    });
    expect(linkedCosts).toHaveLength(1);
    expect(linkedCosts[0]).toMatchObject({
      provider: TEST_ADAPTER_TYPE,
      model: "test-model",
      billingType: "metered_api",
      costCents: 12,
      inputTokens: 1200,
      cachedInputTokens: 100,
      outputTokens: 450,
    });
  });

  it("fails the mock run after invocation when actual route evidence violates the authorization", async () => {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Sysdom AI",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Mismatched Governed Mock Route",
      role: "engineer",
      status: "idle",
      adapterType: TEST_ADAPTER_TYPE,
      adapterConfig: {
        model: "test-model",
        timeoutSec: 60,
        maxTurnsPerRun: 5,
        testExecutionResult: {
          provider: "unexpected-provider",
          model: "unexpected-model",
          billingType: "api",
          costUsd: null,
        },
        modelExecutionSafety: {
          billingType: "metered_api",
          provider: TEST_ADAPTER_TYPE,
          model: "test-model",
          providerHardCapCents: 100,
          providerHardCapEvidenceSource: "Recorded provider fixture",
          providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
          providerHardCapExpiresAt: "2099-07-31T08:00:00.000Z",
          maxRunCostCents: 25,
          maxRuns: 1,
          maxRetries: 0,
          concurrency: 1,
        },
      },
      runtimeConfig: {
        heartbeat: {
          maxConcurrentRuns: 1,
          maxDailyRuns: 1,
          maxTurnContinuation: {
            enabled: false,
            maxAttempts: 0,
          },
        },
      },
      permissions: {},
    });

    const heartbeat = heartbeatService(db);
    const run = await heartbeat.invoke(agentId, "on_demand", {}, "manual");
    expect(run).not.toBeNull();

    const finished = await waitForRunToFinish(heartbeat, run!.id);
    expect(finished).toMatchObject({
      status: "failed",
      errorCode: "model_execution_reconciliation",
    });
    expect(capturedRuns).toHaveLength(1);

    const decision = await waitForRouteDecisionReview(db, run!.id);
    expect(decision).toMatchObject({
      provider: TEST_ADAPTER_TYPE,
      model: "test-model",
      reviewStatus: "needs_revision",
      metadata: {
        executionSafety: {
          status: "ready",
          blockers: [],
        },
        executionReconciliation: {
          status: "blocked",
          terminalOutcome: "succeeded",
          blockers: [
            "actual_provider_mismatch",
            "actual_model_mismatch",
            "actual_cost_missing",
          ],
          actual: {
            provider: "unexpected-provider",
            model: "unexpected-model",
            billingType: "metered_api",
            costKnown: false,
          },
        },
      },
    });

    const routeDecisions = modelRouteDecisionService(db);
    expect(
      await routeDecisions.findBlockingExecutionReconciliation(companyId, agentId),
    ).toMatchObject({ id: decision!.id });

    await routeDecisions.updateReview(companyId, decision!.id, {
      outputSummary: decision!.outputSummary,
      outputConfidence: "low",
      reviewStatus: "approved",
      reviewNote: "Board reviewed the mismatch and explicitly cleared the execution lock.",
    });
    expect(
      await routeDecisions.findBlockingExecutionReconciliation(companyId, agentId),
    ).toBeNull();
  });

  it("materializes different pinned skill versions for different agents at runtime", async () => {
    const companyId = randomUUID();
    const skillId = randomUUID();
    const firstAgentId = randomUUID();
    const secondAgentId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    const skillKey = `company/${companyId}/runtime-coach`;
    const skillDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-versioned-runtime-skill-"));
    cleanupDirs.add(skillDir);

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Runtime Coach\n\nVersion one.\n", "utf8");
    await db.insert(companySkills).values({
      id: skillId,
      companyId,
      key: skillKey,
      slug: "runtime-coach",
      name: "Runtime Coach",
      description: null,
      markdown: "# Runtime Coach\n\nVersion one.\n",
      sourceType: "local_path",
      sourceLocator: skillDir,
      trustLevel: "markdown_only",
      compatibility: "compatible",
      fileInventory: [{ path: "SKILL.md", kind: "skill" }],
      metadata: { sourceKind: "local_path" },
    });

    const skills = companySkillService(db);
    const versionOne = await skills.createVersion(
      companyId,
      skillId,
      { label: "v1" },
      { type: "user", userId: "board" },
    );
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Runtime Coach\n\nVersion two.\n", "utf8");
    await db
      .update(companySkills)
      .set({ markdown: "# Runtime Coach\n\nVersion two.\n", updatedAt: new Date() })
      .where(eq(companySkills.id, skillId));
    const versionTwo = await skills.createVersion(
      companyId,
      skillId,
      { label: "v2" },
      { type: "user", userId: "board" },
    );

    await db.insert(agents).values([
      {
        id: firstAgentId,
        companyId,
        name: "Pinned V1",
        role: "engineer",
        status: "idle",
        adapterType: TEST_ADAPTER_TYPE,
        adapterConfig: {
          paperclipSkillSync: {
            desiredSkills: [{ key: skillKey, versionId: versionOne.id }],
          },
        },
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: secondAgentId,
        companyId,
        name: "Pinned V2",
        role: "engineer",
        status: "idle",
        adapterType: TEST_ADAPTER_TYPE,
        adapterConfig: {
          paperclipSkillSync: {
            desiredSkills: [{ key: skillKey, versionId: versionTwo.id }],
          },
        },
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    const heartbeat = heartbeatService(db);
    const firstRun = await heartbeat.invoke(firstAgentId, "on_demand", {}, "manual");
    expect(firstRun).not.toBeNull();
    expect((await waitForRunToFinish(heartbeat, firstRun!.id))?.status).toBe("succeeded");

    const secondRun = await heartbeat.invoke(secondAgentId, "on_demand", {}, "manual");
    expect(secondRun).not.toBeNull();
    expect((await waitForRunToFinish(heartbeat, secondRun!.id))?.status).toBe("succeeded");

    const firstSkill = capturedRuns.find((run) => run.agentId === firstAgentId)?.skills
      .find((entry) => entry.key === skillKey);
    const secondSkill = capturedRuns.find((run) => run.agentId === secondAgentId)?.skills
      .find((entry) => entry.key === skillKey);

    expect(firstSkill).toMatchObject({
      key: skillKey,
      versionId: versionOne.id,
      currentVersionId: versionTwo.id,
      sourceStatus: "available",
    });
    expect(secondSkill).toMatchObject({
      key: skillKey,
      versionId: versionTwo.id,
      currentVersionId: versionTwo.id,
      sourceStatus: "available",
    });
    await expect(fs.readFile(path.join(firstSkill!.source, "SKILL.md"), "utf8"))
      .resolves.toContain("Version one.");
    await expect(fs.readFile(path.join(secondSkill!.source, "SKILL.md"), "utf8"))
      .resolves.toContain("Version two.");

    const firstSkillFile = path.join(firstSkill!.source, "SKILL.md");
    const oldMtime = new Date("2024-01-01T00:00:00.000Z");
    await fs.utimes(firstSkillFile, oldMtime, oldMtime);

    const repeatRun = await heartbeat.invoke(firstAgentId, "on_demand", {}, "manual");
    expect(repeatRun).not.toBeNull();
    expect((await waitForRunToFinish(heartbeat, repeatRun!.id))?.status).toBe("succeeded");
    const repeatedSkill = capturedRuns
      .filter((run) => run.agentId === firstAgentId)
      .at(-1)
      ?.skills.find((entry) => entry.key === skillKey);
    expect(repeatedSkill).toMatchObject({
      source: firstSkill!.source,
      versionId: versionOne.id,
      sourceStatus: "available",
    });
    expect((await fs.stat(firstSkillFile)).mtime.toISOString()).toBe(oldMtime.toISOString());
  });
});
