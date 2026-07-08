import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
  costEvents,
  createDb,
  modelRouteDecisions,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { errorHandler } from "../middleware/index.js";
import { costRoutes } from "../routes/costs.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres model route decision tests on this host: ${
      embeddedPostgresSupport.reason ?? "unsupported environment"
    }`,
  );
}

function boardActor(companyId: string) {
  return {
    type: "board" as const,
    userId: "user-1",
    source: "session" as const,
    isInstanceAdmin: false,
    companyIds: [companyId],
    memberships: [{ companyId, membershipRole: "admin", status: "active" }],
  };
}

function createApp(db: ReturnType<typeof createDb>, actor: Express.Request["actor"]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", costRoutes(db));
  app.use(errorHandler);
  return app;
}

describeEmbeddedPostgres("model route decision routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-model-route-decisions-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(costEvents);
    await db.delete(modelRouteDecisions);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seed() {
    const companyId = randomUUID();
    const agentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "SimOne",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "SIM Coach",
      role: "coach",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });
    return { companyId, agentId };
  }

  it("records an auditable model route decision before execution", async () => {
    const { companyId, agentId } = await seed();
    const app = createApp(db, boardActor(companyId));

    const createRes = await request(app)
      .post(`/api/companies/${companyId}/model-route-decisions`)
      .send({
        agentId,
        lane: "deliberation_audit",
        provider: "openrouter",
        model: "openrouter/fusion",
        reason: "Public claim needs disagreement and blind-spot review.",
        riskLevel: "high",
        taskIntent: "Review launch positioning before publishing.",
        contextSummary: "Scanner output plus draft public claim.",
        approvalGate: "human_before_publish",
        metadata: { source: "SYS-202" },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      companyId,
      agentId,
      lane: "deliberation_audit",
      provider: "openrouter",
      model: "openrouter/fusion",
      reason: "Public claim needs disagreement and blind-spot review.",
      riskLevel: "high",
      taskIntent: "Review launch positioning before publishing.",
      contextSummary: "Scanner output plus draft public claim.",
      approvalGate: "human_before_publish",
      metadata: { source: "SYS-202" },
    });
    expect(createRes.body.id).toEqual(expect.any(String));
    expect(createRes.body.createdAt).toEqual(expect.any(String));

    const listRes = await request(app).get(`/api/companies/${companyId}/model-route-decisions?limit=10`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0]).toMatchObject({
      id: createRes.body.id,
      lane: "deliberation_audit",
      provider: "openrouter",
      model: "openrouter/fusion",
    });
  });

  it("updates a route decision with output confidence and human review state after execution", async () => {
    const { companyId, agentId } = await seed();
    const app = createApp(db, boardActor(companyId));

    const createRes = await request(app)
      .post(`/api/companies/${companyId}/model-route-decisions`)
      .send({
        agentId,
        lane: "frontier",
        provider: "anthropic",
        model: "claude-fable-5",
        reason: "High-level SIM Coach audit needs a boardroom-brain model.",
        riskLevel: "high",
        taskIntent: "Audit a risky public positioning recommendation.",
        contextSummary: "Scanner result, venture map preview, and draft positioning.",
        approvalGate: "human_before_publish",
        metadata: { source: "SYS-202" },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      outputSummary: null,
      outputConfidence: "unknown",
      reviewStatus: "pending",
      reviewNote: null,
    });

    const updateRes = await request(app)
      .patch(`/api/companies/${companyId}/model-route-decisions/${createRes.body.id}/review`)
      .send({
        outputSummary: "Fable audit flagged one overclaim and recommended a narrower proof promise.",
        outputConfidence: "medium",
        reviewStatus: "needs_revision",
        reviewNote: "Human review required before this becomes public copy.",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({
      id: createRes.body.id,
      companyId,
      agentId,
      outputSummary: "Fable audit flagged one overclaim and recommended a narrower proof promise.",
      outputConfidence: "medium",
      reviewStatus: "needs_revision",
      reviewNote: "Human review required before this becomes public copy.",
    });

    const listRes = await request(app).get(`/api/companies/${companyId}/model-route-decisions?limit=10`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items[0]).toMatchObject({
      id: createRes.body.id,
      outputSummary: "Fable audit flagged one overclaim and recommended a narrower proof promise.",
      outputConfidence: "medium",
      reviewStatus: "needs_revision",
      reviewNote: "Human review required before this becomes public copy.",
    });
  });

  it("links reported model costs back to the route decision that caused them", async () => {
    const { companyId, agentId } = await seed();
    const app = createApp(db, boardActor(companyId));

    const decisionRes = await request(app)
      .post(`/api/companies/${companyId}/model-route-decisions`)
      .send({
        agentId,
        lane: "external_specialist",
        provider: "sakana",
        model: "fugu-ultra",
        reason: "Delegate a complex execution task while preserving an auditable spend trail.",
        riskLevel: "medium",
        taskIntent: "Run specialist execution for a Skills Engine task.",
        contextSummary: "Compressed task brief and acceptance criteria.",
        approvalGate: "human_after_draft",
        metadata: { source: "SYS-202" },
      });

    expect(decisionRes.status).toBe(201);

    const costRes = await request(app)
      .post(`/api/companies/${companyId}/cost-events`)
      .send({
        agentId,
        modelRouteDecisionId: decisionRes.body.id,
        provider: "sakana",
        biller: "sakana",
        billingType: "metered_api",
        model: "fugu-ultra",
        inputTokens: 1200,
        cachedInputTokens: 100,
        outputTokens: 450,
        costCents: 87,
        occurredAt: "2026-07-08T10:00:00.000Z",
      });

    expect(costRes.status).toBe(201);
    expect(costRes.body).toMatchObject({
      companyId,
      agentId,
      modelRouteDecisionId: decisionRes.body.id,
      provider: "sakana",
      model: "fugu-ultra",
      costCents: 87,
    });

    const listRes = await request(app).get(`/api/companies/${companyId}/model-route-decisions?limit=10`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items[0]).toMatchObject({
      id: decisionRes.body.id,
      costEventCount: 1,
      costCents: 87,
    });
  });

  it("compresses bulky JSON context into auditable metadata instead of storing raw payloads", async () => {
    const { companyId, agentId } = await seed();
    const app = createApp(db, boardActor(companyId));
    const repeatedActions = Array.from({ length: 20 }, (_, index) => ({
      id: `reply:${index}`,
      title: `Review reply ${index}`,
      reason: "Grounded in a real signal that should stay live in the source system.",
      authorization: "Bearer do-not-store",
      notes: "Customer queue detail. ".repeat(80),
    }));

    const createRes = await request(app)
      .post(`/api/companies/${companyId}/model-route-decisions`)
      .send({
        agentId,
        lane: "workhorse",
        provider: "anthropic",
        model: "claude-sonnet",
        reason: "Summarize bridge context for SIM Coach without bloating the context window.",
        riskLevel: "medium",
        taskIntent: "Explain Customer Engine signal.",
        contextSummary: "Live Tissuu bridge digest plus review queue sample.",
        approvalGate: "human_before_customer_action",
        metadata: { source: "SYS-202" },
        contextPayload: {
          sourceKind: "tissuu-customer-engine-bridge",
          generatedAt: "2026-07-08T00:00:00Z",
          actions: repeatedActions,
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.metadata.source).toBe("SYS-202");
    expect(createRes.body.metadata.contextCompression).toMatchObject({
      strategy: "simone_json_headroom_v0",
      sourceKind: "tissuu-customer-engine-bridge",
      lossy: true,
      redactedKeys: ["authorization"],
      omittedArrayItems: 17,
    });
    expect(createRes.body.metadata.contextCompression.inputBytes).toBeGreaterThan(
      createRes.body.metadata.contextCompression.outputBytes,
    );
    expect(createRes.body.metadata.contextCompression.inputSha256).toEqual(expect.any(String));
    expect(createRes.body.metadata.contextCompression.outputSha256).toEqual(expect.any(String));
    expect(createRes.body.metadata.contextCompression.compressedJson).toContain("__simoneCompressedArray");
    expect(createRes.body.metadata.contextCompression.compressedJson).toContain("[redacted]");
    expect(createRes.body.metadata.contextCompression.compressedJson).not.toContain("do-not-store");
    expect(createRes.body.metadata.contextCompression.compressedJson).not.toContain("reply:19");
  });

  it("redacts obvious secret values and bounds wide context payloads", async () => {
    const { companyId, agentId } = await seed();
    const app = createApp(db, boardActor(companyId));
    const widePayload = Object.fromEntries(
      Array.from({ length: 80 }, (_, index) => [`field${index}`, `value-${index}`]),
    );

    const createRes = await request(app)
      .post(`/api/companies/${companyId}/model-route-decisions`)
      .send({
        agentId,
        lane: "workhorse",
        provider: "anthropic",
        model: "claude-sonnet",
        reason: "Compress a wide context object before routing.",
        metadata: { source: "SYS-202" },
        contextPayload: {
          sourceKind: "wide-test",
          prompt: "Use Authorization: Bearer live-secret-value before continuing.",
          cookieHeader: "session=live-cookie-value",
          widePayload,
        },
      });

    expect(createRes.status).toBe(201);
    const envelope = createRes.body.metadata.contextCompression;
    expect(envelope.redactedValues).toBeGreaterThanOrEqual(2);
    expect(envelope.omittedObjectKeys).toBeGreaterThan(0);
    expect(envelope.compressedJson).toContain("__simoneCompressedObject");
    expect(envelope.compressedJson).toContain("[redacted]");
    expect(envelope.compressedJson).not.toContain("live-secret-value");
    expect(envelope.compressedJson).not.toContain("live-cookie-value");
    expect(envelope.compressedJson).not.toContain("field79");
  });

  it("rejects raw context-like or secret-like metadata fields", async () => {
    const { companyId, agentId } = await seed();
    const app = createApp(db, boardActor(companyId));

    const createRes = await request(app)
      .post(`/api/companies/${companyId}/model-route-decisions`)
      .send({
        agentId,
        lane: "workhorse",
        provider: "anthropic",
        model: "claude-sonnet",
        reason: "Attempt to bypass context compression.",
        metadata: {
          source: "SYS-202",
          rawContext: { authorization: "Bearer do-not-store" },
        },
      });

    expect(createRes.status).toBe(400);
    expect(createRes.body.error).toContain("Use contextPayload");
  });
});
