import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  modelPortfolioResearchProposalSchema,
  modelRouteEngineBenchmarkSuiteSchema,
  type ModelPortfolioEvidenceRefresh,
} from "@paperclipai/shared";
import { buildReviewedModelPortfolioRefresh } from "../services/model-portfolio-evidence.js";
import { modelPortfolioActivationBlockers } from "../services/model-portfolio.js";

const proposal = modelPortfolioResearchProposalSchema.parse(JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-model-portfolio.proposal.v1.json", import.meta.url),
  "utf8",
)));
const suite = modelRouteEngineBenchmarkSuiteSchema.parse(JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-engine-benchmarks.v1.json", import.meta.url),
  "utf8",
)));

function passingOutcomes(): ModelPortfolioEvidenceRefresh["outcomes"] {
  return suite.fixtures
    .filter((fixture) => fixture.expected.lane === "workhorse" || fixture.expected.lane === "frontier")
    .map((fixture) => {
      const candidate = proposal.candidates.find(
        (value) => value.lane === fixture.expected.lane,
      )!;
      return {
        provider: candidate.provider,
        model: candidate.model,
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
    });
}

function refresh(overrides: Record<string, unknown> = {}) {
  return {
    proposal,
    benchmarkSuite: suite,
    outcomes: passingOutcomes(),
    reviewSource: {
      kind: "benchmark" as const,
      label: "Synthetic deterministic engine-fixture review",
      url: "https://example.com/review",
      capturedAt: "2026-08-04T10:00:00.000Z",
    },
    reviewExpiresAt: "2026-08-18T10:00:00.000Z",
    ...overrides,
  };
}

describe("reviewed model portfolio evidence refresh", () => {
  it("adopts passing deterministic outcomes without activating the portfolio", () => {
    const result = buildReviewedModelPortfolioRefresh(refresh());

    expect(result.reviews).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: "openai/gpt-5.6-luna",
        status: "passed",
        score: 100,
      }),
      expect.objectContaining({
        model: "openai/gpt-5.6-terra",
        status: "passed",
        score: 100,
      }),
      expect.objectContaining({
        model: "google/gemini-3.5-flash-lite",
        status: "not_covered",
      }),
      expect.objectContaining({
        model: "anthropic/claude-fable-5",
        status: "not_covered",
      }),
    ]));
    expect(result.draft.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: "openai/gpt-5.6-luna",
        qualityRank: 1,
        costRank: 1,
        latencyRank: 1,
        evidence: expect.objectContaining({
          sourceKind: "benchmark",
          authority: "sysdom_review",
        }),
        evaluation: expect.objectContaining({
          passed: true,
          aggregate: expect.objectContaining({
            qualityScore: 100,
          }),
        }),
      }),
    ]));
    expect(result.unresolvedGaps).toEqual(expect.arrayContaining([
      expect.stringContaining("background lane"),
      expect.stringContaining("deliberation_audit lane"),
    ]));
    expect(result.draft.changeReason).toContain("activation remains a separate founder decision");
  });

  it("disables a candidate when its reviewed output fails", () => {
    const outcomes = passingOutcomes();
    const firstWorkhorse = outcomes.find((outcome) =>
      suite.fixtures.find((fixture) => fixture.id === outcome.fixtureId)?.expected.lane === "workhorse"
    )!;
    firstWorkhorse.output = {
      ...firstWorkhorse.output,
      evidenceRefIds: [],
    };

    const result = buildReviewedModelPortfolioRefresh(refresh({ outcomes }));

    expect(result.reviews).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: "openai/gpt-5.6-luna",
        status: "failed",
        blockers: expect.arrayContaining(["required_evidence_missing"]),
      }),
    ]));
    expect(result.draft.candidates.find(
      (candidate) => candidate.model === "openai/gpt-5.6-luna",
    )?.enabled).toBe(false);
  });

  it("records latency, cost, context, tools, and review disposition as adoption evidence", () => {
    const outcomes = passingOutcomes();
    const workhorseOutcomes = outcomes.filter((outcome) =>
      suite.fixtures.find((fixture) => fixture.id === outcome.fixtureId)?.expected.lane === "workhorse"
    );
    workhorseOutcomes[0]!.observed.reviewOutcome = "needs_revision";

    const result = buildReviewedModelPortfolioRefresh(refresh({ outcomes }));
    const workhorse = result.draft.candidates.find(
      (candidate) => candidate.model === "openai/gpt-5.6-luna",
    )!;

    expect(workhorse.enabled).toBe(false);
    expect(workhorse.evaluation).toMatchObject({
      passed: false,
      aggregate: {
        averageLatencyMs: 1_000,
        totalCostUsd: 0.02,
        totalInputTokens: 4_000,
        totalOutputTokens: 1_000,
        totalToolCalls: 0,
        maxContextTokens: 2_000,
      },
    });
    expect(result.reviews).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: workhorse.model,
        status: "failed",
        blockers: expect.arrayContaining(["review_needs_revision"]),
      }),
    ]));
    expect(modelPortfolioActivationBlockers(
      result.draft.candidates,
      new Date("2026-08-04T10:00:00.000Z"),
    )).toEqual(expect.arrayContaining([
      expect.stringContaining("reviewed_benchmark_not_passed:openrouter/openai/gpt-5.6-luna"),
    ]));
  });

  it("rejects outcomes evaluated against the wrong routing lane", () => {
    const productFixture = suite.fixtures.find((fixture) => fixture.engine === "product")!;
    const workhorse = proposal.candidates.find((candidate) => candidate.lane === "workhorse")!;
    expect(() => buildReviewedModelPortfolioRefresh(refresh({
      outcomes: [{
        provider: workhorse.provider,
        model: workhorse.model,
        fixtureId: productFixture.id,
        output: productFixture.referenceOutput,
        observed: {
          latencyMs: 1_000,
          costUsd: 0.01,
          inputTokens: 1_000,
          outputTokens: 200,
          toolCalls: 0,
          contextTokens: 1_000,
          toolUseSucceeded: true,
          contextHandled: true,
          reviewOutcome: "accepted",
        },
      }],
    }))).toThrow("does not evaluate the workhorse lane");
  });
});
