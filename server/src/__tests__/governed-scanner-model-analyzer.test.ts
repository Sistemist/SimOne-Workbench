import { describe, expect, it, vi } from "vitest";
import {
  createGovernedScannerModelAnalyzer,
  SCANNER_MODEL_ASSESSMENT_JSON_SCHEMA,
} from "../services/governed-scanner-model-analyzer.js";

function contract() {
  return {
    version: "sysdom_model_route_execution_v1",
    policyVersion: "sysdom-auto-alpha-1",
    evaluatedAt: "2026-08-03T19:33:55.000Z",
    portfolio: {
      revisionId: "33333333-3333-4333-8333-333333333333",
      version: 2,
    },
    lane: "workhorse",
    provider: "openrouter",
    model: "openai/gpt-5.6-luna",
    billingType: "metered_api",
    reasoningEffort: "low",
    maxOutputTokens: 128_000,
    providerRouting: {
      sort: "price",
      allowFallbacks: false,
      requireParameters: true,
      dataCollection: "deny",
      zeroDataRetention: true,
      maxInputTokensPerRequest: 25_000,
      maxInputUsdPerMillion: 0.1,
      maxOutputUsdPerMillion: 0.6,
    },
  };
}

function policy() {
  return {
    provider: "openrouter",
    model: "openai/gpt-5.6-luna",
    billingType: "metered_api",
    timeoutSec: 60,
    maxTurnsPerRun: 1,
    maxRuns: 1,
    maxRetries: 0,
    concurrency: 1,
    maxRunCostCents: 1,
    providerHardCapCents: 100,
    providerHardCapEvidenceSource: "Synthetic OpenRouter key-limit fixture",
    providerHardCapVerifiedAt: "2026-08-03T19:00:00.000Z",
    providerHardCapExpiresAt: "2026-08-04T19:00:00.000Z",
    subscriptionEvidenceSource: null,
    subscriptionVerifiedAt: null,
    subscriptionExpiresAt: null,
    meteredOverageAllowed: false,
  };
}

function output() {
  return JSON.stringify({
    version: "sysdom_scanner_model_assessment_v1",
    primaryEngine: "Customer Engine",
    secondaryEngine: "Product Engine",
    confidence: "medium",
    summary: "Customer return behavior is the primary hypothesis.",
    clarificationQuestion: "Where do people abandon signup?",
    evidenceCues: ["nobody completes signup", "nobody returns"],
  });
}

function executionResult(overrides: Record<string, unknown> = {}) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    provider: "openrouter",
    biller: "openrouter",
    model: "openai/gpt-5.6-luna",
    billingType: "metered_api",
    usage: {
      inputTokens: 120,
      outputTokens: 80,
      cachedInputTokens: 0,
    },
    costUsd: 0.00006,
    summary: output(),
    resultJson: {},
    ...overrides,
  };
}

function createAnalyzer(executeAdapter = vi.fn(async () => executionResult())) {
  return {
    analyzer: createGovernedScannerModelAnalyzer({
      rawContract: contract(),
      rawPolicy: policy(),
      apiKey: "test-only-key",
      providerModelAllowlist: ["openai/gpt-5.6-luna"],
      providerKeyLimitReset: null,
      now: () => new Date("2026-08-03T20:00:00.000Z"),
      executeAdapter,
    }),
    executeAdapter,
  };
}

describe("governed Scanner model analyzer", () => {
  it("projects the exact route, one-cent safety policy, and strict JSON schema", async () => {
    const { analyzer, executeAdapter } = createAnalyzer();
    const result = await analyzer.analyze({
      founderNote:
        "We keep changing the homepage, but almost nobody completes signup or returns.",
      deterministicAssessment: {
        primaryEngine: "Product Engine",
        secondaryEngine: null,
        primaryMatches: 1,
        secondaryMatches: 0,
      },
    });

    expect(executeAdapter).toHaveBeenCalledTimes(1);
    expect(executeAdapter).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        provider: "openrouter",
        model: "openai/gpt-5.6-luna",
        timeoutSec: 60,
        maxTurnsPerRun: 1,
        maxOutputTokens: 1_600,
        modelExecutionSafety: expect.objectContaining({
          maxRunCostCents: 1,
          providerHardCapCents: 100,
          maxRetries: 0,
          concurrency: 1,
        }),
        modelRouteExecution: expect.objectContaining({
          reasoningEffort: "low",
        }),
        responseFormat: {
          name: "sysdom_scanner_model_assessment",
          schema: SCANNER_MODEL_ASSESSMENT_JSON_SCHEMA,
        },
      }),
    }));
    expect(result).toMatchObject({
      assessment: {
        primaryEngine: "Customer Engine",
        secondaryEngine: "Product Engine",
      },
      provenance: {
        provider: "openrouter",
        model: "openai/gpt-5.6-luna",
        reasoningEffort: "low",
        inputTokens: 120,
        outputTokens: 80,
        costUsd: 0.00006,
      },
    });
  });

  it("fails before dispatch without the exact non-resetting key and one-model cap", () => {
    expect(() => createGovernedScannerModelAnalyzer({
      rawContract: contract(),
      rawPolicy: policy(),
      apiKey: "test-only-key",
      providerModelAllowlist: ["openai/gpt-5.6-luna", "openai/gpt-5.6-sol"],
      providerKeyLimitReset: null,
    })).toThrow("exact one-model allowlist");

    expect(() => createGovernedScannerModelAnalyzer({
      rawContract: contract(),
      rawPolicy: {
        ...policy(),
        providerHardCapExpiresAt: "2026-08-03T19:30:00.000Z",
      },
      apiKey: "test-only-key",
      providerModelAllowlist: ["openai/gpt-5.6-luna"],
      providerKeyLimitReset: null,
      now: () => new Date("2026-08-03T20:00:00.000Z"),
    })).toThrow("provider_cap_evidence_stale");
  });

  it("blocks the result when cost is missing or structured output is invalid", async () => {
    const missingCost = createAnalyzer(vi.fn(async () =>
      executionResult({ costUsd: null })
    )).analyzer;
    await expect(missingCost.analyze({
      founderNote: "Customer follow-up is scattered.",
      deterministicAssessment: {
        primaryEngine: "Customer Engine",
        secondaryEngine: null,
        primaryMatches: 2,
        secondaryMatches: 0,
      },
    })).rejects.toThrow("actual_cost_missing");

    const invalidJson = createAnalyzer(vi.fn(async () =>
      executionResult({ summary: "not-json" })
    )).analyzer;
    await expect(invalidJson.analyze({
      founderNote: "Customer follow-up is scattered.",
      deterministicAssessment: {
        primaryEngine: "Customer Engine",
        secondaryEngine: null,
        primaryMatches: 2,
        secondaryMatches: 0,
      },
    })).rejects.toThrow("invalid JSON");
  });
});
