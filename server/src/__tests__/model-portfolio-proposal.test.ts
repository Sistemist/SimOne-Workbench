import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  modelPortfolioResearchProposalSchema,
  modelRouteEngineBenchmarkSuiteSchema,
  type ModelRouteRecommendationInput,
} from "@paperclipai/shared";
import {
  estimateModelCandidateTextCostUsd,
  modelPortfolioActivationBlockers,
} from "../services/model-portfolio.js";
import { recommendModelRoute } from "../services/model-route-recommendation.js";

const proposalPath = new URL(
  "../../../evals/fixtures/sysdom-model-portfolio.proposal.v1.json",
  import.meta.url,
);
const engineBenchmarkPath = new URL(
  "../../../evals/fixtures/sysdom-engine-benchmarks.v1.json",
  import.meta.url,
);
const proposal = modelPortfolioResearchProposalSchema.parse(
  JSON.parse(await readFile(proposalPath, "utf8")),
);
const engineBenchmarks = modelRouteEngineBenchmarkSuiteSchema.parse(
  JSON.parse(await readFile(engineBenchmarkPath, "utf8")),
);

function recommendationInput(
  task: ModelRouteRecommendationInput["task"],
): ModelRouteRecommendationInput {
  return {
    policyVersion: "sysdom-auto-alpha-1",
    evaluatedAt: proposal.researchedAt,
    posture: "balanced",
    portfolio: {
      revisionId: "55555555-5555-4555-8555-555555555555",
      version: 1,
    },
    task,
    simContext: {
      projectionId: "22222222-2222-4222-8222-222222222222",
      projectionVersion: 1,
      constitutionRevisionId: "33333333-3333-4333-8333-333333333333",
      activeEngine: "product",
      activeConstraintDecision: "accepted",
      nextMoveApprovalRequired: task.approvalRequired,
      approvalBoundaries: [],
    },
    candidates: proposal.candidates,
  };
}

describe("Sysdom first exact-model portfolio proposal", () => {
  it("is review-only, fresh, exact, and activation-safe without becoming active", () => {
    expect(proposal.status).toBe("review_required");
    expect(proposal.candidates.map((candidate) => `${candidate.lane}:${candidate.model}`))
      .toEqual([
        "background:google/gemini-3.5-flash-lite",
        "workhorse:google/gemini-3.6-flash",
        "frontier:openai/gpt-5.6-sol",
        "deliberation_audit:anthropic/claude-fable-5",
      ]);
    expect(modelPortfolioActivationBlockers(
      proposal.candidates,
      new Date(proposal.researchedAt),
    )).toEqual([]);
    expect(proposal.unresolvedGaps).toEqual(expect.arrayContaining([
      expect.stringContaining("No candidate has produced output-quality"),
      expect.stringContaining("confidential and restricted context remain disabled"),
    ]));
  });

  it("records bounded comparable text-cost estimates without making model calls", () => {
    const estimates = Object.fromEntries(proposal.candidates.map((candidate) => [
      candidate.lane,
      estimateModelCandidateTextCostUsd(candidate, {
        inputTokens: 100_000,
        outputTokens: 10_000,
      }),
    ]));
    expect(estimates).toEqual({
      background: 0.055,
      workhorse: 0.225,
      frontier: 0.8,
      deliberation_audit: 1.5,
    });
  });

  it("blocks metered drafts when pricing or provider controls are weakened", () => {
    const withoutCatalog = {
      ...proposal.candidates[0]!,
      model: "google/ungoverned-model",
      catalog: null,
    };
    const weakenedControls = {
      ...proposal.candidates[1]!,
      model: "google/weakened-controls",
      supportsConfidentialData: true,
      catalog: {
        ...proposal.candidates[1]!.catalog!,
        providerRouting: {
          ...proposal.candidates[1]!.catalog!.providerRouting,
          dataCollection: "allow" as const,
          requireParameters: false,
          zeroDataRetention: false,
          maxInputUsdPerMillion: 0,
          maxOutputUsdPerMillion: 0,
        },
      },
    };
    const blockers = modelPortfolioActivationBlockers(
      [withoutCatalog, weakenedControls],
      new Date(proposal.researchedAt),
    );
    expect(blockers).toEqual(expect.arrayContaining([
      expect.stringContaining("catalog_missing:"),
      expect.stringContaining("data_collection_not_denied:"),
      expect.stringContaining("required_parameters_not_enforced:"),
      expect.stringContaining("price_cap_below_catalog_rate:"),
      expect.stringContaining("confidential_route_without_zdr:"),
    ]));
  });

  it.each(engineBenchmarks.fixtures)(
    "$engine fixture selects the proposed exact candidate or no model",
    (fixture) => {
      const recommendation = recommendModelRoute(recommendationInput({
        ...fixture.routingTask,
        requiresTools: false,
        requiresStructuredOutput: true,
      }));
      expect(recommendation.lane).toBe(fixture.expected.lane);
      expect(recommendation.approvalGate).toBe(fixture.expected.approvalGate);
      if (fixture.expected.lane === "no_model") {
        expect(recommendation).toMatchObject({
          status: "no_model",
          selectedCandidate: null,
        });
      } else {
        expect(recommendation).toMatchObject({
          status: "ready",
          selectedCandidate: {
            provider: "openrouter",
            lane: fixture.expected.lane,
          },
        });
      }
    },
  );

  it("covers low-risk background and independent-review escalation explicitly", () => {
    const background = recommendModelRoute(recommendationInput({
      intent: "Classify a public low-risk note.",
      taskClass: "triage",
      criticality: "low",
      reversible: true,
      externalEffects: [],
      dataSensitivity: "public",
      evidenceRequirement: "none",
      requiresTools: false,
      requiresStructuredOutput: true,
      approvalRequired: false,
    }));
    expect(background).toMatchObject({
      lane: "background",
      status: "ready",
      selectedCandidate: { model: "google/gemini-3.5-flash-lite" },
    });

    const audit = recommendModelRoute(recommendationInput({
      intent: "Independently review an irreversible public commitment.",
      taskClass: "strategy",
      criticality: "high",
      reversible: false,
      externalEffects: ["public"],
      dataSensitivity: "internal",
      evidenceRequirement: "independent_review",
      requiresTools: true,
      requiresStructuredOutput: true,
      approvalRequired: true,
    }));
    expect(audit).toMatchObject({
      lane: "deliberation_audit",
      status: "ready",
      selectedCandidate: { model: "anthropic/claude-fable-5" },
      approvalGate: "founder_approval_before_external_effect",
    });
  });

  it("fails closed for confidential model work until execution privacy is enforced", () => {
    const recommendation = recommendModelRoute(recommendationInput({
      intent: "Interpret confidential customer evidence.",
      taskClass: "analysis",
      criticality: "medium",
      reversible: true,
      externalEffects: [],
      dataSensitivity: "confidential",
      evidenceRequirement: "provenance_required",
      requiresTools: false,
      requiresStructuredOutput: true,
      approvalRequired: false,
    }));
    expect(recommendation).toMatchObject({
      lane: "frontier",
      status: "blocked",
      selectedCandidate: null,
    });
    expect(recommendation.candidateAssessments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        model: "openai/gpt-5.6-sol",
        reason: "Candidate is not approved for confidential venture context.",
      }),
    ]));
  });
});
