import { describe, expect, it } from "vitest";
import type {
  ModelRouteCandidate,
  ModelRouteRecommendationInput,
} from "@paperclipai/shared";
import { recommendModelRoute } from "../services/model-route-recommendation.js";

function candidate(
  overrides: Partial<ModelRouteCandidate> = {},
): ModelRouteCandidate {
  return {
    provider: "openrouter",
    model: "vendor/workhorse-v1",
    lane: "workhorse",
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
      sourceLabel: "Synthetic unit-test catalog evidence",
      sourceUrl: null,
      verifiedAt: "2026-07-31T00:00:00.000Z",
      expiresAt: "2026-08-31T00:00:00.000Z",
    },
    ...overrides,
  };
}

function input(
  overrides: Partial<ModelRouteRecommendationInput> = {},
): ModelRouteRecommendationInput {
  return {
    policyVersion: "sysdom-auto-alpha-1",
    evaluatedAt: "2026-08-01T00:00:00.000Z",
    posture: "balanced",
    portfolio: {
      revisionId: "33333333-3333-4333-8333-333333333333",
      version: 2,
    },
    task: {
      intent: "Synthesize founder evidence into one bounded next move.",
      taskClass: "analysis",
      criticality: "medium",
      reversible: true,
      externalEffects: [],
      dataSensitivity: "internal",
      evidenceRequirement: "provenance_required",
      requiresTools: false,
      requiresStructuredOutput: true,
      approvalRequired: false,
    },
    simContext: {
      projectionId: "11111111-1111-4111-8111-111111111111",
      projectionVersion: 4,
      constitutionRevisionId: "22222222-2222-4222-8222-222222222222",
      activeEngine: "customer",
      activeConstraintDecision: "accepted",
      nextMoveApprovalRequired: false,
      approvalBoundaries: ["Founder approval is required before customer outreach."],
    },
    candidates: [candidate()],
    ...overrides,
  };
}

