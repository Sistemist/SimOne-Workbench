import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareVentureReviewPreview, ventureReviewShareDraftSchema, ventureReviewResultSchema } from "@paperclipai/shared";
import { createProviderVentureReviewTransport } from "./venture-review-provider.js";
import { VentureReviewExchange } from "./venture-review-exchange.js";
import { VentureReviewCoordinator } from "./venture-review.js";
import { providerMockOptions } from "./venture-review-provider-mock.js";

const example = JSON.parse(await readFile(new URL("../../../evals/fixtures/venture-review-ps02-oct08-demo.json", import.meta.url), "utf8"));
example.draft = ventureReviewShareDraftSchema.parse(example.draft);
example.result = ventureReviewResultSchema.parse(example.result);
const method = { version: "sim-aulet-local-2026-10-08", status: "provisional_local" as const,
  core: "COMPLETE PRIVATE CORE fixture, all concept groups", procedure: "COMPLETE PRIVATE PROCEDURE fixture, no truncation",
  coreSha256: "a".repeat(64), procedureSha256: "b".repeat(64) };
const packet = () => ({ version: "sysdom_venture_review_evidence_v1", tenantId: example.result.tenantId,
  reviewId: example.result.reviewId, idempotencyKey: "11111111-1111-4111-8111-111111111111",
  founderApprovedAt: new Date().toISOString(), durableWriteApproved: false, question: example.question,
  collectionOmissions: example.draft.collectionOmissions,
  sources: example.draft.sources.map((source: Record<string, unknown>) => ({ ...source, consent: { approved: true, purpose: "Fictional mock", recipients: ["Local mock"] } })) });
function harness() {
  const options = providerMockOptions(method, example);
  const fetcher = vi.fn(options.fetcher), claim = vi.fn(options.claim);
  const config = { ...options, fetcher, claim };
  return { config, fetcher, claim, run: (overrides = {}) => new VentureReviewCoordinator(createProviderVentureReviewTransport({ ...config, ...overrides })).review(packet()) };
}
afterEach(() => vi.useRealTimers());

