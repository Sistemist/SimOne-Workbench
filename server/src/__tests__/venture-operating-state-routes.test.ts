import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  approvals,
  companies,
  createDb,
  issues,
  ventureConstitutionRevisions,
  ventureContextProjections,
  ventureStateRevisions,
} from "@paperclipai/db";
import type { VentureConstitutionContent, VentureStateContent } from "@paperclipai/shared";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { errorHandler } from "../middleware/index.js";
import { ventureOperatingStateRoutes } from "../routes/venture-operating-state.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

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

function agentActor(companyId: string): Express.Request["actor"] {
  return {
    type: "agent",
    agentId: randomUUID(),
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
  app.use("/api", ventureOperatingStateRoutes(db));
  app.use(errorHandler);
  return app;
}

function constitutionContent(): VentureConstitutionContent {
  return {
    purpose: "Keep a founder's venture coherent while AI performs bounded work.",
    intendedImpact: "More viable ventures with human judgment intact.",
    customerPrinciples: ["Start from observed constraints."],
    qualityPrinciples: ["Prefer inspectable evidence."],
    voice: { desired: ["Grounded"], examples: [], counterexamples: [] },
    nonNegotiables: ["No consequential action without founder approval."],
    antiGoals: ["Autonomous weekly scheduling."],
    decisionRights: {
      founder: ["Choose the active constraint."],
      delegated: ["Prepare evidence-backed proposals."],
      approvalRequired: ["Public commitments", "Paid model use"],
    },
    riskTolerance: {
      financial: "Bounded",
      security: "Fail closed",
      privacy: "Minimum necessary context",
      reputational: "No unverified claims",
    },
    evidenceStandards: ["Record the source and responsible actor."],
  };
}

function stateContent(now = "2026-07-31T20:00:00.000Z"): VentureStateContent {
  const engine = (summary: string, label: string) => ({
    summary,
    evidence: [{ kind: "founder_note", label, capturedAt: now }],
    freshness: now,
  });
  return {
    ventureSummary: "Sysdom AI is preparing a controlled founder cohort.",
    engines: {
      product: engine("Founder Cockpit is the next product proof.", "Product review"),
      customer: engine("Founder cohort recruitment has not started.", "Customer review"),
      cash: engine("No paid-model spend is authorized.", "Cash review"),
      skills: engine("Core control-plane capability is present.", "Skills review"),
    },
    activeConstraint: {
      engine: "customer",
      hypothesis: "The next bottleneck is recruiting and learning from the first founder cohort.",
      confidence: "medium",
      evidence: [{ kind: "clickup", id: "86eyeztfu", label: "Scanner outcome" }],
      decision: "accepted",
      decisionNote: "Founder selected this constraint.",
      decidedByUserId: "founder-1",
      decidedAt: now,
    },
    nextMove: {
      title: "Run one founder onboarding session",
      rationale: "Test the full loop before increasing acquisition.",
      engine: "customer",
      approvalRequired: true,
    },
    learnings: [],
    refreshedAt: now,
  };
}

describeEmbeddedPostgres("venture operating state routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-venture-operating-state-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(ventureContextProjections);
    await db.delete(ventureStateRevisions);
    await db.delete(ventureConstitutionRevisions);
    await db.delete(approvals);
    await db.delete(issues);
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

  async function seedActiveConstitution(companyId: string) {
    return db
      .insert(ventureConstitutionRevisions)
      .values({
        companyId,
        version: 1,
        status: "active",
        content: constitutionContent(),
        changeReason: "Initial founder contract.",
        sourceRefs: [{ kind: "founder_interview", label: "Founder interview" }],
        createdByUserId: "founder-1",
        activatedByUserId: "founder-1",
        approvalNote: "Approved.",
        activatedAt: new Date("2026-07-31T19:00:00.000Z"),
      })
      .returning()
      .then((rows) => rows[0]!);
  }

  it("requires an active Constitution before canonical state can be created", async () => {
    const companyId = await seedCompany();
    const response = await request(createApp(db, boardActor([companyId])))
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({
        content: stateContent(),
        creationReason: "Initialize the cockpit.",
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain("Activate a Venture Constitution");
  });

  it("rejects secret-bearing founder state before it can be persisted or projected", async () => {
    const companyId = await seedCompany();
    await seedActiveConstitution(companyId);
    const secret = "sk-abcdefghijklmnopqrstuvwxyz123456";
    const unsafeContent = stateContent();
    unsafeContent.ventureSummary = `Accidentally pasted credential: ${secret}`;

    const response = await request(createApp(db, boardActor([companyId])))
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({
        content: unsafeContent,
        creationReason: "Attempt unsafe canonical map.",
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain("$.content.ventureSummary");
    expect(response.body.error).not.toContain(secret);
    expect(await db.select().from(ventureStateRevisions)).toHaveLength(0);
    expect(await db.select().from(ventureContextProjections)).toHaveLength(0);
  });

  it("creates versioned canonical state and a bounded provenance-backed projection", async () => {
    const companyId = await seedCompany();
    const constitution = await seedActiveConstitution(companyId);
    const app = createApp(db, boardActor([companyId]));

    const state = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({
        content: stateContent(),
        sourceRefs: [{ kind: "founder_map", label: "Accepted founder map" }],
        creationReason: "Founder accepted the first structured map.",
      });

    expect(state.status).toBe(201);
    expect(state.body).toMatchObject({
      companyId,
      version: 1,
      status: "current",
      constitutionRevisionId: constitution.id,
      createdByUserId: "founder-1",
    });

    const projection = await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({
        ventureStateRevisionId: state.body.id,
        creationReason: "Prepare bounded context for a guided SIM Cycle.",
      });

    expect(projection.status).toBe(201);
    expect(projection.body).toMatchObject({
      companyId,
      version: 1,
      status: "current",
      constitutionRevisionId: constitution.id,
      ventureStateRevisionId: state.body.id,
      content: {
        purpose: constitutionContent().purpose,
        nonNegotiables: constitutionContent().nonNegotiables,
        approvalBoundaries: constitutionContent().decisionRights.approvalRequired,
        ventureSummary: stateContent().ventureSummary,
        engines: {
          product: { summary: stateContent().engines.product.summary },
        },
      },
    });
    expect(projection.body.content).not.toHaveProperty("riskTolerance");
    expect(projection.body.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "venture_constitution_revision", id: constitution.id }),
        expect.objectContaining({ kind: "venture_state_revision", id: state.body.id }),
        expect.objectContaining({ kind: "founder_map", label: "Accepted founder map" }),
        expect.objectContaining({ kind: "clickup", id: "86eyeztfu" }),
      ]),
    );
  });

  it("supersedes state and projection versions without losing their history", async () => {
    const companyId = await seedCompany();
    await seedActiveConstitution(companyId);
    const app = createApp(db, boardActor([companyId]));

    const firstState = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initial map." });
    const firstProjection = await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ creationReason: "Initial projection." });

    const revisedContent = stateContent("2026-07-31T21:00:00.000Z");
    revisedContent.ventureSummary = "The first founder session produced a clearer constraint.";
    const secondState = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({ content: revisedContent, creationReason: "Refresh after founder evidence." });
    const secondProjection = await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ creationReason: "Refresh delegated context." });

    const states = await request(app).get(`/api/companies/${companyId}/venture-state/revisions`);
    expect(states.body).toEqual([
      expect.objectContaining({ id: secondState.body.id, version: 2, status: "current" }),
      expect.objectContaining({ id: firstState.body.id, version: 1, status: "superseded" }),
    ]);

    const projections = await request(app).get(`/api/companies/${companyId}/context-projections`);
    expect(projections.body).toEqual([
      expect.objectContaining({
        id: secondProjection.body.id,
        version: 2,
        status: "current",
        supersedesProjectionId: firstProjection.body.id,
      }),
      expect.objectContaining({ id: firstProjection.body.id, version: 1, status: "superseded" }),
    ]);

    const coach = await request(app).get(`/api/companies/${companyId}/founder-coach`);
    expect(coach.status).toBe(200);
    expect(coach.body).toMatchObject({
      guidance: {
        headline: revisedContent.activeConstraint?.hypothesis,
        explanation: revisedContent.nextMove?.rationale,
        engine: "customer",
        approvalRequired: true,
        nextAction: {
          title: "Run one founder onboarding session",
          href: "/cockpit",
        },
        stateVersion: 2,
        projectionVersion: 2,
      },
      activeCycle: null,
      latestCycle: null,
    });
    expect(coach.body.guidance.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "venture_state_revision", id: secondState.body.id }),
      ]),
    );
    expect(coach.body.currentMemory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: secondState.body.id,
          kind: "venture_state",
          version: 2,
          status: "current",
        }),
        expect.objectContaining({
          id: secondProjection.body.id,
          kind: "context_projection",
          version: 2,
          status: "current",
        }),
      ]),
    );
    expect(coach.body.supersededMemory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstState.body.id,
          kind: "venture_state",
          version: 1,
          status: "superseded",
        }),
        expect.objectContaining({
          id: firstProjection.body.id,
          kind: "context_projection",
          version: 1,
          status: "superseded",
        }),
      ]),
    );
  });

  it("promotes one founder-approved Coach insight into canonical state and projection history", async () => {
    const companyId = await seedCompany();
    await seedActiveConstitution(companyId);
    const app = createApp(db, boardActor([companyId]));

    const state = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize Coach context." });
    const projection = await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ ventureStateRevisionId: state.body.id, creationReason: "Project Coach context." });
    const insight =
      "Founder activation should be proven with one bounded onboarding session before acquisition expands.";

    const promoted = await request(app)
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: state.body.id,
        expectedContextProjectionId: projection.body.id,
        insight,
      });

    expect(promoted.status).toBe(201);
    expect(promoted.body).toMatchObject({
      created: true,
      state: {
        version: 2,
        status: "current",
        content: { learnings: [insight] },
      },
      contextProjection: {
        version: 2,
        status: "current",
        ventureStateRevisionId: promoted.body.state.id,
        supersedesProjectionId: projection.body.id,
      },
    });
    expect(promoted.body.state.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "venture_state_revision", id: state.body.id }),
        expect.objectContaining({ kind: "venture_context_projection", id: projection.body.id }),
      ]),
    );

    const coach = await request(app).get(`/api/companies/${companyId}/founder-coach`);
    expect(coach.status).toBe(200);
    expect(coach.body.guidance).toMatchObject({
      promotedLearning: insight,
      stateVersion: 2,
      projectionVersion: 2,
    });
    expect(coach.body.currentMemory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: promoted.body.state.id, kind: "venture_state", status: "current" }),
        expect.objectContaining({
          id: promoted.body.contextProjection.id,
          kind: "context_projection",
          status: "current",
        }),
      ]),
    );
    expect(coach.body.supersededMemory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: state.body.id, kind: "venture_state", status: "superseded" }),
        expect.objectContaining({
          id: projection.body.id,
          kind: "context_projection",
          status: "superseded",
        }),
      ]),
    );

    const replay = await request(app)
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: state.body.id,
        expectedContextProjectionId: projection.body.id,
        insight,
      });
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      created: false,
      state: { id: promoted.body.state.id, version: 2 },
      contextProjection: { id: promoted.body.contextProjection.id, version: 2 },
    });

    const stale = await request(app)
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: state.body.id,
        expectedContextProjectionId: projection.body.id,
        insight: "A different stale insight must not overwrite newer founder memory.",
      });
    expect(stale.status).toBe(409);

    const activity = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, "founder_coach.memory_promoted"));
    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      companyId,
      entityType: "venture_state_revision",
      entityId: promoted.body.state.id,
    });
  });

  it("rejects a Coach approval when its projection or Constitution context has changed", async () => {
    const companyId = await seedCompany();
    const constitution = await seedActiveConstitution(companyId);
    const app = createApp(db, boardActor([companyId]));
    const state = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize Coach context." });
    const firstProjection = await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ ventureStateRevisionId: state.body.id, creationReason: "Project Coach context." });
    const refreshedProjection = await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ ventureStateRevisionId: state.body.id, creationReason: "Refresh Coach context." });

    const staleProjection = await request(app)
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: state.body.id,
        expectedContextProjectionId: firstProjection.body.id,
        insight: "Do not approve against a superseded projection.",
      });
    expect(staleProjection.status).toBe(409);

    await db
      .update(ventureConstitutionRevisions)
      .set({
        status: "superseded",
        supersededAt: new Date("2026-08-01T00:05:00.000Z"),
      })
      .where(eq(ventureConstitutionRevisions.id, constitution.id));
    await db.insert(ventureConstitutionRevisions).values({
      companyId,
      version: 2,
      status: "active",
      content: constitutionContent(),
      changeReason: "Tighten founder governance.",
      sourceRefs: [],
      createdByUserId: "founder-1",
      activatedByUserId: "founder-1",
      approvalNote: "Approved.",
      activatedAt: new Date("2026-08-01T00:06:00.000Z"),
    });

    const staleConstitution = await request(app)
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: state.body.id,
        expectedContextProjectionId: refreshedProjection.body.id,
        insight: "Do not silently rebase founder judgment onto new governance.",
      });
    expect(staleConstitution.status).toBe(409);

    const states = await db
      .select()
      .from(ventureStateRevisions)
      .where(eq(ventureStateRevisions.companyId, companyId));
    const promotedActivities = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, "founder_coach.memory_promoted"));
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ id: state.body.id, status: "current" });
    expect(promotedActivities).toHaveLength(0);
  });

  it("does not treat a current state paired with an older projection as an idempotent replay", async () => {
    const companyId = await seedCompany();
    await seedActiveConstitution(companyId);
    const app = createApp(db, boardActor([companyId]));
    const firstState = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize Coach context." });
    const projection = await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ ventureStateRevisionId: firstState.body.id, creationReason: "Project Coach context." });
    const insight = "A current state must never be returned with a projection of older state.";
    const secondState = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({
        content: { ...stateContent(), learnings: [insight] },
        sourceRefs: [
          { kind: "venture_state_revision", id: firstState.body.id, label: "Prior state" },
          { kind: "venture_context_projection", id: projection.body.id, label: "Prior projection" },
        ],
        creationReason: "Create a state without refreshing its projection.",
      });

    const response = await request(app)
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: firstState.body.id,
        expectedContextProjectionId: projection.body.id,
        insight,
      });

    expect(secondState.status).toBe(201);
    expect(response.status).toBe(409);
    const promotedActivities = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.action, "founder_coach.memory_promoted"));
    expect(promotedActivities).toHaveLength(0);
  });

  it("keeps Coach memory promotion scoped to the URL company and expected revisions", async () => {
    const firstCompanyId = await seedCompany("First venture");
    const secondCompanyId = await seedCompany("Second venture");
    await seedActiveConstitution(firstCompanyId);
    await seedActiveConstitution(secondCompanyId);
    const bothCompaniesApp = createApp(db, boardActor([firstCompanyId, secondCompanyId]));
    const firstState = await request(bothCompaniesApp)
      .post(`/api/companies/${firstCompanyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize first venture." });
    const firstProjection = await request(bothCompaniesApp)
      .post(`/api/companies/${firstCompanyId}/context-projections`)
      .send({ ventureStateRevisionId: firstState.body.id, creationReason: "Project first venture." });
    const secondState = await request(bothCompaniesApp)
      .post(`/api/companies/${secondCompanyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize second venture." });
    const secondProjection = await request(bothCompaniesApp)
      .post(`/api/companies/${secondCompanyId}/context-projections`)
      .send({ ventureStateRevisionId: secondState.body.id, creationReason: "Project second venture." });

    const inaccessibleCompany = await request(createApp(db, boardActor([firstCompanyId])))
      .post(`/api/companies/${secondCompanyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: secondState.body.id,
        expectedContextProjectionId: secondProjection.body.id,
        insight: "No cross-company writes.",
      });
    const foreignRevision = await request(bothCompaniesApp)
      .post(`/api/companies/${firstCompanyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: secondState.body.id,
        expectedContextProjectionId: secondProjection.body.id,
        insight: "No foreign revision writes.",
      });

    expect(inaccessibleCompany.status).toBe(403);
    expect(foreignRevision.status).toBe(409);
    const firstCompanyStates = await db
      .select()
      .from(ventureStateRevisions)
      .where(eq(ventureStateRevisions.companyId, firstCompanyId));
    const firstCompanyProjections = await db
      .select()
      .from(ventureContextProjections)
      .where(eq(ventureContextProjections.companyId, firstCompanyId));
    expect(firstCompanyStates).toHaveLength(1);
    expect(firstCompanyStates[0]?.id).toBe(firstState.body.id);
    expect(firstCompanyProjections).toHaveLength(1);
    expect(firstCompanyProjections[0]?.id).toBe(firstProjection.body.id);
  });

  it("denies cross-company reads across the founder state surface", async () => {
    const firstCompanyId = await seedCompany("First venture");
    const secondCompanyId = await seedCompany("Second venture");
    await seedActiveConstitution(secondCompanyId);
    const secondCompanyApp = createApp(db, boardActor([secondCompanyId]));
    const state = await request(secondCompanyApp)
      .post(`/api/companies/${secondCompanyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize second venture." });
    await request(secondCompanyApp)
      .post(`/api/companies/${secondCompanyId}/context-projections`)
      .send({ ventureStateRevisionId: state.body.id, creationReason: "Project second venture." });

    const firstCompanyApp = createApp(db, boardActor([firstCompanyId]));
    for (const path of [
      "founder-cockpit",
      "founder-coach",
      "venture-state/revisions",
      "context-projections",
    ]) {
      const response = await request(firstCompanyApp).get(
        `/api/companies/${secondCompanyId}/${path}`,
      );
      expect(response.status, path).toBe(403);
    }
  });

  it("keeps Coach memory promotion behind the board boundary", async () => {
    const companyId = await seedCompany();
    await seedActiveConstitution(companyId);
    const boardApp = createApp(db, boardActor([companyId]));
    const state = await request(boardApp)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize Coach context." });
    const projection = await request(boardApp)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ ventureStateRevisionId: state.body.id, creationReason: "Project Coach context." });

    const response = await request(createApp(db, agentActor(companyId)))
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: state.body.id,
        expectedContextProjectionId: projection.body.id,
        insight: "An agent must not approve founder memory.",
      });

    expect(response.status).toBe(403);
    const states = await request(boardApp).get(`/api/companies/${companyId}/venture-state/revisions`);
    expect(states.body).toHaveLength(1);
    expect(states.body[0]).toMatchObject({ id: state.body.id, status: "current" });
  });

  it("returns a founder-readable cockpit with governance and work counts", async () => {
    const companyId = await seedCompany();
    await seedActiveConstitution(companyId);
    const app = createApp(db, boardActor([companyId]));

    const state = await request(app)
      .post(`/api/companies/${companyId}/venture-state/revisions`)
      .send({ content: stateContent(), creationReason: "Initialize cockpit state." });
    await request(app)
      .post(`/api/companies/${companyId}/context-projections`)
      .send({ ventureStateRevisionId: state.body.id, creationReason: "Cockpit context." });

    await db.insert(approvals).values({
      companyId,
      type: "request_board_approval",
      status: "pending",
      payload: { reason: "Public commitment" },
    });
    await db.insert(issues).values([
      { companyId, title: "Active task", status: "in_progress", issueNumber: 1, identifier: "SYS-1" },
      { companyId, title: "Blocked task", status: "blocked", issueNumber: 2, identifier: "SYS-2" },
      { companyId, title: "Completed task", status: "done", issueNumber: 3, identifier: "SYS-3" },
    ]);

    const cockpit = await request(app).get(`/api/companies/${companyId}/founder-cockpit`);
    expect(cockpit.status).toBe(200);
    expect(cockpit.body).toMatchObject({
      company: { id: companyId, name: "Sysdom AI" },
      constitution: { version: 1, status: "active" },
      ventureState: { version: 1, status: "current" },
      contextProjection: { version: 1, status: "current" },
      approvals: { pending: 1 },
      work: { active: 1, blocked: 1, completed: 1 },
    });
    expect(cockpit.body.freshness.projectedAt).toEqual(expect.any(String));
    expect(cockpit.body.freshness.sources.length).toBeGreaterThan(0);
  });
});
