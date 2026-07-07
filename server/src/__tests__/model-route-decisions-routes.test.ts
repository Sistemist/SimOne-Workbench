import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
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
});
