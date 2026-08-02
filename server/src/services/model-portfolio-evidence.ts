import {
  modelPortfolioEvidenceRefreshSchema,
  type CreateModelPortfolioRevision,
  type ModelPortfolioEvidenceRefresh,
  type ModelRouteCandidate,
} from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import {
  scoreModelRouteEngineBenchmark,
  type ModelRouteEngineBenchmarkScore,
} from "./model-route-engine-benchmark.js";

export interface ModelPortfolioCandidateReview {
  provider: string;
  model: string;
  lane: ModelRouteCandidate["lane"];
  status: "passed" | "failed" | "missing" | "not_covered";
  score: number | null;
  fixtureIds: string[];
  blockers: string[];
}

export interface ReviewedModelPortfolioRefresh {
  draft: CreateModelPortfolioRevision;
  reviews: ModelPortfolioCandidateReview[];
  unresolvedGaps: string[];
}

function candidateKey(provider: string, model: string) {
  return `${provider.trim().toLowerCase()}/${model.trim().toLowerCase()}`;
}

function outcomeKey(provider: string, model: string, fixtureId: string) {
  return `${candidateKey(provider, model)}/${fixtureId}`;
}

function average(values: number[]) {
  return values.length === 0
    ? null
    : Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export function buildReviewedModelPortfolioRefresh(
  rawInput: ModelPortfolioEvidenceRefresh,
): ReviewedModelPortfolioRefresh {
  const input = modelPortfolioEvidenceRefreshSchema.parse(rawInput);
  const fixtures = new Map(
    input.benchmarkSuite.fixtures.map((fixture) => [fixture.id, fixture]),
  );
  const proposalCandidates = new Map(
    input.proposal.candidates.map((candidate) => [
      candidateKey(candidate.provider, candidate.model),
      candidate,
    ]),
  );
  const scoredOutcomes = new Map<string, ModelRouteEngineBenchmarkScore>();

  for (const outcome of input.outcomes) {
    const candidate = proposalCandidates.get(candidateKey(outcome.provider, outcome.model));
    if (!candidate) {
      throw unprocessable(
        `Benchmark outcome references an unknown candidate: ${outcome.provider}/${outcome.model}`,
      );
    }
    const fixture = fixtures.get(outcome.fixtureId);
    if (!fixture) {
      throw unprocessable(`Benchmark outcome references an unknown fixture: ${outcome.fixtureId}`);
    }
    if (fixture.expected.lane !== candidate.lane) {
      throw unprocessable(
        `Benchmark fixture ${fixture.id} does not evaluate the ${candidate.lane} lane`,
      );
    }
    scoredOutcomes.set(
      outcomeKey(outcome.provider, outcome.model, outcome.fixtureId),
      scoreModelRouteEngineBenchmark(fixture, outcome.output),
    );
  }

  const reviews: ModelPortfolioCandidateReview[] = input.proposal.candidates.map((candidate) => {
    const applicable = input.benchmarkSuite.fixtures.filter(
      (fixture) => fixture.expected.lane === candidate.lane,
    );
    if (applicable.length === 0) {
      return {
        provider: candidate.provider,
        model: candidate.model,
        lane: candidate.lane,
        status: "not_covered",
        score: null,
        fixtureIds: [],
        blockers: ["lane_has_no_engine_fixture"],
      };
    }
    const scores = applicable.map((fixture) =>
      scoredOutcomes.get(outcomeKey(candidate.provider, candidate.model, fixture.id)),
    );
    if (scores.some((score) => !score)) {
      return {
        provider: candidate.provider,
        model: candidate.model,
        lane: candidate.lane,
        status: "missing",
        score: null,
        fixtureIds: applicable.map((fixture) => fixture.id),
        blockers: ["required_fixture_output_missing"],
      };
    }
    const completeScores = scores.filter(
      (score): score is ModelRouteEngineBenchmarkScore => Boolean(score),
    );
    const blockers = [...new Set(completeScores.flatMap((score) => score.blockers))];
    return {
      provider: candidate.provider,
      model: candidate.model,
      lane: candidate.lane,
      status: completeScores.every((score) => score.passed) ? "passed" : "failed",
      score: average(completeScores.map((score) => score.score)),
      fixtureIds: applicable.map((fixture) => fixture.id),
      blockers,
    };
  });

  const reviewsByCandidate = new Map(
    reviews.map((review) => [candidateKey(review.provider, review.model), review]),
  );
  const candidates = input.proposal.candidates.map((candidate) => {
    const review = reviewsByCandidate.get(candidateKey(candidate.provider, candidate.model))!;
    if (review.status !== "passed" && review.status !== "failed") return candidate;
    return {
      ...candidate,
      enabled: review.status === "passed" && candidate.enabled,
      qualityRank: review.score === null ? candidate.qualityRank : 101 - review.score,
      evidence: {
        sourceKind: "benchmark" as const,
        authority: "sysdom_review" as const,
        sourceLabel: input.reviewSource.label,
        sourceUrl: input.reviewSource.url ?? null,
        verifiedAt: input.reviewSource.capturedAt,
        expiresAt: input.reviewExpiresAt,
      },
    };
  });
  const unresolvedGaps = [
    ...input.proposal.unresolvedGaps,
    ...reviews.flatMap((review) => {
      const identity = `${review.provider}/${review.model}`;
      if (review.status === "not_covered") {
        return [`${identity}: no engine fixture currently covers the ${review.lane} lane.`];
      }
      if (review.status === "missing") {
        return [`${identity}: reviewed output is missing for ${review.fixtureIds.join(", ")}.`];
      }
      if (review.status === "failed") {
        return [`${identity}: reviewed output failed (${review.blockers.join(", ") || "score below threshold"}).`];
      }
      return [];
    }),
  ];

  return {
    draft: {
      candidates,
      changeReason: `${input.proposal.changeReason} Review-only evidence refresh; activation remains a separate founder decision.`,
      sourceRefs: [
        ...input.proposal.sourceRefs,
        input.reviewSource,
      ],
    },
    reviews,
    unresolvedGaps,
  };
}
