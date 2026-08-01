import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  modelRouteEngineBenchmarkSuiteSchema,
  type ModelRouteCandidate,
} from "@paperclipai/shared";
import { recommendModelRoute } from "../services/model-route-recommendation.js";
import { scoreModelRouteEngineBenchmark } from "../services/model-route-engine-benchmark.js";

const benchmarkPath = new URL(
  "../../../evals/fixtures/sysdom-engine-benchmarks.v1.json",
  import.meta.url,
);
const suite = modelRouteEngineBenchmarkSuiteSchema.parse(
  JSON.parse(await readFile(benchmarkPath, "utf8")),
);

function candidateForLane(lane: ModelRouteCandidate["lane"]): ModelRouteCandidate {
  return {
    provider: "synthetic-provider",
    model: `synthetic/${lane}-v1`,
    lane,
    billingType: "free",
    costRank: 1,
    qualityRank: 1,
    enabled: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsConfidentialData: true,
    supportsRestrictedData: false,
    evidence: {
      sourceKind: "benchmark",
      sourceLabel: "Synthetic benchmark candidate",
      sourceUrl: null,
      verifiedAt: "2026-07-31T00:00:00.000Z",
      expiresAt: "2026-08-31T00:00:00.000Z",
    },
  };
}

describe("Sysdom four-engine routing benchmarks", () => {
  it("contains exactly one valid fictional workflow per SIM engine", () => {
    expect(suite.fixtures.map((fixture) => fixture.engine).sort()).toEqual([
      "cash",
      "customer",
      "product",
      "skills",
    ]);
    expect(suite.fixtures.every((fixture) => fixture.evidence.length > 0)).toBe(true);
  });

  it.each(suite.fixtures)("$engine fixture preserves the expected deterministic route", (fixture) => {
    const candidates = fixture.expected.lane === "no_model"
      ? []
      : [candidateForLane(fixture.expected.lane)];
    const recommendation = recommendModelRoute({
      policyVersion: "sysdom-auto-alpha-1",
      evaluatedAt: "2026-08-01T00:00:00.000Z",
      posture: "balanced",
      portfolio: {
        revisionId: "11111111-1111-4111-8111-111111111111",
        version: 1,
      },
      task: {
        ...fixture.routingTask,
        requiresTools: false,
        requiresStructuredOutput: true,
      },
      simContext: {
        projectionId: "22222222-2222-4222-8222-222222222222",
        projectionVersion: 1,
        constitutionRevisionId: "33333333-3333-4333-8333-333333333333",
        activeEngine: fixture.engine,
        activeConstraintDecision: "accepted",
        nextMoveApprovalRequired: fixture.routingTask.approvalRequired,
        approvalBoundaries: [],
      },
      candidates,
    });

    expect(recommendation.lane).toBe(fixture.expected.lane);
    expect(recommendation.approvalGate).toBe(fixture.expected.approvalGate);
    expect(recommendation.status).toBe(
      fixture.expected.lane === "no_model" ? "no_model" : "ready",
    );
  });

  it.each(suite.fixtures)("$engine reference output passes the deterministic quality rubric", (fixture) => {
    const result = scoreModelRouteEngineBenchmark(fixture, fixture.referenceOutput);
    expect(result).toMatchObject({
      score: 100,
      passed: true,
      blockers: [],
    });
  });

  it.each(suite.fixtures)("$engine unsafe unsupported output fails closed", (fixture) => {
    const result = scoreModelRouteEngineBenchmark(fixture, {
      summary: "Confident result with no supporting evidence.",
      nextMove: fixture.expected.forbiddenActionTerms[0] ?? "Act without review.",
      evidenceRefIds: [],
      approvalRequired: !fixture.expected.outputApprovalRequired,
      proposedActions: [fixture.expected.forbiddenActionTerms[0] ?? "Act without review."],
      numericFacts: {},
    });
    expect(result.passed).toBe(false);
    expect(result.blockers).toContain("required_evidence_missing");
    expect(result.blockers).toContain("approval_boundary_mismatch");
  });
});
