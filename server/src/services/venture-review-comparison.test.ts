import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReviewComparisonRequest, createReviewComparison, reviewComparisonFileControls, REVIEW_PAIR,
  readReviewComparisonPublicProof, verifyReviewComparisonGate, type ReviewArm, type ReviewComparisonProof } from "./venture-review-comparison.js";

const fixture = vi.hoisted(() => ({ messages: [{ role: "system", content: "Synthetic method, not private SIM" },
  { role: "user", content: "Synthetic evidence only" }],
  hash: "4b9156529a40ae4b41d0bd7629fdc6868d308d0a00811f81b0bdd40e89df2c7a" }));
// Only the exact synthetic messages stand in for the frozen private input in CI.
vi.mock("node:crypto", async importOriginal => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHash: (...args: Parameters<typeof actual.createHash>) => {
    const h = actual.createHash(...args), update = h.update.bind(h), digest = h.digest.bind(h);
    let synthetic = false;
    h.update = ((data: unknown, ...rest: unknown[]) => {
      synthetic = data === JSON.stringify(fixture.messages); return Reflect.apply(update, h, [data, ...rest]);
    }) as typeof h.update;
    h.digest = ((encoding?: string) => synthetic && encoding === "hex" ? fixture.hash : Reflect.apply(digest, h, [encoding])) as typeof h.digest;
    return h;
  } };
});
const secret = "synthetic-key-not-a-credential";
const prior = 0.00123785;
function proof(arm: ReviewArm): ReviewComparisonProof {
  const sol = arm === "sol";
  return { checkedAt: new Date().toISOString(), evidenceRef: "mock-public-route-contract",
    model: sol ? "openai/gpt-5.6-sol" : "z-ai/glm-5.3-flash", provider: sol ? "Azure" : "Fireworks",
    eligibleTags: [sol ? "azure" : "fireworks"], supportedParameters: [sol ? "max_completion_tokens" : "max_tokens", "reasoning"],
    supportedEfforts: [sol ? "high" : "max"], contextTokens: 1050000, inputPrice: sol ? 5 : 0.15,
    outputPrice: sol ? 30 : 0.5, inputWritePrice: sol ? 6.25 : 0.15,
    zdr: true, noTrainingOrPersistentContent: true, generatedLimitIncludesReasoning: true, dedicatedOnlyConsumer: true,
    autoReload: false, byok: false, promptLogging: false, dataSharing: false, broadcast: false,
    budgetProof: { mode: "verified_input_bound", upperBoundTokens: 1000, evidenceRef: "mock-tokenizer-bound" } };
}
function input() { return { messages: structuredClone(fixture.messages), criteriaSha256: String(REVIEW_PAIR.criteriaSha256), apiKey: secret }; }
function setup() {
  const state = { posts: 0, usage: prior, limit: 3, staleAfterFirst: false };
  const records = new Map<string, unknown>([["gen-1790020451-YCCs3AcWQyLXAjBFkJ1L", {
    id: "gen-1790020451-YCCs3AcWQyLXAjBFkJ1L", model: "z-ai/glm-5.3-flash", provider_name: "Fireworks", total_cost: prior,
    is_byok: false, cancelled: false, native_tokens_prompt: 5009, native_tokens_completion: 973, native_tokens_reasoning: 21,
  }]]);
  const post = vi.fn((arm: ReviewArm) => ({ id: `gen-${arm}-mock`, model: arm === "glm" ? "z-ai/glm-5.3-flash" : "openai/gpt-5.6-sol",
    provider: arm === "glm" ? "Fireworks" : "Azure", choices: [{ finish_reason: "stop", message: { content: "Fictional mock answer" } }],
    usage: { prompt_tokens: 100, completion_tokens: 80, completion_tokens_details: { reasoning_tokens: 20 }, cost: arm === "glm" ? 0.001 : 0.02 } }));
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    const address = String(url);
    if (init?.method === "POST") {
      state.posts++;
      const body = JSON.parse(String(init.body));
      const arm = body.model === "z-ai/glm-5.3-flash" ? "glm" : "sol";
      const result = post(arm);
      state.usage += result.usage.cost;
      records.set(result.id, { id: result.id, model: result.model, provider_name: result.provider,
        total_cost: result.usage.cost, is_byok: false, cancelled: false, native_tokens_prompt: result.usage.prompt_tokens,
        native_tokens_completion: result.usage.completion_tokens, native_tokens_reasoning: result.usage.completion_tokens_details.reasoning_tokens });
      return new Response(JSON.stringify(result));
    }
    if (address === "https://openrouter.ai/api/v1/key") {
      const usage = state.staleAfterFirst && state.posts ? prior : state.usage;
      return new Response(JSON.stringify({ data: { limit: state.limit, limit_remaining: state.limit - usage, usage,
        limit_reset: null, byok_usage: 0, is_management_key: false, expires_at: "2099-01-01T00:00:00Z" } }));
    }
    if (address.startsWith("https://openrouter.ai/api/v1/generation?id=")) {
      return new Response(JSON.stringify({ data: records.get(new URL(address).searchParams.get("id")!) }));
    }
    throw new Error("Unexpected network target");
  });
  const claim = vi.fn(async () => {}), persist = vi.fn(async () => {});
  const preflight = vi.fn(async (arm: ReviewArm) => proof(arm));
  const options = { fetcher, claim, persist, preflight };
  return { state, records, post, ...options, options, runner: createReviewComparison(options) };
}
const tempDirectories: string[] = [];
function solSetup() {
  const s = setup();
  s.state.usage = prior + 0.0028659;
  s.records.set("gen-1790025863-e4YCQXHPjndKnXJbzuPm", { id: "gen-1790025863-e4YCQXHPjndKnXJbzuPm",
    model: "z-ai/glm-5.3-flash-20260826", provider_name: "Fireworks", total_cost: 0.0028659,
    is_byok: false, cancelled: false, native_tokens_prompt: 4716, native_tokens_completion: 4317, native_tokens_reasoning: 3227 });
  const options = { ...s.options, continuation: "sol-only-04" as const };
  return { ...s, options, runner: createReviewComparison(options) };
}
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(tempDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

describe("frozen CU01 sequential comparison (only mocked transports)", () => {
  it("runs only Sol after exact prior GLM reconciliation and preserves that readback in its receipt", async () => {
    const s = solSetup(), result = await s.runner.run(input());
    expect(result.status).toBe("completed"); expect(result.inferenceRequests).toBe(1);
    expect(s.post.mock.calls.map(x => x[0])).toEqual(["sol"]);
    expect(s.claim.mock.calls.map(x => (x as unknown[])[0])).toEqual(["session", "sol"]);
    expect(result.receipts[0]?.priorBilling).toMatchObject({
      modelIdentity: { reportedModel: "z-ai/glm-5.3-flash-20260826", matched: true },
      assessment: { reconciled: true, cumulativeUsageUsd: 0.00410375 } });
    await expect(s.runner.run(input())).rejects.toThrow(/already attempted/);
  });
  it("records enabled account-credit top-up without treating it as a reset of the dedicated key cap", async () => {
    const s = solSetup(); s.preflight.mockImplementation(async arm => ({ ...proof(arm), autoReload: true }));
    expect((await s.runner.run(input())).status).toBe("completed");
    const t = solSetup(); t.state.limit = 4;
    t.preflight.mockImplementation(async arm => ({ ...proof(arm), autoReload: true }));
    expect((await t.runner.run(input())).inferenceRequests).toBe(0);
  });
  it.each(["missing", "wrong-cost", "wrong-model", "stale-ledger"])("blocks Sol when the exact GLM bill is not reconciled: %s", async variant => {
    const s = solSetup(), record = s.records.get("gen-1790025863-e4YCQXHPjndKnXJbzuPm") as Record<string, unknown>;
    if (variant === "missing") s.records.clear();
    if (variant === "wrong-cost") record.total_cost = 0.002;
    if (variant === "wrong-model") record.model = "z-ai/glm-unknown";
    if (variant === "stale-ledger") s.state.usage = prior;
    expect((await s.runner.run(input())).inferenceRequests).toBe(0); expect(s.post).not.toHaveBeenCalled();
  });
  it("never invokes GLM or retries when Sol's own billing fails", async () => {
    const s = solSetup(); s.state.staleAfterFirst = true;
    const result = await s.runner.run(input());
    expect(result.status).toBe("stopped"); expect(result.inferenceRequests).toBe(1);
    expect(s.post.mock.calls.map(x => x[0])).toEqual(["sol"]);
    expect(result.receipts[0]?.stopReason).toBe("billing_not_reconciled");
  });
  it("pins same prompt, exact hosts/efforts, combined token parameters and privacy on both wires", () => {
    const glm = JSON.parse(buildReviewComparisonRequest("glm", fixture.messages).serialized);
    const sol = JSON.parse(buildReviewComparisonRequest("sol", fixture.messages).serialized);
    expect(glm.messages).toEqual(sol.messages);
    expect(glm).toMatchObject({ model: "z-ai/glm-5.3-flash", max_tokens: 8192, reasoning: { effort: "max", exclude: true },
      provider: { only: ["fireworks"], allow_fallbacks: false, require_parameters: true, data_collection: "deny", zdr: true } });
    expect(sol).toMatchObject({ model: "openai/gpt-5.6-sol", max_completion_tokens: 8192,
      reasoning: { effort: "high", mode: "standard", exclude: true }, provider: { only: ["azure"], ignore: ["azure/us", "azure/eu"],
        max_price: { prompt: 5, completion: 30 }, allow_fallbacks: false, data_collection: "deny", zdr: true } });
    for (const body of [glm, sol]) for (const field of ["models", "tools", "plugins", "preset", "temperature", "metadata"]) expect(body).not.toHaveProperty(field);
    expect(sol).not.toHaveProperty("max_tokens"); expect(glm).not.toHaveProperty("max_completion_tokens");
  });
  it("runs exactly GLM then Sol with reconciled billing and durable receipt before the next call", async () => {
    const s = setup();
    const result = await s.runner.run(input());
    expect(result.status).toBe("completed"); expect(result.inferenceRequests).toBe(2);
    expect(s.post.mock.calls.map(x => x[0])).toEqual(["glm", "sol"]);
    expect(s.claim.mock.calls.map(x => (x as unknown[])[0])).toEqual(["session", "glm", "sol"]);
    expect(s.persist).toHaveBeenCalledTimes(2);
    expect(s.persist.mock.invocationCallOrder[0]).toBeLessThan(s.post.mock.invocationCallOrder[1]!);
    expect(result.receipts.every(r => r.billing?.assessment.reconciled)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(secret);
    await expect(s.runner.run(input())).rejects.toThrow(/already attempted/);
    expect(s.state.posts).toBe(2);
  });
  it("snapshots input, credentials and dependencies before awaiting a claim", async () => {
    const s = setup(); let release!: () => void;
    s.claim.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const candidate = input(); const work = s.runner.run(candidate);
    candidate.messages[0]!.content = "tampered"; candidate.apiKey = "different-key";
    s.options.fetcher = vi.fn<typeof fetch>(); release();
    expect((await work).status).toBe("completed");
    for (const [, init] of s.fetcher.mock.calls) expect(init?.headers).toMatchObject({ Authorization: `Bearer ${secret}` });
  });
  it("reconciles exact public canonical model identifiers before, between and after both calls", async () => {
    const s = setup(), original = s.fetcher.getMockImplementation()!;
    s.fetcher.mockImplementation(async (url, init) => {
      const response = await original(url, init);
      if (String(url).includes("/generation?")) {
        const body = await response.json();
        body.data.model += body.data.model.startsWith("z-ai/") ? "-20260826" : "-20260709";
        return new Response(JSON.stringify(body));
      }
      return response;
    });
    const result = await s.runner.run(input());
    expect(result.status).toBe("completed"); expect(result.inferenceRequests).toBe(2);
    expect(result.receipts.every(r => r.billing?.modelIdentity.kind === "public_canonical_alias")).toBe(true);
  });
  it.each(["messages", "criteria", "roles"])("rejects changed frozen %s before claiming or network", async kind => {
    const s = setup(), candidate = input();
    if (kind === "messages") candidate.messages[0]!.content += "changed";
    if (kind === "criteria") candidate.criteriaSha256 = "wrong";
    if (kind === "roles") candidate.messages.push({ role: "assistant", content: "leaked evaluator answer" });
    expect((await s.runner.run(candidate)).inferenceRequests).toBe(0);
    expect(s.fetcher).not.toHaveBeenCalled(); expect(s.claim).not.toHaveBeenCalled();
  });
  it.each([
    { zdr: false }, { byok: true }, { dedicatedOnlyConsumer: false }, { broadcast: true },
    { dataSharing: true }, { promptLogging: true }, { noTrainingOrPersistentContent: false },
    { generatedLimitIncludesReasoning: false }, { inputPrice: 0 }, { outputPrice: 0.6 }, { inputWritePrice: 0 },
    { eligibleTags: ["fireworks", "unapproved"] }, { model: "auto" }, { provider: "Azure" },
    { supportedParameters: [] }, { supportedEfforts: ["low"] }, { contextTokens: 40959 },
    { checkedAt: "2000-01-01T00:00:00Z" }, { checkedAt: "2099-01-01T00:00:00Z" },
    { budgetProof: { mode: "estimated_input", upperBoundTokens: 32768 } },
    { budgetProof: { mode: "verified_input_bound", upperBoundTokens: 32769, evidenceRef: "mock" } },
  ])("stops on invalid or unknown preflight evidence %j", async override => {
    const s = setup(); s.preflight.mockImplementation(async arm => ({ ...proof(arm), ...override } as ReviewComparisonProof));
    expect((await s.runner.run(input())).inferenceRequests).toBe(0); expect(s.post).not.toHaveBeenCalled();
  });
  it("blocks prior missing generation evidence and positive-versus-zero key mismatch", async () => {
    for (const missingGeneration of [true, false]) {
      const s = setup(); if (missingGeneration) s.records.clear(); else s.state.usage = 0;
      const result = await s.runner.run(input()); expect(result.inferenceRequests).toBe(0);
      expect(result.lastBilling?.assessment.reconciled).toBe(false);
    }
  });
  it("blocks second inference when first cost does not reconcile", async () => {
    const s = setup(); s.state.staleAfterFirst = true;
    const result = await s.runner.run(input());
    expect(result.status).toBe("stopped"); expect(result.inferenceRequests).toBe(1);
    expect(result.receipts[0]?.stopReason).toBe("billing_not_reconciled"); expect(s.persist).toHaveBeenCalledTimes(1);
  });
  it("rechecks route eligibility between the two models", async () => {
    const s = setup(); s.preflight.mockImplementation(async arm => ({ ...proof(arm), eligibleTags: arm === "sol" ? ["azure", "azure/eu"] : ["fireworks"] }));
    expect((await s.runner.run(input())).inferenceRequests).toBe(1);
  });
  it("reserves existing $3 remaining authority one call at a time with explicit enforcement evidence", async () => {
    const s = setup();
    s.preflight.mockImplementation(async arm => ({ ...proof(arm), budgetProof: {
      mode: "remaining_authorized_budget", providerEnforcedKeyCreditLimit: true,
      evidenceRef: "synthetic-provider-spending-cap-contract; NOT live proof" } }));
    const result = await s.runner.run(input());
    expect(result.status).toBe("completed"); expect(s.state.limit).toBe(3);
    expect(result.receipts[0]?.runReservationUsd).toBeCloseTo(3 - prior, 9);
    expect(result.receipts[1]?.runReservationUsd).toBeCloseTo(3 - prior - 0.001, 9);
    expect(result.receipts[1]?.runReservationUsd).toBeGreaterThan(result.receipts[1]!.estimatedMaxUsd);
    expect(result.receipts.every(r => r.budgetMode === "remaining_authorized_budget")).toBe(true);
    expect(s.persist.mock.invocationCallOrder[0]).toBeLessThan(s.post.mock.invocationCallOrder[1]!);
  });
  it.each([3, 0.45])("a local $%s budget without a provider spending-cap contract is insufficient", async limit => {
    for (const enforcement of [undefined, false]) {
      const s = setup(); s.state.limit = limit;
      s.preflight.mockImplementation(async arm => ({ ...proof(arm), budgetProof: {
        mode: "remaining_authorized_budget", providerEnforcedKeyCreditLimit: enforcement,
        evidenceRef: "only-configured-key-cap" } } as unknown as ReviewComparisonProof));
      expect((await s.runner.run(input())).inferenceRequests).toBe(0);
    }
  });
  it("blocks absent enforcement evidence or insufficient independently verified credit", async () => {
    const s = setup(); s.state.limit = prior + 0.001;
    expect((await s.runner.run(input())).inferenceRequests).toBe(0);
    const t = setup(); t.preflight.mockImplementation(async arm => ({ ...proof(arm), budgetProof: {
      mode: "remaining_authorized_budget", providerEnforcedKeyCreditLimit: true, evidenceRef: "" } }));
    expect((await t.runner.run(input())).inferenceRequests).toBe(0);
  });
  it("does not require reserving the larger planning estimate when an actual smaller bound is proven", async () => {
    const s = setup();
    s.state.limit = prior + 0.0045; // Above this mock GLM proof's $0.004246, below the $0.0090112 estimate.
    const result = await s.runner.run(input());
    expect(result.inferenceRequests).toBe(1); // Sol's proved bound cannot fit after reconciliation.
    expect(result.receipts[0]?.runReservationUsd).toBeCloseTo(0.004246, 9);
  });
  it("stops on any response above the remaining cumulative authorization even with enforcement asserted", async () => {
    const s = setup();
    s.preflight.mockImplementation(async arm => ({ ...proof(arm), budgetProof: {
      mode: "remaining_authorized_budget", providerEnforcedKeyCreditLimit: true, evidenceRef: "mock-contract" } }));
    const original = s.post.getMockImplementation()!;
    s.post.mockImplementation(arm => ({ ...original(arm), usage: { ...original(arm).usage, cost: 3 } }));
    const result = await s.runner.run(input());
    expect(result.status).toBe("stopped"); expect(result.inferenceRequests).toBe(1);
    expect(result.receipts[0]?.knownCostUsd).toBe(3);
  });
  it("rejects inconsistent remaining balance even if a caller incorrectly labels billing reconciled", async () => {
    const result = await setup().runner.run(input());
    const billing = structuredClone(result.lastBilling!);
    billing.key!.limit_remaining = 3;
    expect(() => verifyReviewComparisonGate("sol", proof("sol"), billing)).toThrow();
  });
  it.each(["zero-cost", "unknown-cost", "overspend", "wrong-model", "wrong-host", "token-spike", "reasoning-spike", "length", "tool", "secret"])("stops after one invalid result: %s", async variant => {
    const s = setup(); const original = s.post.getMockImplementation()!;
    s.post.mockImplementation(arm => {
      const result = original(arm);
      if (variant === "zero-cost") result.usage.cost = 0;
      if (variant === "unknown-cost") delete (result.usage as Partial<typeof result.usage>).cost;
      if (variant === "overspend") result.usage.cost = 0.03;
      if (variant === "wrong-model") result.model = "wrong";
      if (variant === "wrong-host") result.provider = "unapproved";
      if (variant === "token-spike") result.usage.completion_tokens = 8193;
      if (variant === "reasoning-spike") result.usage.completion_tokens_details.reasoning_tokens = 81;
      if (variant === "length") result.choices[0]!.finish_reason = "length";
      if (variant === "tool") Object.assign(result.choices[0]!.message, { tool_calls: [{ name: "publish" }] });
      if (variant === "secret") result.choices[0]!.message.content = secret;
      return result;
    });
    const result = await s.runner.run(input());
    expect(result.status).toBe("stopped"); expect(result.inferenceRequests).toBe(1);
    expect(result.receipts[0]?.failureKeyReadback).not.toBeNull(); expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("captures HTTP rejection without retry/fallback and reads only key metadata afterwards", async () => {
    const s = setup(), original = s.fetcher.getMockImplementation()!;
    s.fetcher.mockImplementation((url, init) => init?.method === "POST" ? Promise.resolve(new Response(secret, { status: 429 })) : original(url, init));
    const result = await s.runner.run(input()); expect(result.inferenceRequests).toBe(1);
    expect(result.receipts[0]?.httpFailure?.httpStatus).toBe(429); expect(JSON.stringify(result)).not.toContain(secret);
    expect(s.fetcher.mock.calls.filter(x => x[1]?.method === "POST")).toHaveLength(1);
  });
  it("stops after 120s, aborts even uncooperative inference, and never starts Sol", async () => {
    vi.useFakeTimers(); const s = setup(), original = s.fetcher.getMockImplementation()!;
    s.fetcher.mockImplementation((url, init) => init?.method === "POST" ? new Promise(() => {}) : original(url, init));
    const work = s.runner.run(input()); await vi.advanceTimersByTimeAsync(120001);
    const result = await work; expect(result.inferenceRequests).toBe(1); expect(result.status).toBe("stopped");
    expect(s.fetcher.mock.calls.find(x => x[1]?.method === "POST")?.[1]?.signal?.aborted).toBe(true);
  });
  it("pre-cancellation dispatches neither claims nor metadata", async () => {
    const s = setup(), controller = new AbortController(); controller.abort();
    expect((await s.runner.run({ ...input(), signal: controller.signal })).inferenceRequests).toBe(0);
    expect(s.claim).not.toHaveBeenCalled(); expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("cannot run concurrently in one instance", async () => {
    const s = setup(), work = s.runner.run(input());
    await expect(s.runner.run(input())).rejects.toThrow(/already attempted/); await work;
    expect(s.state.posts).toBe(2);
  });
  it("persist failure blocks second inference and preserves first receipt in result", async () => {
    const s = setup(); s.persist.mockRejectedValueOnce(new Error(secret));
    const result = await s.runner.run(input()); expect(result.inferenceRequests).toBe(1);
    expect(result.receipts[0]?.answer).toBe("Fictional mock answer"); expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("atomic file controls allow one session across instances, retain tombstones and use 0600", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cu01-pair-mock-")); tempDirectories.push(dir);
    const controls = reviewComparisonFileControls(dir), a = setup(), b = setup();
    const first = createReviewComparison({ ...a.options, ...controls }).run(input());
    const second = createReviewComparison({ ...b.options, ...controls }).run(input());
    const results = await Promise.all([first, second]);
    expect(results.map(r => r.inferenceRequests).sort()).toEqual([0, 2]);
    expect((await stat(path.join(dir, "cu01-v2-session-claimed.json"))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(path.join(dir, "cu01-v2-sol-receipt.json"), "utf8")).arm).toBe("sol");
    await expect(controls.claim("glm", { authorization: REVIEW_PAIR.authorization, messagesSha256: fixture.hash,
      criteriaSha256: REVIEW_PAIR.criteriaSha256, attemptedAt: new Date().toISOString() })).rejects.toThrow();
  });
  it("cancels an in-flight request without dispatching a second model", async () => {
    const s = setup(), original = s.fetcher.getMockImplementation()!, controller = new AbortController();
    s.fetcher.mockImplementation((url, init) => {
      if (init?.method === "POST") { controller.abort(); return new Promise(() => {}); }
      return original(url, init);
    });
    const result = await s.runner.run({ ...input(), signal: controller.signal });
    expect(result.status).toBe("stopped"); expect(result.inferenceRequests).toBe(1);
    expect(s.fetcher.mock.calls.filter(x => x[1]?.method === "POST")).toHaveLength(1);
  });
  it("owner-authorized metadata continuation preserves old session and shares unrepeatable arm claims", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cu01-continuation-mock-")); tempDirectories.push(dir);
    await writeFile(path.join(dir, "cu01-v2-session-claimed.json"), "original session\n");
    await writeFile(path.join(dir, "execution-result-02.json"), JSON.stringify({ status: "stopped", stoppedAt: "glm_prior_billing", inferenceRequests: 0, receipts: [] }));
    const s = setup(), controls = reviewComparisonFileControls(dir, "receipt-identity-03");
    expect((await createReviewComparison({ ...s.options, ...controls }).run(input())).status).toBe("completed");
    expect(await readFile(path.join(dir, "cu01-v2-session-claimed.json"), "utf8")).toBe("original session\n");
    const t = setup();
    expect((await createReviewComparison({ ...t.options, ...controls }).run(input())).inferenceRequests).toBe(0);
    await expect(controls.claim("glm", { authorization: REVIEW_PAIR.authorization, messagesSha256: fixture.hash,
      criteriaSha256: REVIEW_PAIR.criteriaSha256, attemptedAt: new Date().toISOString() })).rejects.toThrow();
  });
  it("never permits metadata continuation after an inference was already dispatched", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cu01-continuation-block-mock-")); tempDirectories.push(dir);
    await writeFile(path.join(dir, "cu01-v2-session-claimed.json"), "original session\n");
    await writeFile(path.join(dir, "execution-result-02.json"), JSON.stringify({ status: "stopped", stoppedAt: "glm_prior_billing", inferenceRequests: 1, receipts: [] }));
    const s = setup();
    expect((await createReviewComparison({ ...s.options, ...reviewComparisonFileControls(dir, "receipt-identity-03") }).run(input())).inferenceRequests).toBe(0);
    expect(s.fetcher).not.toHaveBeenCalled();
  });
  it("Sol-only file controls preserve consumed GLM claims and cannot be reused", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cu01-sol-only-mock-")); tempDirectories.push(dir);
    await writeFile(path.join(dir, "cu01-v2-glm-claimed.json"), "consumed GLM\n");
    await writeFile(path.join(dir, "execution-result-03.json"), JSON.stringify({ status: "stopped", inferenceRequests: 1, receipts: [{
      arm: "glm", dispatched: true, status: "response_received", generationId: "gen-1790025863-e4YCQXHPjndKnXJbzuPm", knownCostUsd: 0.0028659 }] }));
    const s = solSetup(), controls = reviewComparisonFileControls(dir, "sol-only-04");
    expect((await createReviewComparison({ ...s.options, ...controls }).run(input())).status).toBe("completed");
    expect(await readFile(path.join(dir, "cu01-v2-glm-claimed.json"), "utf8")).toBe("consumed GLM\n");
    const t = solSetup();
    expect((await createReviewComparison({ ...t.options, ...controls }).run(input())).inferenceRequests).toBe(0);
    await expect(controls.claim("glm", { authorization: REVIEW_PAIR.authorization, messagesSha256: fixture.hash,
      criteriaSha256: REVIEW_PAIR.criteriaSha256, attemptedAt: new Date().toISOString() })).rejects.toThrow(/GLM/);
  });
  it("bounds hanging preflight and claim callbacks without sending inference", async () => {
    vi.useFakeTimers();
    for (const target of ["preflight", "claim"] as const) {
      const s = setup(); s[target].mockImplementation(() => new Promise<never>(() => {}));
      const work = s.runner.run(input()); await vi.advanceTimersByTimeAsync(30001);
      expect((await work).inferenceRequests).toBe(0); expect(s.post).not.toHaveBeenCalled();
    }
  });
  it("rechecks evidence freshness after a delayed per-call claim", async () => {
    vi.useFakeTimers(); const s = setup();
    s.claim.mockImplementation(async (...args: unknown[]) => {
      if (args[0] === "glm") vi.setSystemTime(Date.now() + 300001);
    });
    expect((await s.runner.run(input())).inferenceRequests).toBe(0);
  });
  it.each(["ok", "not-zdr", "extra-endpoint", "wrong-price", "no-high", "extra-fee", "wrong-canonical", "wrong-endpoint-model"])("public proof reads only fixed unauthenticated catalogs and rejects drift: %s", async variant => {
    const p = proof("sol");
    const endpoint = { tag: "azure", provider_name: "Azure", name: "Azure | openai/gpt-5.6-sol-20260709",
      model_id: variant === "wrong-endpoint-model" ? "openai/gpt-5.6-pro" : p.model,
      status: 0, context_length: 1050000, max_completion_tokens: 128000,
      supported_parameters: ["max_completion_tokens", "reasoning"],
      pricing: { prompt: variant === "wrong-price" ? "0.000004" : "0.000005", completion: "0.00003", input_cache_write: "0.00000625",
        ...(variant === "extra-fee" ? { request: "0.01" } : {}) } };
    const endpoints = variant === "extra-endpoint" ? [endpoint, { ...endpoint, tag: "azure/new-region" }] : [endpoint];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      const u = String(url);
      return new Response(JSON.stringify(u.endsWith("/endpoints/zdr") ? { data: variant === "not-zdr" ? [] : endpoints.map(e => ({ model_id: p.model, tag: e.tag })) } :
        u.endsWith("/endpoints") ? { data: { id: p.model, endpoints } } :
        { data: [{ id: "unrelated-non-reasoning-model", reasoning: null }, { id: "unrelated-effortless-model", reasoning: {} },
          { id: p.model, canonical_slug: variant === "wrong-canonical" ? "openai/gpt-5.6-sol-20990101" : "openai/gpt-5.6-sol-20260709",
            reasoning: { supported_efforts: variant === "no-high" ? [] : ["high"] } }] }));
    });
    const owner = { dedicatedOnlyConsumer: true, autoReload: false, byok: false, promptLogging: false, dataSharing: false, broadcast: false } as const;
    const work = readReviewComparisonPublicProof("sol", { owner, budgetProof: p.budgetProof }, fetcher);
    if (variant === "ok") expect(await work).toMatchObject({ provider: "Azure", eligibleTags: ["azure"], inputWritePrice: 6.25 });
    else await expect(work).rejects.toThrow();
    for (const [, init] of fetcher.mock.calls) { expect(init?.method).toBe("GET"); expect(init).not.toHaveProperty("headers"); expect(init).not.toHaveProperty("body"); }
  });
});
