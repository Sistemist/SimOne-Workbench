import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
  createDb,
  ventureConstitutionRevisions,
} from "@paperclipai/db";
import type { VentureConstitutionContent } from "@paperclipai/shared";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { errorHandler } from "../middleware/index.js";
import { ventureConstitutionRoutes } from "../routes/venture-constitution.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres Venture Constitution tests on this host: ${
      embeddedPostgresSupport.reason ?? "unsupported environment"
    }`,
  );
}

function boardActor(companyIds: string[]): Express.Request["actor"] {
  return {
    type: "board",
    userId: "founder-1",
    source: "session",
    isInstanceAdmin: false,
    companyIds,
    memberships: companyIds.map((companyId) => ({
      companyId,
      membershipRole: "admin",
      status: "active",
    })),
  };
}

function agentActor(companyId: string, agentId: string): Express.Request["actor"] {
  return {
    type: "agent",
    agentId,
    companyId,
    runId: null,
    source: "agent_jwt",
  };
}

function createApp(db: ReturnType<typeof createDb>, actor: Express.Request["actor"]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", ventureConstitutionRoutes(db));
  app.use(errorHandler);
  return app;
}

function content(purpose: string): VentureConstitutionContent {
  return {
    purpose,
    intendedImpact: "Founders operate coherent ventures without surrendering judgment.",
    customerPrinciples: ["Start with observed founder constraints."],
    qualityPrinciples: ["Prefer evidence over confident language."],
    voice: {
      desired: ["Grounded", "Technically authoritative"],
      examples: ["Show the next bounded move."],
      counterexamples: ["Promise autonomous company success."],
    },
    nonNegotiables: ["Founder approval before consequential change."],
    antiGoals: ["Autonomous weekly scheduling."],
    decisionRights: {
      founder: ["Activate or replace the Venture Constitution."],
      delegated: ["Prepare bounded proposals with evidence."],
      approvalRequired: ["Public commitments", "Paid model execution"],
    },
    riskTolerance: {
      financial: "No unbounded spend.",
      security: "Fail closed when control evidence is missing.",
      privacy: "Project only the minimum necessary context.",
      reputational: "Do not publish unverified claims.",
    },
    evidenceStandards: ["Record source references and the responsible actor."],
  };
}

describeEmbeddedPostgres("Venture Constitution routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-venture-constitution-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(ventureConstitutionRevisions);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompany(name = "Sysdom AI") {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name,
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    return companyId;
  }

  async function seedAgent(companyId: string) {
    const agentId = randomUUID();
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
    return agentId;
  }

  it("creates a draft and requires an explicit board activation before it becomes current", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));

    expect((await request(app).get(`/api/companies/${companyId}/venture-constitution`)).body).toBeNull();

    const created = await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions`)
      .send({
        content: content("Keep the founder in control of a useful venture loop."),
        changeReason: "Establish the first reviewable operating contract.",
        sourceRefs: [{ kind: "founder_intake", label: "Founder setup interview" }],
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      companyId,
      version: 1,
      status: "draft",
      changeReason: "Establish the first reviewable operating contract.",
      createdByUserId: "founder-1",
      activatedAt: null,
    });
    expect((await request(app).get(`/api/companies/${companyId}/venture-constitution`)).body).toBeNull();

    const activated = await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions/${created.body.id}/activate`)
      .send({ approvalNote: "Approved as the founder's current operating contract." });

    expect(activated.status).toBe(200);
    expect(activated.body).toMatchObject({
      id: created.body.id,
      version: 1,
      status: "active",
      activatedByUserId: "founder-1",
      approvalNote: "Approved as the founder's current operating contract.",
    });
    expect(activated.body.activatedAt).toEqual(expect.any(String));

    const current = await request(app).get(`/api/companies/${companyId}/venture-constitution`);
    expect(current.body).toMatchObject({ id: created.body.id, status: "active", version: 1 });
  });

  it("preserves superseded history and restores old content through a new draft", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));

    const first = await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions`)
      .send({ content: content("Purpose v1"), changeReason: "Initial purpose." });
    await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions/${first.body.id}/activate`)
      .send({ approvalNote: "Approve v1." });

    const second = await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions`)
      .send({ content: content("Purpose v2"), changeReason: "Clarify the purpose." });
    await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions/${second.body.id}/activate`)
      .send({ approvalNote: "Approve v2." });

    const revisions = await request(app).get(
      `/api/companies/${companyId}/venture-constitution/revisions`,
    );
    expect(revisions.body).toHaveLength(2);
    expect(revisions.body[0]).toMatchObject({ id: second.body.id, version: 2, status: "active" });
    expect(revisions.body[1]).toMatchObject({ id: first.body.id, version: 1, status: "superseded" });
    expect(revisions.body[1].supersededAt).toEqual(expect.any(String));

    const restored = await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions/${first.body.id}/restore`)
      .send({ changeReason: "Return to the original purpose after reviewing evidence." });
    expect(restored.status).toBe(201);
    expect(restored.body).toMatchObject({
      version: 3,
      status: "draft",
      restoredFromRevisionId: first.body.id,
      content: { purpose: "Purpose v1" },
    });

    const current = await request(app).get(`/api/companies/${companyId}/venture-constitution`);
    expect(current.body).toMatchObject({ id: second.body.id, version: 2, status: "active" });
  });

  it("lets an agent propose a draft but prevents it from activating the draft", async () => {
    const companyId = await seedCompany();
    const agentId = await seedAgent(companyId);
    const app = createApp(db, agentActor(companyId, agentId));

    const created = await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions`)
      .send({
        content: content("Agent-proposed purpose"),
        changeReason: "SIM Coach proposal for founder review.",
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: "draft",
      createdByAgentId: agentId,
      createdByUserId: null,
    });

    const activation = await request(app)
      .post(`/api/companies/${companyId}/venture-constitution/revisions/${created.body.id}/activate`)
      .send({ approvalNote: "Agent should not be able to approve this." });
    expect(activation.status).toBe(403);
    expect(activation.body.error).toBe("Board access required");
  });

  it("does not expose or mutate revisions across company boundaries", async () => {
    const companyId = await seedCompany();
    const otherCompanyId = await seedCompany("Other venture");
    const ownerApp = createApp(db, boardActor([companyId]));
    const otherApp = createApp(db, boardActor([otherCompanyId]));

    const created = await request(ownerApp)
      .post(`/api/companies/${companyId}/venture-constitution/revisions`)
      .send({ content: content("Private purpose"), changeReason: "Company-scoped draft." });

    expect(
      (
        await request(otherApp).get(
          `/api/companies/${companyId}/venture-constitution/revisions`,
        )
      ).status,
    ).toBe(403);

    const activate = await request(otherApp)
      .post(
        `/api/companies/${otherCompanyId}/venture-constitution/revisions/${created.body.id}/activate`,
      )
      .send({ approvalNote: "Attempt cross-company activation." });
    expect(activate.status).toBe(404);
  });
});
