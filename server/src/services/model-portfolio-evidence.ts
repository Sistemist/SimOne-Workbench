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
  averageLatencyMs: number | null;
  totalCostUsd: number | null;
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
  const scoredOutcomes = new Map<string, {
    score: ModelRouteEngineBenchmarkScore;
    observed: ModelPortfolioEvidenceRefresh["outcomes"][number]["observed"];
  }>();

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
      {
        score: scoreModelRouteEngineBenchmark(fixture, outcome.output),
        observed: outcome.observed,
      },
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
        averageLatencyMs: null,
        totalCostUsd: null,
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
        averageLatencyMs: null,
        totalCostUsd: null,
        fixtureIds: applicable.map((fixture) => fixture.id),
        blockers: ["required_fixture_output_missing"],
      };
    }
    const completeScores = scores.filter(
      (score): score is NonNullable<typeof score> => Boolean(score),
    );
    const blockers = [...new Set([
      ...completeScores.flatMap((outcome) => outcome.score.blockers),
      ...completeScores.flatMap((outcome) => [
        ...(!outcome.observed.toolUseSucceeded ? ["tool_use_failed"] : []),
        ...(!outcome.observed.contextHandled ? ["context_handling_failed"] : []),
        ...(outcome.observed.reviewOutcome === "needs_revision"
          ? ["review_needs_revision"]
          : outcome.observed.reviewOutcome === "rejected"
            ? ["review_rejected"]
            : []),
      ]),
    ])];
    return {
      provider: candidate.provider,
      model: candidate.model,
      lane: candidate.lane,
      status: completeScores.every((outcome) => outcome.score.passed)
        && blockers.length === 0
        ? "passed"
        : "failed",
      score: average(completeScores.map((outcome) => outcome.score.score)),
      averageLatencyMs: average(completeScores.map((outcome) => outcome.observed.latencyMs)),
      totalCostUsd: completeScores.reduce(
        (total, outcome) => total + outcome.observed.costUsd,
        0,
      ),
      fixtureIds: applicable.map((fixture) => fixture.id),
      blockers,
    };
  });

  const reviewsByCandidate = new Map(
    reviews.map((review) => [candidateKey(review.provider, review.model), review]),
  );
  function reviewedRank(
    review: ModelPortfolioCandidateReview,
    metric: "score" | "averageLatencyMs" | "totalCostUsd",
    descending: boolean,
  ) {
    const peers = reviews
      .filter((candidate) =>
        candidate.lane === review.lane
        && (candidate.status === "passed" || candidate.status === "failed")
        && candidate[metric] !== null
      )
      .sort((left, right) => {
        const delta = (left[metric] ?? 0) - (right[metric] ?? 0);
        return descending ? -delta : delta;
      });
    const index = peers.findIndex((candidate) =>
      candidate.provider === review.provider && candidate.model === review.model
    );
    return index >= 0 ? index + 1 : 1;
  }
  const candidates = input.proposal.candidates.map((candidate) => {
    const review = reviewsByCandidate.get(candidateKey(candidate.provider, candidate.model))!;
    if (review.status !== "passed" && review.status !== "failed") return candidate;
    const results = input.outcomes
      .filter((outcome) =>
        candidateKey(outcome.provider, outcome.model)
        === candidateKey(candidate.provider, candidate.model)
      )
      .map((outcome) => {
        const score = scoredOutcomes.get(
          outcomeKey(outcome.provider, outcome.model, outcome.fixtureId),
        )!.score;
        return {
          fixtureId: outcome.fixtureId,
          score: score.score,
          passed: score.passed
            && outcome.observed.toolUseSucceeded
            && outcome.observed.contextHandled
            && outcome.observed.reviewOutcome === "accepted",
          ...outcome.observed,
        };
      });
    return {
      ...candidate,
      enabled: review.status === "passed" && candidate.enabled,
      qualityRank: reviewedRank(review, "score", true),
      costRank: reviewedRank(review, "totalCostUsd", false),
      latencyRank: reviewedRank(review, "averageLatencyMs", false),
      evidence: {
        sourceKind: "benchmark" as const,
        authority: "sysdom_review" as const,
        sourceLabel: input.reviewSource.label,
        sourceUrl: input.reviewSource.url ?? null,
        verifiedAt: input.reviewSource.capturedAt,
        expiresAt: input.reviewExpiresAt,
      },
      evaluation: {
        version: "sysdom_model_candidate_evaluation_v1" as const,
        suiteVersion: input.benchmarkSuite.version,
        reviewedAt: input.reviewSource.capturedAt,
        passed: review.status === "passed",
        fixtureResults: results,
        aggregate: {
          qualityScore: review.score ?? 0,
          averageLatencyMs: review.averageLatencyMs ?? 0,
          totalCostUsd: review.totalCostUsd ?? 0,
          totalInputTokens: results.reduce((total, result) => total + result.inputTokens, 0),
          totalOutputTokens: results.reduce((total, result) => total + result.outputTokens, 0),
          totalToolCalls: results.reduce((total, result) => total + result.toolCalls, 0),
          maxContextTokens: Math.max(0, ...results.map((result) => result.contextTokens)),
        },
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
