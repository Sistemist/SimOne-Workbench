import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  companies,
  createDb,
  issues,
  simCycleEvents,
  simCycles,
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
import { simCycleRoutes } from "../routes/sim-cycles.js";
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

function createApp(db: ReturnType<typeof createDb>, actor: Express.Request["actor"]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", simCycleRoutes(db));
  app.use("/api", ventureOperatingStateRoutes(db));
  app.use(errorHandler);
  return app;
}

function constitutionContent(): VentureConstitutionContent {
  return {
    purpose: "Keep the founder in control of a coherent venture loop.",
    intendedImpact: "Useful ventures with human judgment intact.",
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

function mapContent(now = "2026-07-31T20:00:00.000Z"): VentureStateContent {
  const engine = (summary: string, label: string) => ({
    summary,
    evidence: [{ kind: "founder_map", label, capturedAt: now }],
    freshness: now,
  });
  return {
    ventureSummary: "Sysdom AI is preparing a controlled founder cohort.",
    engines: {
      product: engine("Founder Cockpit is the next product proof.", "Product map"),
      customer: engine("Founder cohort recruitment has not started.", "Customer map"),
      cash: engine("No paid-model spend is authorized.", "Cash map"),
      skills: engine("Core control-plane capability is present.", "Skills map"),
    },
    activeConstraint: null,
    nextMove: null,
    learnings: [],
    refreshedAt: now,
  };
}

describeEmbeddedPostgres("guided SIM Cycle routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-guided-sim-cycle-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(issues);
    await db.delete(simCycleEvents);
    await db.delete(simCycles);
    await db.delete(ventureContextProjections);
    await db.delete(ventureStateRevisions);
    await db.delete(ventureConstitutionRevisions);
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

  it("requires an active Constitution and prevents concurrent open cycles", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));

    const blocked = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles`)
      .send({ startReason: "Run the founder loop." });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error).toContain("Activate a Venture Constitution");

    await seedActiveConstitution(companyId);
    const started = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles`)
      .send({ startReason: "Run the founder loop." });
    expect(started.status).toBe(201);
    expect(started.body).toMatchObject({ status: "active", phase: "map" });

    const duplicate = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles`)
      .send({ startReason: "Start another loop." });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toContain("open SIM Cycle");
  });

  it("runs MAP → DIAGNOSE → LEVERAGE → COMPOUND with pause/resume and promoted learning", async () => {
    const companyId = await seedCompany();
    const constitution = await seedActiveConstitution(companyId);
    const app = createApp(db, boardActor([companyId]));

    const started = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles`)
      .send({ startReason: "Test the full founder-triggered loop before cohort expansion." });
    const cycleId = started.body.id as string;
    expect(started.body.constitutionRevisionId).toBe(constitution.id);

    const paused = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/pause`)
      .send({ reason: "Pause while the founder gathers map evidence." });
    expect(paused.body).toMatchObject({ status: "paused", phase: "map" });

    const blockedMap = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/map`)
      .send({ content: mapContent(), sourceRefs: [] });
    expect(blockedMap.status).toBe(409);
    expect(blockedMap.body.error).toContain("Resume");

    const resumed = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/resume`);
    expect(resumed.body).toMatchObject({ status: "active", phase: "map" });

    const mapped = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/map`)
      .send({
        content: mapContent(),
        sourceRefs: [{ kind: "founder_session", label: "Founder MAP session" }],
      });
    expect(mapped.body).toMatchObject({
      status: "active",
      phase: "diagnose",
      mapOutput: { ventureStateRevisionId: expect.any(String) },
      contextProjectionId: expect.any(String),
    });

    const rejected = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/diagnose`)
      .send({
        engine: "product",
        hypothesis: "The product surface is the only constraint.",
        confidence: "low",
        evidence: [{ kind: "founder_review", label: "Founder review rejected product-only framing" }],
        decision: "rejected",
        decisionNote: "This ignores the missing founder cohort evidence.",
      });
    expect(rejected.body).toMatchObject({
      phase: "diagnose",
      diagnoseOutput: {
        constraint: { engine: "product", decision: "rejected" },
        approvedByUserId: null,
      },
    });

    const diagnosed = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/diagnose`)
      .send({
        engine: "customer",
        hypothesis: "Recruiting and learning from the first founder cohort is the current bottleneck.",
        confidence: "medium",
        evidence: [{ kind: "clickup", id: "86eyeztfu", label: "Scanner and cohort outcome" }],
        decision: "accepted",
        decisionNote: "Founder accepts this as the constraint for the first controlled cycle.",
      });
    expect(diagnosed.body).toMatchObject({
      phase: "leverage",
      diagnoseOutput: {
        constraint: { engine: "customer", decision: "accepted" },
        approvedByUserId: "founder-1",
      },
    });

    const leveraged = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/leverage`)
      .send({
        title: "Run one founder onboarding session",
        rationale: "Test the controlled loop before increasing acquisition.",
        engine: "customer",
        successSignal: "One founder completes the cycle and gives specific usability feedback.",
        approvalRequired: true,
        evidence: [{ kind: "clickup", id: "86eyfyt44", label: "Guided SIM Cycle outcome" }],
        commitmentNote: "Founder approves this bounded intervention only.",
      });
    expect(leveraged.body).toMatchObject({
      phase: "compound",
      leverageOutput: {
        intervention: {
          title: "Run one founder onboarding session",
          approvalRequired: true,
        },
        committedByUserId: "founder-1",
      },
      contextProjectionId: expect.any(String),
    });
    const consumedProjectionId = leveraged.body.contextProjectionId;

    const delegated = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/delegate-intervention`)
      .send({});
    expect(delegated.status).toBe(201);
    expect(delegated.body).toMatchObject({
      created: true,
      issue: {
        title: "Run one founder onboarding session",
        status: "backlog",
        assigneeAgentId: null,
        assigneeUserId: null,
        originKind: "sim_cycle_intervention",
        originId: cycleId,
        ventureContextProjectionId: consumedProjectionId,
      },
      contextProjection: {
        id: consumedProjectionId,
        version: expect.any(Number),
      },
    });
    const delegatedAgain = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/delegate-intervention`)
      .send({});
    expect(delegatedAgain.status).toBe(200);
    expect(delegatedAgain.body).toMatchObject({
      created: false,
      issue: { id: delegated.body.issue.id },
      contextProjection: { id: consumedProjectionId },
    });

    const completed = await request(app)
      .post(`/api/companies/${companyId}/sim-cycles/${cycleId}/compound`)
      .send({
        outcome: "The founder completed the path but needed clearer evidence prompts.",
        evidence: [
          {
            kind: "founder_session",
            id: "session-1",
            label: "Controlled founder session notes",
            capturedAt: "2026-07-31T22:00:00.000Z",
          },
        ],
        learning: "Ask for evidence examples inside each engine field before diagnosis.",
        nextMove: {
          title: "Add evidence examples to MAP prompts",
          rationale: "Reduce ambiguity observed in the first founder session.",
          engine: "product",
          approvalRequired: false,
        },
      });
    expect(completed.body).toMatchObject({
      status: "completed",
      phase: "complete",
      contextProjectionId: consumedProjectionId,
      compoundOutput: {
        outcome: "The founder completed the path but needed clearer evidence prompts.",
        learning: "Ask for evidence examples inside each engine field before diagnosis.",
        promotedStateRevisionId: expect.any(String),
      },
    });

    const currentState = await db
      .select()
      .from(ventureStateRevisions)
      .where(eq(ventureStateRevisions.status, "current"))
      .then((rows) => rows[0]!);
    expect(currentState.content.learnings).toContain(
      "Ask for evidence examples inside each engine field before diagnosis.",
    );
    expect(currentState.content.nextMove).toMatchObject({
      title: "Add evidence examples to MAP prompts",
      engine: "product",
    });
    expect(currentState.basedOnCycleId).toBe(cycleId);

    const consumedProjection = await db
      .select()
      .from(ventureContextProjections)
      .where(eq(ventureContextProjections.id, consumedProjectionId))
      .then((rows) => rows[0]!);
    expect(consumedProjection.status).toBe("superseded");
    expect(consumedProjection.content).toMatchObject({
      activeConstraint: { decision: "accepted", engine: "customer" },
      nextMove: { title: "Run one founder onboarding session" },
    });

    const events = await request(app).get(
      `/api/companies/${companyId}/sim-cycles/${cycleId}/events`,
    );
    expect(events.body.map((event: { type: string }) => event.type)).toEqual([
      "cycle_started",
      "cycle_paused",
      "cycle_resumed",
      "map_completed",
      "diagnosis_rejected",
      "diagnosis_accepted",
      "intervention_committed",
      "intervention_delegated",
      "learning_promoted",
      "cycle_completed",
    ]);
    expect(events.body.at(-1).payload).toMatchObject({
      consumedContextProjectionId: consumedProjectionId,
      promotedStateRevisionId: currentState.id,
    });

    const active = await request(app).get(`/api/companies/${companyId}/sim-cycles/active`);
    expect(active.body).toBeNull();

    const coachAfterCycle = await request(app).get(`/api/companies/${companyId}/founder-coach`);
    expect(coachAfterCycle.body.guidance.promotedLearning).toBe(
      "Ask for evidence examples inside each engine field before diagnosis.",
    );
    const currentProjectionId = coachAfterCycle.body.currentMemory.find(
      (entry: { kind: string }) => entry.kind === "context_projection",
    )?.id as string;
    const coachInsight =
      "Keep the founder's next action visible when the completed cycle hands off to Coach.";
    const promoted = await request(app)
      .post(`/api/companies/${companyId}/founder-coach/memory-promotions`)
      .send({
        expectedStateRevisionId: currentState.id,
        expectedContextProjectionId: currentProjectionId,
        insight: coachInsight,
      });
    expect(promoted.status).toBe(201);

    const coachAfterPromotion = await request(app).get(
      `/api/companies/${companyId}/founder-coach`,
    );
    expect(coachAfterPromotion.body.guidance.promotedLearning).toBe(coachInsight);
    expect(coachAfterPromotion.body.guidance.stateVersion).toBe(currentState.version + 1);
  });

  it("enforces company access on the entire cycle path", async () => {
    const companyId = await seedCompany();
    const otherCompanyId = await seedCompany("Other venture");
    await seedActiveConstitution(companyId);
    const ownerApp = createApp(db, boardActor([companyId]));
    const otherApp = createApp(db, boardActor([otherCompanyId]));

    const started = await request(ownerApp)
      .post(`/api/companies/${companyId}/sim-cycles`)
      .send({ startReason: "Owner cycle." });

    const response = await request(otherApp)
      .post(`/api/companies/${companyId}/sim-cycles/${started.body.id}/pause`)
      .send({ reason: "Cross-company attempt." });
    expect(response.status).toBe(403);
  });
});
