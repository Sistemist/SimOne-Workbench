import { describe, expect, it } from "vitest";
import type {
  ModelRouteCandidate,
  ModelRouteRecommendation,
} from "@paperclipai/shared";
import {
  applyModelRouteExecutionContract,
  assessModelRouteExecution,
} from "../services/model-route-execution.js";

function candidate(
  overrides: Partial<ModelRouteCandidate> = {},
): ModelRouteCandidate {
  return {
    provider: "openrouter",
    model: "vendor/workhorse-v1",
    lane: "workhorse",
    billingType: "metered_api",
    reasoningEffort: "low",
    costRank: 1,
    qualityRank: 1,
    enabled: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsConfidentialData: false,
    supportsRestrictedData: false,
    evidence: {
      sourceKind: "benchmark",
      authority: "independent",
      sourceLabel: "Synthetic independent evidence",
      sourceUrl: "https://example.com/benchmark",
      verifiedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
    },
    catalog: {
      canonicalSlug: "vendor/workhorse-v1-20260801",
      lifecycle: "stable",
      contextWindowTokens: 100_000,
      maxOutputTokens: 10_000,
      pricing: {
        currency: "USD",
        unit: "per_million_tokens",
        inputUsd: 1,
        outputUsd: 5,
        cachedInputUsd: 0.1,
      },
      providerRouting: {
        sort: "price",
        allowFallbacks: true,
        requireParameters: true,
        dataCollection: "deny",
        zeroDataRetention: true,
        maxInputTokensPerRequest: 100_000,
        maxInputUsdPerMillion: 1,
        maxOutputUsdPerMillion: 5,
      },
    },
    ...overrides,
  };
}

function recommendation(
  overrides: Partial<ModelRouteRecommendation> = {},
): ModelRouteRecommendation {
  const selected = candidate();
  return {
    version: "sysdom_model_route_recommendation_v1",
    mode: "shadow",
    policyVersion: "sysdom-auto-alpha-1",
    evaluatedAt: "2026-08-01T00:00:00.000Z",
    status: "ready",
    posture: "balanced",
    portfolio: {
      revisionId: "33333333-3333-4333-8333-333333333333",
      version: 2,
    },
    lane: "workhorse",
    riskLevel: "medium",
    selectedCandidate: selected,
    candidateAssessments: [{
      provider: selected.provider,
      model: selected.model,
      lane: selected.lane,
      outcome: "selected",
      reason: "Synthetic selection",
    }],
    confidence: "high",
    reason: "Synthetic recommendation",
    approvalGate: "none",
    signals: {
      taskClass: "analysis",
      criticality: "medium",
      reversible: true,
      externalEffects: [],
      dataSensitivity: "internal",
      evidenceRequirement: "standard",
      approvalRequired: false,
      activeEngine: "product",
      projectionId: null,
      projectionVersion: null,
      constitutionRevisionId: null,
    },
    ...overrides,
  };
}

describe("model route execution contract", () => {
  it("projects an exact active-portfolio selection into runtime config", () => {
    const assessment = assessModelRouteExecution({
      recommendation: recommendation(),
      configuredProvider: "openrouter",
      configuredModel: "vendor/workhorse-v1",
    });

    expect(assessment).toMatchObject({
      status: "ready",
      enforced: true,
      blockers: [],
      contract: {
        version: "sysdom_model_route_execution_v1",
        provider: "openrouter",
        model: "vendor/workhorse-v1",
        reasoningEffort: "low",
        maxOutputTokens: 10_000,
        providerRouting: {
          dataCollection: "deny",
          zeroDataRetention: true,
        },
      },
    });
    expect(applyModelRouteExecutionContract(
      { provider: "openrouter", model: "vendor/workhorse-v1" },
      assessment,
    )).toMatchObject({
      modelRouteExecution: assessment.contract,
    });
  });

  it("blocks dispatch when the configured provider or model differs", () => {
    const assessment = assessModelRouteExecution({
      recommendation: recommendation(),
      configuredProvider: "anthropic",
      configuredModel: "vendor/other-model",
    });

    expect(assessment).toMatchObject({
      status: "blocked",
      enforced: true,
      blockers: [
        "configured_provider_mismatch",
        "configured_model_mismatch",
      ],
      contract: null,
    });
  });

  it("blocks dispatch when an active portfolio has no ready selection", () => {
    const assessment = assessModelRouteExecution({
      recommendation: recommendation({
        status: "blocked",
        selectedCandidate: null,
      }),
      configuredProvider: "openrouter",
      configuredModel: "vendor/workhorse-v1",
    });

    expect(assessment).toMatchObject({
      status: "blocked",
      blockers: [
        "recommendation_not_ready",
        "selected_candidate_missing",
      ],
    });
  });

  it("does not impose the contract before a portfolio is activated", () => {
    const assessment = assessModelRouteExecution({
      recommendation: recommendation({
        status: "blocked",
        portfolio: null,
        selectedCandidate: null,
      }),
      configuredProvider: "hermes_local",
      configuredModel: "adapter-default",
    });

    expect(assessment).toMatchObject({
      status: "not_required",
      enforced: false,
      blockers: [],
      contract: null,
    });
  });
});