describe("recommendModelRoute", () => {
  it("prefers deterministic code over model inference", () => {
    const recommendation = recommendModelRoute(input({
      task: {
        ...input().task,
        taskClass: "deterministic",
        intent: "Calculate runway from validated monthly cash inputs.",
      },
    }));

    expect(recommendation).toMatchObject({
      version: "sysdom_model_route_recommendation_v1",
      mode: "shadow",
      status: "no_model",
      lane: "no_model",
      portfolio: {
        version: 2,
      },
      selectedCandidate: null,
      confidence: "high",
    });
    expect(recommendation.reason).toContain("code or rules");
  });

  it("selects the lowest-cost eligible background model for low-risk triage", () => {
    const recommendation = recommendModelRoute(input({
      posture: "cost_conscious",
      task: {
        ...input().task,
        taskClass: "triage",
        criticality: "low",
        evidenceRequirement: "standard",
      },
      candidates: [
        candidate({
          model: "vendor/background-quality",
          lane: "background",
          costRank: 4,
          qualityRank: 1,
        }),
        candidate({
          model: "vendor/background-economy",
          lane: "background",
          costRank: 1,
          qualityRank: 3,
        }),
      ],
    }));

    expect(recommendation).toMatchObject({
      status: "ready",
      lane: "background",
      riskLevel: "low",
      selectedCandidate: {
        model: "vendor/background-economy",
      },
      approvalGate: "none",
    });
  });

  it("escalates financial external effects to a deliberation audit and founder approval", () => {
    const recommendation = recommendModelRoute(input({
      posture: "cost_conscious",
      task: {
        ...input().task,
        taskClass: "analysis",
        criticality: "low",
        externalEffects: ["financial"],
        approvalRequired: true,
      },
      candidates: [
        candidate({
          model: "vendor/cheap-workhorse",
          lane: "workhorse",
          costRank: 1,
        }),
        candidate({
          model: "vendor/deliberation",
          lane: "deliberation_audit",
          costRank: 8,
          qualityRank: 1,
        }),
      ],
    }));

    expect(recommendation).toMatchObject({
      status: "ready",
      lane: "deliberation_audit",
      riskLevel: "critical",
      selectedCandidate: {
        model: "vendor/deliberation",
      },
      approvalGate: "founder_approval_before_external_effect",
    });
    expect(recommendation.candidateAssessments).toContainEqual(expect.objectContaining({
      model: "vendor/cheap-workhorse",
      outcome: "excluded",
      reason: expect.stringContaining("not deliberation_audit"),
    }));
  });

  it("excludes models that are not approved for confidential venture context", () => {
    const recommendation = recommendModelRoute(input({
      task: {
        ...input().task,
        dataSensitivity: "confidential",
      },
      candidates: [
        candidate({
          model: "vendor/frontier-public-only",
          lane: "frontier",
          qualityRank: 1,
        }),
        candidate({
          model: "vendor/frontier-confidential",
          lane: "frontier",
          costRank: 2,
          qualityRank: 2,
          supportsConfidentialData: true,
        }),
      ],
    }));

    expect(recommendation).toMatchObject({
      status: "ready",
      lane: "frontier",
      riskLevel: "high",
      selectedCandidate: {
        model: "vendor/frontier-confidential",
      },
    });
    expect(recommendation.candidateAssessments).toContainEqual(expect.objectContaining({
      model: "vendor/frontier-public-only",
      reason: "Candidate is not approved for confidential venture context.",
    }));
  });

  it("fails closed when only an unpinned or unknown-billing candidate is available", () => {
    const recommendation = recommendModelRoute(input({
      candidates: [
        candidate({ model: "openrouter/auto" }),
        candidate({ model: "vendor/workhorse-unpriced", billingType: "unknown" }),
      ],
    }));

    expect(recommendation).toMatchObject({
      status: "blocked",
      lane: "workhorse",
      selectedCandidate: null,
      confidence: "low",
    });
    expect(recommendation.candidateAssessments.map((assessment) => assessment.reason)).toEqual([
      "Candidate does not pin an exact model.",
      "Candidate billing is unknown and must fail closed.",
    ]);
  });

  it("fails closed when candidate provenance is missing or stale", () => {
    const recommendation = recommendModelRoute(input({
      candidates: [
        candidate({ model: "vendor/no-evidence", evidence: null }),
        candidate({
          model: "vendor/stale-evidence",
          evidence: {
            sourceKind: "provider_docs",
            sourceLabel: "Expired provider catalog",
            sourceUrl: "https://example.com/models",
            verifiedAt: "2026-06-01T00:00:00.000Z",
            expiresAt: "2026-07-01T00:00:00.000Z",
          },
        }),
      ],
    }));

    expect(recommendation).toMatchObject({
      status: "blocked",
      portfolio: {
        version: 2,
      },
      selectedCandidate: null,
    });
    expect(recommendation.candidateAssessments.map((assessment) => assessment.reason)).toEqual([
      "Candidate provenance and freshness evidence is missing.",
      "Candidate catalog evidence is stale.",
    ]);
  });

  it("names a missing active portfolio as the blocker", () => {
    const recommendation = recommendModelRoute(input({
      portfolio: null,
      candidates: [],
    }));

    expect(recommendation).toMatchObject({
      status: "blocked",
      portfolio: null,
      selectedCandidate: null,
    });
    expect(recommendation.reason).toContain("no active versioned model portfolio");
  });

  it("uses quality rank within the safe lane without downgrading strategy work", () => {
    const recommendation = recommendModelRoute(input({
      posture: "quality_first",
      task: {
        ...input().task,
        taskClass: "strategy",
        criticality: "medium",
      },
      candidates: [
        candidate({
          model: "vendor/frontier-economy",
          lane: "frontier",
          costRank: 1,
          qualityRank: 3,
        }),
        candidate({
          model: "vendor/frontier-quality",
          lane: "frontier",
          costRank: 4,
          qualityRank: 1,
        }),
        candidate({
          model: "vendor/workhorse",
          lane: "workhorse",
          costRank: 1,
          qualityRank: 1,
        }),
      ],
    }));

    expect(recommendation).toMatchObject({
      status: "ready",
      lane: "frontier",
      selectedCandidate: {
        model: "vendor/frontier-quality",
      },
      confidence: "high",
      signals: {
        activeEngine: "customer",
        projectionVersion: 4,
      },
    });
  });
});
