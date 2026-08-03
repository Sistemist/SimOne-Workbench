import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  agents,
  companies,
  createDb,
  modelPortfolioRevisions,
} from "@paperclipai/db";
import {
  modelPortfolioResearchProposalSchema,
  modelRouteEngineBenchmarkSuiteSchema,
  modelRouteExperimentEvaluationInputSchema,
  type ModelRouteCandidate,
} from "@paperclipai/shared";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { errorHandler } from "../middleware/index.js";
import { modelPortfolioRoutes } from "../routes/model-portfolio.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const researchProposal = modelPortfolioResearchProposalSchema.parse(JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-model-portfolio.proposal.v1.json", import.meta.url),
  "utf8",
)));
const benchmarkSuite = modelRouteEngineBenchmarkSuiteSchema.parse(JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-engine-benchmarks.v1.json", import.meta.url),
  "utf8",
)));
const experimentInput = modelRouteExperimentEvaluationInputSchema.parse(JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-experiment-lanes.v1.json", import.meta.url),
  "utf8",
)));

function evidenceRefreshPayload() {
  return {
    proposal: researchProposal,
    benchmarkSuite,
    outcomes: benchmarkSuite.fixtures
      .filter((fixture) => fixture.expected.lane === "workhorse" || fixture.expected.lane === "frontier")
      .map((fixture) => {
        const reviewedCandidate = researchProposal.candidates.find(
          (value) => value.lane === fixture.expected.lane,
        )!;
        return {
          provider: reviewedCandidate.provider,
          model: reviewedCandidate.model,
          fixtureId: fixture.id,
          output: fixture.referenceOutput,
          observed: {
            latencyMs: fixture.expected.lane === "frontier" ? 4_000 : 1_000,
            costUsd: fixture.expected.lane === "frontier" ? 0.08 : 0.01,
            inputTokens: 2_000,
            outputTokens: 500,
            toolCalls: 0,
            contextTokens: 2_000,
            toolUseSucceeded: true,
            contextHandled: true,
            reviewOutcome: "accepted",
          },
        };
      }),
    reviewSource: {
      kind: "benchmark",
      label: "Synthetic deterministic route evaluation",
      url: "https://example.com/review",
      capturedAt: "2026-08-02T10:00:00.000Z",
    },
    reviewExpiresAt: "2026-08-16T10:00:00.000Z",
  };
}

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres model portfolio tests on this host: ${
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

function createApp(db: ReturnType<typeof createDb>, actor: Express.Request["actor"]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", modelPortfolioRoutes(db));
  app.use(errorHandler);
  return app;
}

function candidate(
  model: string,
  lane: ModelRouteCandidate["lane"] = "workhorse",
): ModelRouteCandidate {
  return {
    provider: "synthetic-provider",
    model,
    lane,
    billingType: "free",
    costRank: 1,
    qualityRank: 1,
    enabled: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsConfidentialData: false,
    supportsRestrictedData: false,
    evidence: {
      sourceKind: "manual_review",
      authority: "sysdom_review",
      sourceLabel: "Synthetic test catalog evidence",
      sourceUrl: "https://example.com/models",
      verifiedAt: "2026-07-31T00:00:00.000Z",
      expiresAt: "2099-08-31T00:00:00.000Z",
    },
  };
}

describeEmbeddedPostgres("model portfolio routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-model-portfolio-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(modelPortfolioRevisions);
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
      issuePrefix: `M${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    return companyId;
  }

  it("keeps an empty draft inactive and fails closed on activation", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));

    expect((await request(app).get(`/api/companies/${companyId}/model-portfolios/active`)).body)
      .toBeNull();

    const created = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions`)
      .send({
        candidates: [],
        changeReason: "Create a review shell before researching exact candidates.",
        sourceRefs: [{
          kind: "founder_decision",
          label: "Founder-approved fail-closed portfolio direction",
          capturedAt: "2026-08-01T00:00:00.000Z",
        }],
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      companyId,
      version: 1,
      status: "draft",
      candidates: [],
      createdByUserId: "founder-1",
    });

    const activation = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions/${created.body.id}/activate`)
      .send({ approvalNote: "Do not activate without candidates." });
    expect(activation.status).toBe(422);
    expect(activation.body.error).toContain("portfolio_has_no_candidates");
    expect(activation.body.error).toContain("portfolio_has_no_enabled_candidates");
    expect((await request(app).get(`/api/companies/${companyId}/model-portfolios/active`)).body)
      .toBeNull();
  });

  it("activates only exact candidates with current provenance", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));
    const created = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions`)
      .send({
        candidates: [
          candidate("synthetic/background-v1", "background"),
          candidate("synthetic/workhorse-v1"),
        ],
        changeReason: "Add reviewed synthetic candidates.",
        sourceRefs: [{
          kind: "manual_review",
          label: "Synthetic candidate review",
          url: "https://example.com/models",
          capturedAt: "2026-08-01T00:00:00.000Z",
        }],
      });

    const activated = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions/${created.body.id}/activate`)
      .send({ approvalNote: "Approve these reviewed synthetic candidates." });

    expect(activated.status).toBe(200);
    expect(activated.body).toMatchObject({
      id: created.body.id,
      version: 1,
      status: "active",
      activatedByUserId: "founder-1",
      candidates: [
        { model: "synthetic/background-v1" },
        { model: "synthetic/workhorse-v1" },
      ],
    });
    expect(activated.body.activatedAt).toEqual(expect.any(String));
    const current = await request(app).get(`/api/companies/${companyId}/model-portfolios/active`);
    expect(current.body).toMatchObject({ id: created.body.id, version: 1, status: "active" });
  });

  it("does not treat provider catalog evidence as reviewed adoption evidence", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));
    const catalogOnly = {
      ...candidate("synthetic/catalog-only"),
      evidence: {
        sourceKind: "provider_api",
        sourceLabel: "Synthetic provider catalog",
        sourceUrl: "https://example.com/catalog",
        verifiedAt: "2026-08-01T00:00:00.000Z",
        expiresAt: "2099-08-15T00:00:00.000Z",
      },
    };
    const created = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions`)
      .send({
        candidates: [catalogOnly],
        changeReason: "Catalog facts alone must not activate a model.",
      });

    const activation = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions/${created.body.id}/activate`)
      .send({ approvalNote: "Attempt activation without quality review." });

    expect(activation.status).toBe(422);
    expect(activation.body.error).toContain(
      "adoption_evidence_not_reviewed:synthetic-provider/synthetic/catalog-only",
    );
  });

  it("creates one review-only evidence draft and never activates it", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));
    const first = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/evidence-refresh`)
      .send(evidenceRefreshPayload());

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      version: "sysdom_model_portfolio_evidence_refresh_v1",
      status: "draft_created",
      reviewRequired: true,
      activationAttempted: false,
      baselineRevision: null,
      draftRevision: {
        version: 1,
        status: "draft",
      },
    });
    expect(first.body.reviews).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: "openai/gpt-5.6-luna",
        status: "passed",
      }),
      expect.objectContaining({
        model: "google/gemini-3.6-flash",
        status: "missing",
      }),
    ]));
    expect(
      (await request(app).get(`/api/companies/${companyId}/model-portfolios/active`)).body,
    ).toBeNull();

    const repeated = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/evidence-refresh`)
      .send(evidenceRefreshPayload());
    expect(repeated.status).toBe(200);
    expect(repeated.body).toMatchObject({
      status: "unchanged",
      reviewRequired: true,
      activationAttempted: false,
      baselineRevision: { version: 1, status: "draft" },
      draftRevision: null,
    });
    const revisions = await request(app).get(
      `/api/companies/${companyId}/model-portfolios/revisions`,
    );
    expect(revisions.body).toHaveLength(1);
  });

  it("evaluates synthetic experiment lanes without dispatching or granting adoption authority", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));

    const response = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/experiment-evaluations`)
      .send(experimentInput);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      version: "sysdom_model_route_experiment_evaluation_v1",
      evidenceClass: "synthetic_fixture",
      status: "passed",
      reviewRequired: true,
      eligibleForAdoption: false,
      activationAttempted: false,
      providerDispatchAttempted: false,
      aggregate: {
        comparisonCount: 2,
        blockedCount: 0,
        simulationPassCount: 2,
        challengerNominationCount: 0,
      },
    });
    expect(
      (await request(app).get(`/api/companies/${companyId}/model-portfolios/active`)).body,
    ).toBeNull();

    const activities = await db.select().from(activityLog);
    expect(activities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        companyId,
        action: "model_portfolio.experiment_evaluated",
        entityType: "model_route_experiment",
        details: expect.objectContaining({
          evidenceClass: "synthetic_fixture",
          status: "passed",
          challengerNominationCount: 0,
          eligibleForAdoption: false,
          activationAttempted: false,
          providerDispatchAttempted: false,
        }),
      }),
    ]));
  });

  it("keeps experiment evaluation board-only", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, {
      type: "agent",
      agentId: randomUUID(),
      companyId,
      runId: randomUUID(),
    });

    const response = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/experiment-evaluations`)
      .send(experimentInput);

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("Board access required");
    expect(await db.select().from(activityLog)).toEqual([]);
  });

  it("blocks placeholder identities, unknown billing, duplicates, and stale evidence", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));
    const unsafeCandidate = {
      ...candidate("auto"),
      billingType: "unknown",
      evidence: {
        sourceKind: "provider_docs",
        sourceLabel: "Expired synthetic catalog",
        sourceUrl: "https://example.com/expired",
        verifiedAt: "2026-06-01T00:00:00.000Z",
        expiresAt: "2026-07-01T00:00:00.000Z",
      },
    };
    const created = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions`)
      .send({
        candidates: [unsafeCandidate, unsafeCandidate],
        changeReason: "Exercise fail-closed activation validation.",
      });
    expect(created.status).toBe(201);

    const activation = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions/${created.body.id}/activate`)
      .send({ approvalNote: "This unsafe draft must not activate." });
    expect(activation.status).toBe(422);
    expect(activation.body.error).toContain("model_not_exact");
    expect(activation.body.error).toContain("billing_unknown");
    expect(activation.body.error).toContain("duplicate_candidate");
    expect(activation.body.error).toContain("evidence_stale");
  });

  it("preserves superseded history and restores an old portfolio into a new draft", async () => {
    const companyId = await seedCompany();
    const app = createApp(db, boardActor([companyId]));

    const first = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions`)
      .send({
        candidates: [candidate("synthetic/workhorse-v1")],
        changeReason: "First portfolio.",
      });
    await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions/${first.body.id}/activate`)
      .send({ approvalNote: "Approve v1." });

    const second = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions`)
      .send({
        candidates: [candidate("synthetic/workhorse-v2")],
        changeReason: "Reviewed replacement.",
      });
    await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions/${second.body.id}/activate`)
      .send({ approvalNote: "Approve v2." });

    const revisions = await request(app).get(
      `/api/companies/${companyId}/model-portfolios/revisions`,
    );
    expect(revisions.body).toHaveLength(2);
    expect(revisions.body[0]).toMatchObject({ version: 2, status: "active" });
    expect(revisions.body[1]).toMatchObject({ version: 1, status: "superseded" });

    const restored = await request(app)
      .post(`/api/companies/${companyId}/model-portfolios/revisions/${first.body.id}/restore`)
      .send({ changeReason: "Restore v1 candidates for renewed review." });
    expect(restored.status).toBe(201);
    expect(restored.body).toMatchObject({
      version: 3,
      status: "draft",
      restoredFromRevisionId: first.body.id,
      candidates: [{ model: "synthetic/workhorse-v1" }],
    });
  });

  it("does not expose or activate portfolios across companies", async () => {
    const companyId = await seedCompany();
    const otherCompanyId = await seedCompany("Other venture");
    const ownerApp = createApp(db, boardActor([companyId]));
    const otherApp = createApp(db, boardActor([otherCompanyId]));
    const created = await request(ownerApp)
      .post(`/api/companies/${companyId}/model-portfolios/revisions`)
      .send({
        candidates: [candidate("synthetic/private-v1")],
        changeReason: "Company-private portfolio.",
      });

    expect(
      (await request(otherApp).get(`/api/companies/${companyId}/model-portfolios/revisions`))
        .status,
    ).toBe(403);
    const activation = await request(otherApp)
      .post(`/api/companies/${otherCompanyId}/model-portfolios/revisions/${created.body.id}/activate`)
      .send({ approvalNote: "Attempt cross-company activation." });
    expect(activation.status).toBe(404);
  });
});
