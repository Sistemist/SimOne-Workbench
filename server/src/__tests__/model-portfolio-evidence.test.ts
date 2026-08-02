import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  modelPortfolioResearchProposalSchema,
  modelRouteEngineBenchmarkSuiteSchema,
} from "@paperclipai/shared";
import { buildReviewedModelPortfolioRefresh } from "../services/model-portfolio-evidence.js";

const proposal = modelPortfolioResearchProposalSchema.parse(JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-model-portfolio.proposal.v1.json", import.meta.url),
  "utf8",
)));
const suite = modelRouteEngineBenchmarkSuiteSchema.parse(JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-engine-benchmarks.v1.json", import.meta.url),
  "utf8",
)));

function passingOutcomes() {
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
      capturedAt: "2026-08-02T10:00:00.000Z",
    },
    reviewExpiresAt: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}

describe("reviewed model portfolio evidence refresh", () => {
  it("adopts passing deterministic outcomes without activating the portfolio", () => {
    const result = buildReviewedModelPortfolioRefresh(refresh());

    expect(result.reviews).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: "google/gemini-3.6-flash",
        status: "passed",
        score: 100,
      }),
      expect.objectContaining({
        model: "openai/gpt-5.6-sol",
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
        model: "google/gemini-3.6-flash",
        qualityRank: 1,
        evidence: expect.objectContaining({
          sourceKind: "benchmark",
          authority: "sysdom_review",
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
        model: "google/gemini-3.6-flash",
        status: "failed",
        blockers: expect.arrayContaining(["required_evidence_missing"]),
      }),
    ]));
    expect(result.draft.candidates.find(
      (candidate) => candidate.model === "google/gemini-3.6-flash",
    )?.enabled).toBe(false);
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
      }],
    }))).toThrow("does not evaluate the workhorse lane");
  });
});
