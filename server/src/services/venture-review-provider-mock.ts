/** Fictional PS02 provider wire simulator. No fetch, secrets or evaluator context. */
import type { VentureReviewShareDraft, VentureReviewResult } from "@paperclipai/shared";
import { ventureReviewEvidencePacketSchema } from "@paperclipai/shared";
import type { PrivateReviewMethod } from "./venture-review-method.js";
import { createProviderVentureReviewTransport, VENTURE_REVIEW_WORKING_ROUTE, type ReviewProviderReceipt } from "./venture-review-provider.js";
import { createRecordedVentureReviewTransport } from "./venture-review.js";

export function providerMockOptions(method: PrivateReviewMethod, example: { question: string; draft: VentureReviewShareDraft; result: VentureReviewResult }) {
  const recorded = createRecordedVentureReviewTransport(example);
  const contract = {
    version: "sysdom_model_route_execution_v1", policyVersion: "fictional-provider-mock-only", evaluatedAt: new Date().toISOString(),
    portfolio: { revisionId: "11111111-1111-4111-8111-111111111111", version: 1 }, lane: "workhorse",
    provider: "openrouter", model: VENTURE_REVIEW_WORKING_ROUTE.model, billingType: "metered_api", reasoningEffort: VENTURE_REVIEW_WORKING_ROUTE.reasoningEffort, maxOutputTokens: 8192,
    providerRouting: { sort: "price", allowFallbacks: false, requireParameters: true, dataCollection: "deny", zeroDataRetention: true,
      maxInputTokensPerRequest: 65536, maxInputUsdPerMillion: 2.5, maxOutputUsdPerMillion: 10 },
  };
  let claimed = false;
  const receipts: ReviewProviderReceipt[] = [];
  return {
    mode: "provider_mock" as const, method, contract, ...VENTURE_REVIEW_WORKING_ROUTE, timeoutMs: 5000, maxRunCostCents: 30,
    preflight: async (bodySha256: string) => {
      const verifiedAt = new Date().toISOString(), expiresAt = new Date(Date.now() + 60_000).toISOString();
      return { authorizationId: "fictional-ps02-mock-only", bodySha256, verifiedAt, expiresAt, providerTag: VENTURE_REVIEW_WORKING_ROUTE.providerTag, model: contract.model,
        priorBillingReconciled: true, endpointEligible: true, noTrainingOrPersistentContent: true, generatedLimitIncludesReasoning: true,
        inputTokenUpperBound: 65536, providerRemainingCents: 30, contextTokens: 131072, keySha256: null,
        policy: { provider: "openrouter", model: contract.model, billingType: "metered_api", maxRuns: 1, maxRetries: 0, concurrency: 1,
          maxRunCostCents: 30, providerHardCapCents: 30, providerHardCapEvidenceSource: "SIMULATED gate proof, never provider evidence",
          providerHardCapVerifiedAt: verifiedAt, providerHardCapExpiresAt: expiresAt } };
    },
    claim: async () => { if (claimed) throw new Error("Mock claim already consumed"); claimed = true; },
    receipt: async (receipt: ReviewProviderReceipt) => { receipts.push(receipt); },
    fetcher: (async (url, init) => {
      if (url !== "mock://venture-review/openrouter" || new Headers(init?.headers).has("Authorization")) throw new Error("Mock boundary only");
      const body = JSON.parse(String(init?.body));
      const evidence = ventureReviewEvidencePacketSchema.parse(JSON.parse(body.messages[1].content).evidence);
      const result = await recorded.review(evidence, init?.signal ?? undefined);
      return new Response(JSON.stringify({ id: "gen-ps02-mock", model: contract.model, provider: VENTURE_REVIEW_WORKING_ROUTE.providerName,
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }],
        usage: { prompt_tokens: 6000, completion_tokens: 1200, completion_tokens_details: { reasoning_tokens: 0 }, cost: 0.0015 } }));
    }) as typeof fetch,
    receipts,
  };
}

export function createPS02ProviderMock(method: PrivateReviewMethod, example: Parameters<typeof providerMockOptions>[1]) {
  return createProviderVentureReviewTransport(providerMockOptions(method, example));
}
