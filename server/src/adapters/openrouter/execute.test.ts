import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdapterExecutionContext } from "../types.js";
import { execute } from "./execute.js";
import {
  buildOpenRouterGovernedRequest,
  OPENROUTER_CHAT_COMPLETIONS_URL,
} from "./request.js";

function contract() {
  return {
    version: "sysdom_model_route_execution_v1",
    policyVersion: "sysdom-auto-alpha-1",
    evaluatedAt: "2026-08-02T00:00:00.000Z",
    portfolio: {
      revisionId: "33333333-3333-4333-8333-333333333333",
      version: 2,
    },
    lane: "workhorse",
    provider: "openrouter",
    model: "vendor/workhorse-v1",
    billingType: "metered_api",
    maxOutputTokens: 2_000,
    providerRouting: {
      sort: "price",
      allowFallbacks: false,
      requireParameters: true,
      dataCollection: "deny",
      zeroDataRetention: true,
      maxInputTokensPerRequest: 10_000,
      maxInputUsdPerMillion: 1,
      maxOutputUsdPerMillion: 5,
    },
  };
}

function context(
  overrides: Partial<AdapterExecutionContext["config"]> = {},
): AdapterExecutionContext {
  return {
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Synthetic Router",
      adapterType: "openrouter",
      adapterConfig: {},
    },
    runtime: {
      sessionId: null,
      sessionParams: null,
      sessionDisplayId: null,
      taskKey: null,
    },
    config: {
      provider: "openrouter",
      model: "vendor/workhorse-v1",
      timeoutSec: 5,
      maxOutputTokens: 500,
      prompt: "Evaluate the fictional Product Engine evidence.",
      env: {
        OPENROUTER_API_KEY: "test-only-key",
      },
      modelExecutionSafety: {
        maxRunCostCents: 20,
      },
      modelRouteExecution: contract(),
      ...overrides,
    },
    context: {},
    onLog: vi.fn(async () => {}),
    onMeta: vi.fn(async () => {}),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("governed OpenRouter request boundary", () => {
  it("translates every governed provider control into the exact wire body", () => {
    const request = buildOpenRouterGovernedRequest({
      rawContract: contract(),
      configuredProvider: "openrouter",
      configuredModel: "vendor/workhorse-v1",
      messages: [{ role: "user", content: "Synthetic fixture" }],
      maxOutputTokens: 500,
      temperature: 0,
      maxRunCostCents: 20,
    });

    expect(request.body).toEqual({
      model: "vendor/workhorse-v1",
      messages: [{ role: "user", content: "Synthetic fixture" }],
      max_tokens: 500,
      temperature: 0,
      stream: false,
      provider: {
        sort: "price",
        allow_fallbacks: false,
        require_parameters: true,
        data_collection: "deny",
        zdr: true,
        max_price: {
          prompt: 1,
          completion: 5,
        },
      },
    });
    expect(request.receipt).toMatchObject({
      endpoint: OPENROUTER_CHAT_COMPLETIONS_URL,
      provider: "openrouter",
      model: "vendor/workhorse-v1",
      maxOutputTokens: 500,
      maxInputUsdPerMillion: 1,
      maxOutputUsdPerMillion: 5,
    });
    expect(request.receipt.bodySha256).toBe(
      createHash("sha256").update(request.serializedBody).digest("hex"),
    );
  });

  it("fails closed on identity drift, missing controls, input overflow, and cost overflow", () => {
    const base = {
      rawContract: contract(),
      configuredProvider: "openrouter",
      configuredModel: "vendor/workhorse-v1",
      messages: [{ role: "user" as const, content: "Synthetic fixture" }],
      maxOutputTokens: 500,
      maxRunCostCents: 20,
    };

    expect(() => buildOpenRouterGovernedRequest({
      ...base,
      configuredModel: "vendor/other-model",
    })).toThrow("model does not match");
    expect(() => buildOpenRouterGovernedRequest({
      ...base,
      rawContract: {
        ...contract(),
        providerRouting: null,
      },
    })).toThrow("provider-routing controls are missing");
    expect(() => buildOpenRouterGovernedRequest({
      ...base,
      messages: [{ role: "user", content: "x".repeat(20_000) }],
    })).toThrow("conservative governed input-token limit");
    expect(() => buildOpenRouterGovernedRequest({
      ...base,
      maxRunCostCents: 1,
    })).toThrow("worst-case request cost exceeds");
  });

  it("sends the attested request once and reconciles exact response evidence", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(_url).toBe(OPENROUTER_CHAT_COMPLETIONS_URL);
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Authorization"))
        .toBe("Bearer test-only-key");
      expect(body.provider).toEqual({
        sort: "price",
        allow_fallbacks: false,
        require_parameters: true,
        data_collection: "deny",
        zdr: true,
        max_price: {
          prompt: 1,
          completion: 5,
        },
      });
      return new Response(JSON.stringify({
        id: "gen-synthetic",
        model: "vendor/workhorse-v1",
        provider: "Synthetic ZDR Provider",
        choices: [{
          message: {
            role: "assistant",
            content: "Synthetic reviewed answer.",
          },
        }],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 30,
          prompt_tokens_details: {
            cached_tokens: 20,
          },
          cost: 0.0015,
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const ctx = context();

    const result = await execute(ctx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      exitCode: 0,
      timedOut: false,
      provider: "openrouter",
      biller: "openrouter",
      model: "vendor/workhorse-v1",
      billingType: "metered_api",
      costUsd: 0.0015,
      usage: {
        inputTokens: 120,
        outputTokens: 30,
        cachedInputTokens: 20,
      },
      summary: "Synthetic reviewed answer.",
      resultJson: {
        modelRouteRequest: {
          version: "sysdom_openrouter_request_receipt_v1",
        },
        openRouter: {
          responseId: "gen-synthetic",
          responseModel: "vendor/workhorse-v1",
          upstreamProvider: "Synthetic ZDR Provider",
        },
      },
    });
    expect(ctx.onMeta).toHaveBeenCalledWith(expect.objectContaining({
      command: `POST ${OPENROUTER_CHAT_COMPLETIONS_URL}`,
      context: {
        modelRouteRequest: expect.objectContaining({
          bodySha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      },
    }));
    expect(ctx.onLog).toHaveBeenCalledWith(
      "stdout",
      "Synthetic reviewed answer.\n",
    );
  });

  it("does not call the network when a governed precondition fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(execute(context({
      model: "vendor/other-model",
    }))).rejects.toThrow("model does not match");
    await expect(execute(context({
      env: {},
    }))).rejects.toThrow("OPENROUTER_API_KEY");
    await expect(execute(context({
      timeoutSec: 0,
    }))).rejects.toThrow("positive timeoutSec");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
