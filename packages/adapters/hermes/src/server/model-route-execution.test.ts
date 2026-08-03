import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";
import { describe, expect, it, vi } from "vitest";
import { execute } from "./execute.js";
import {
  assessHermesModelRouteExecution,
  hermesModelRouteExecutionBlockMessage,
} from "./model-route-execution.js";

function contract(providerRouting: Record<string, unknown> | null = null) {
  return {
    version: "sysdom_model_route_execution_v1",
    policyVersion: "sysdom-auto-alpha-1",
    evaluatedAt: "2026-08-01T00:00:00.000Z",
    portfolio: {
      revisionId: "33333333-3333-4333-8333-333333333333",
      version: 2,
    },
    lane: "workhorse",
    provider: "openrouter",
    model: "vendor/workhorse-v1",
    billingType: "metered_api",
    reasoningEffort: "low",
    maxOutputTokens: 10_000,
    providerRouting,
  };
}

describe("Hermes model route execution boundary", () => {
  it("allows an exact contract when no downstream provider controls are required", () => {
    expect(assessHermesModelRouteExecution({
      rawContract: contract(),
      resolvedProvider: "openrouter",
      model: "vendor/workhorse-v1",
    })).toMatchObject({
      status: "ready",
      blockers: [],
    });
  });

  it("blocks malformed contracts and exact identity drift", () => {
    expect(assessHermesModelRouteExecution({
      rawContract: { version: "unknown" },
      resolvedProvider: "openrouter",
      model: "vendor/workhorse-v1",
    })).toMatchObject({
      status: "blocked",
      blockers: ["contract_invalid"],
    });

    expect(assessHermesModelRouteExecution({
      rawContract: contract(),
      resolvedProvider: "anthropic",
      model: "vendor/other-model",
    })).toMatchObject({
      status: "blocked",
      blockers: ["provider_mismatch", "model_mismatch"],
    });
  });

  it("fails closed before spawn when Hermes cannot project OpenRouter controls", () => {
    const assessment = assessHermesModelRouteExecution({
      rawContract: contract({
        sort: "price",
        allowFallbacks: true,
        requireParameters: true,
        dataCollection: "deny",
        zeroDataRetention: true,
        maxInputTokensPerRequest: 100_000,
        maxInputUsdPerMillion: 1,
        maxOutputUsdPerMillion: 5,
      }),
      resolvedProvider: "openrouter",
      model: "vendor/workhorse-v1",
    });

    expect(assessment).toMatchObject({
      status: "blocked",
      blockers: ["provider_routing_not_supported"],
    });
    expect(hermesModelRouteExecutionBlockMessage(assessment))
      .toContain("provider_routing_not_supported");
  });

  it("rejects the adapter invocation before execution begins", async () => {
    const onLog = vi.fn();
    const ctx = {
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Synthetic Hermes",
        adapterConfig: {},
      },
      config: {
        provider: "openrouter",
        model: "vendor/workhorse-v1",
        modelRouteExecution: contract({
          sort: "price",
          allowFallbacks: true,
          requireParameters: true,
          dataCollection: "deny",
          zeroDataRetention: true,
          maxInputTokensPerRequest: 100_000,
          maxInputUsdPerMillion: 1,
          maxOutputUsdPerMillion: 5,
        }),
      },
      onLog,
    } as unknown as AdapterExecutionContext;

    await expect(execute(ctx)).rejects.toThrow(
      "provider_routing_not_supported",
    );
    expect(onLog).not.toHaveBeenCalled();
  });

  it("preserves legacy behavior when no active-portfolio contract is present", () => {
    expect(assessHermesModelRouteExecution({
      rawContract: undefined,
      resolvedProvider: "auto",
      model: "auto",
    })).toMatchObject({
      status: "not_required",
      blockers: [],
      contract: null,
    });
  });
});