describe("fresh provider boundary with mocked wire IO", () => {
  it("passes full private method plus only approved PS02 evidence through the consent exchange", async () => {
    const h = harness();
    const transport = createProviderVentureReviewTransport(h.config);
    const exchange = new VentureReviewExchange({ mode: "mock_only", transport, recipients: ["Local PS02 mock"], purpose: "Fictional mock",
      sessionTtlMs: 60_000, maxSessions: 2, reviewTimeoutMs: 5000,
      websitePolicy: { maxPages: 1, maxBytesPerPage: 1000, maxCharsPerPage: 1000, maxRedirects: 0, timeoutMs: 1000 },
      websiteNetwork: { lookup: async () => { throw new Error("No IO"); }, request: async () => { throw new Error("No IO"); } } });
    const actor = { tenantId: example.result.tenantId, actorId: "fictional-founder", role: "board" as const };
    try {
      const state = exchange.start(actor, { question: example.question });
      expect(state).toMatchObject({ mockOnly: true, execution: { mode: "provider_mock", model: "openai/gpt-6.1-sol", reasoningEffort: "high" } });
      const preview = await prepareVentureReviewPreview(example.draft);
      const approvalInput = { requestId: state.requestId, draftSha256: preview.draftSha256, sourceIds: preview.sourceIds,
        recipients: state.disclosure.recipients, purpose: state.disclosure.purpose };
      expect(() => exchange.approve(actor, state.reviewId, approvalInput)).toThrow(/execution mode/);
      const approval = exchange.approve(actor, state.reviewId, { ...approvalInput, execution: state.execution });
      const result = await exchange.submit(actor, state.reviewId, { approvalId: approval.approvalId, draft: preview.draft });
      expect(result.phase).toBe("complete");
      expect(result.result!.engineFindings).toEqual(example.result.engineFindings);
      expect(h.fetcher).toHaveBeenCalledTimes(1); expect(h.claim).toHaveBeenCalledTimes(1);
      const [url, request] = h.fetcher.mock.calls[0]!;
      expect(url).toBe("mock://venture-review/openrouter"); expect(request!.redirect).toBe("error");
      expect(new Headers(request!.headers).has("Authorization")).toBe(false);
      const wire = JSON.parse(String(request!.body));
      expect(wire.messages[0].content).toContain(method.core); expect(wire.messages[0].content).toContain(method.procedure);
      expect(wire.messages[0].content).toContain("one smallest decision-changing test");
      expect(wire.messages[0].content).toContain("Fit the proposed observation to available operating capacity");
      expect(wire.messages[0].content).toContain("not necessarily completed throughput");
      expect(wire).toMatchObject({ model: "openai/gpt-6.1-sol", reasoning: { effort: "high", mode: "standard" }, max_completion_tokens: 8192 });
      expect(wire).not.toHaveProperty("max_tokens");
      expect(result.result!.rubricVersion).toBe("sim-aulet-local-2026-10-08");
      expect(result.result!.omissions[0]).toContain("authored edits");
      expect(wire.messages[0].content).not.toContain(example.result.nextTest.action);
      expect(wire.messages[1].content).not.toContain("evaluatorOnly");
      expect(wire.provider).toMatchObject({ only: ["azure"], order: ["azure"], ignore: ["azure/us", "azure/eu"], allow_fallbacks: false, zdr: true, data_collection: "deny" });
      expect(JSON.parse(wire.messages[1].content).evidence.sources[0].provenance).toEqual(example.draft.sources[0].provenance);
      expect(JSON.stringify(result)).not.toContain(method.core);
      expect(h.config.receipts[0]).toMatchObject({ status: "response_received", reconciliation: "simulated_only", furtherRequestsAllowed: false });
      expect(exchange.cancel(actor, state.reviewId)).toMatchObject({ phase: "cancelled", result: null });
      await expect(transport.review(packet() as never)).rejects.toThrow(/consumed/);
    } finally { exchange.dispose(); }
  });

  it.each(["unsettled", "zero-cap", "missing-price-proof", "changed-body", "wrong-model", "stale", "unknown-policy", "over-budget", "zero-input-bound", "context-overflow"])("fails closed before dispatch: %s", async (kind) => {
    const h = harness();
    const preflight = async (hash: string) => {
      const proof = await h.config.preflight(hash);
      if (kind === "unsettled") return { ...proof, priorBillingReconciled: false };
      if (kind === "zero-cap") return { ...proof, policy: { ...proof.policy, providerHardCapCents: 0 } };
      if (kind === "missing-price-proof") return { ...proof, endpointEligible: false };
      if (kind === "changed-body") return { ...proof, bodySha256: "a".repeat(64) };
      if (kind === "wrong-model") return { ...proof, model: "other/model" };
      if (kind === "stale") return { ...proof, verifiedAt: "2020-01-01T00:00:00.000Z" };
      if (kind === "unknown-policy") return { ...proof, policy: null };
      if (kind === "zero-input-bound") return { ...proof, inputTokenUpperBound: 0 };
      if (kind === "context-overflow") return { ...proof, contextTokens: 100 };
      return { ...proof, providerRemainingCents: 1 };
    };
    await expect(h.run({ preflight })).rejects.toThrow(/stopped/);
    expect(h.fetcher).not.toHaveBeenCalled(); expect(h.claim).not.toHaveBeenCalled();
    expect(h.config.receipts[0]).toMatchObject({ dispatched: false, knownCostUsd: null, furtherRequestsAllowed: false });
  });

  it.each(["zero-cost", "missing-cost", "wrong-provider", "wrong-model", "tokens", "invalid-json", "invalid-shape", "invented-citation", "confident-hypothesis", "wrong-method"])("rejects untrusted response without repair/retry: %s", async (kind) => {
    const h = harness();
    const fetcher = vi.fn(async (url, init) => {
      const raw = await (await h.config.fetcher(url, init)).json();
      if (kind === "zero-cost") raw.usage.cost = 0;
      if (kind === "missing-cost") delete raw.usage.cost;
      if (kind === "wrong-provider") raw.provider = "Unexpected";
      if (kind === "wrong-model") raw.model = "unexpected/model";
      if (kind === "tokens") raw.usage.completion_tokens = 999999;
      if (kind === "invalid-json") raw.choices[0].message.content = "PRIVATE-SENTINEL invalid JSON";
      if (["invalid-shape", "invented-citation", "confident-hypothesis", "wrong-method"].includes(kind)) {
        const result = JSON.parse(raw.choices[0].message.content);
        if (kind === "invalid-shape") result.evidenceRequest = { purpose: "PRIVATE-SENTINEL", requestedSourceKinds: ["founder_note"], limits: { private: "PRIVATE-SENTINEL" } };
        if (kind === "invented-citation") result.engineFindings.customer[0].evidenceSourceIds = ["not-approved"];
        if (kind === "confident-hypothesis") Object.assign(result.engineFindings.customer[0], { basis: "hypothesis", confidence: "high" });
        if (kind === "wrong-method") result.rubricVersion = "unapproved-method";
        raw.choices[0].message.content = JSON.stringify(result);
      }
      return new Response(JSON.stringify(raw));
    });
    await expect(h.run({ fetcher })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.config.receipts)).not.toContain("PRIVATE-SENTINEL");
    expect(h.config.receipts[0]!.furtherRequestsAllowed).toBe(false);
    const stages: Record<string, string> = { "invalid-json": "result_json", "invalid-shape": "result_shape", "confident-hypothesis": "result_confidence" };
    if (stages[kind]) expect(h.config.receipts[0]).toMatchObject({ failureStage: stages[kind], usageValidated: true });
    if (["zero-cost", "missing-cost"].includes(kind)) expect(h.config.receipts[0]).toMatchObject({ generationId: "gen-ps02-mock", knownCostUsd: null });
  });

  it("aborts an uncooperative wire request on timeout/cancel and never retries", async () => {
    for (const stop of ["cancel", "timeout"]) {
      vi.useFakeTimers();
      const h = harness(), controller = new AbortController();
      const fetcher = vi.fn(async () => new Promise<Response>(() => {}));
      const transport = createProviderVentureReviewTransport({ ...h.config, fetcher, timeoutMs: 1000 });
      const pending = transport.review(packet() as never, controller.signal);
      const rejected = expect(pending).rejects.toThrow(/stopped/);
      await vi.advanceTimersByTimeAsync(0);
      expect(fetcher).toHaveBeenCalledTimes(1);
      if (stop === "cancel") controller.abort(); else await vi.advanceTimersByTimeAsync(1001);
      await rejected;
      expect(h.config.receipts[0]).toMatchObject({ dispatched: true, status: "stopped", knownCostUsd: null });
      await expect(transport.review(packet() as never)).rejects.toThrow(/consumed/);
      expect(fetcher).toHaveBeenCalledTimes(1); vi.useRealTimers();
    }
  });

  it("requires credentials for fresh mode but refuses them in provider mock; no fallback route", async () => {
    const h = harness();
    expect(() => createProviderVentureReviewTransport({ ...h.config, mode: "fresh" })).toThrow(/configuration/);
    expect(() => createProviderVentureReviewTransport({ ...h.config, apiKey: "fictional-test-only" })).toThrow(/configuration/);
    expect(() => createProviderVentureReviewTransport({ ...h.config, contract: { ...h.config.contract,
      providerRouting: { ...h.config.contract.providerRouting, allowFallbacks: true } } })).toThrow(/configuration/);
  });

  it("exercises fresh-mode wiring with a fake credential and intercepted fetch, preserving unreconciled receipt", async () => {
    const h = harness(), apiKey = "fictional-test-key-never-live";
    const fetcher = vi.fn(async (url, init) => {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${apiKey}`);
      return h.config.fetcher("mock://venture-review/openrouter", { ...init, headers: { "Content-Type": "application/json" } });
    });
    const preflight = async (hash: string) => ({ ...await h.config.preflight(hash), keySha256: createHash("sha256").update(apiKey).digest("hex") });
    const transport = createProviderVentureReviewTransport({ ...h.config, mode: "fresh", apiKey, preflight, fetcher });
    expect(transport.execution?.mode).toBe("fresh");
    const result = await new VentureReviewCoordinator(transport).review(packet());
    expect(result.status).toBe("complete");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(h.config.receipts[0]).toMatchObject({ reconciliation: "provider_ledger_check_required", furtherRequestsAllowed: false });
    expect(JSON.stringify(h.config.receipts)).not.toContain(apiKey);
    await expect(transport.review(packet() as never)).rejects.toThrow(/consumed/);
  });
});
