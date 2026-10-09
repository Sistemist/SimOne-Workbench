import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCu01WireRequest, createCu01OneShot, cu01FileClaim, CU01_LIMITS, selectApprovedCu01Messages } from "./venture-review-one-shot.js";

const fixture = vi.hoisted(() => ({
  messages: [{ role: "system", content: "Synthetic method fixture" }, { role: "user", content: "Synthetic evidence fixture" }],
  approvedDigest: "2eb53bbfee4826b5ecb96f0bb1ecfd0c3f34b00b857baa31452785c1c4b868a1",
}));
// Only this exact synthetic input stands in for the sealed private CU01 digest.
// All other hashes use real SHA-256. Never copy the private method into CI fixtures.
// The actual ignored CU01 file is separately verified locally with unmocked crypto.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, createHash: (...args: Parameters<typeof actual.createHash>) => {
    const hash = actual.createHash(...args);
    const update = hash.update.bind(hash);
    const digest = hash.digest.bind(hash);
    let synthetic = false;
    hash.update = ((data: unknown, ...rest: unknown[]) => {
      synthetic = data === JSON.stringify(fixture.messages);
      return Reflect.apply(update, hash, [data, ...rest]);
    }) as typeof hash.update;
    hash.digest = ((encoding?: string) => synthetic && encoding === "hex" ? fixture.approvedDigest : Reflect.apply(digest, hash, [encoding])) as typeof hash.digest;
    return hash;
  } };
});

const nowMs = Date.parse("2026-09-21T20:00:00.000Z");
const apiKey = "synthetic-test-key-not-a-credential";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
function input(overrides: Record<string, unknown> = {}) {
  return { messages: fixture.messages, apiKey, preflight: {
    verifiedAt: new Date(nowMs).toISOString(), evidenceRef: "synthetic-account-readback",
    keySha256: sha(apiKey), messagesSha256: fixture.approvedDigest,
    keyLimitUsd: 3, keyRemainingUsd: 3, keyUsageUsd: 0, keyLimitReset: null,
    dedicatedOnlyConsumer: true, autoReload: false, byokDisabled: true,
    promptLogging: false, dataSharing: false, broadcast: false,
    provider: "fireworks", model: CU01_LIMITS.model, endpointEligible: true, noTrainingOrPersistentContent: true,
    inputTokensIncludingTemplate: 100, contextTokens: 1_048_576, generatedTokenLimitIncludesReasoning: true,
    tokenBoundEvidenceRef: "synthetic-token-bound-proof", ...overrides,
  } };
}
function response() {
  return { id: "gen-synthetic", model: String(CU01_LIMITS.model), provider: "Fireworks",
    choices: [{ finish_reason: "stop", message: { content: "Synthetic answer" } }],
    usage: { prompt_tokens: 100, completion_tokens: 80, completion_tokens_details: { reasoning_tokens: 60 }, cost: 0.001 } };
}
function setup(raw: unknown = response()) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 }));
  const claim = vi.fn(async () => {});
  return { fetcher, claim, runner: createCu01OneShot({ fetcher, claim, now: () => nowMs }) };
}
const tempDirectories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  // Only exact mkdtemp-created test directories; never a workspace/user directory.
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CU01 local one-shot controls (mock transport only)", () => {
  it("pins the entire wire request without tools, retries, presets or fallback models", () => {
    expect(JSON.parse(buildCu01WireRequest(fixture.messages).serializedBody)).toEqual({
      model: "z-ai/glm-5.3-flash", messages: fixture.messages, stream: false, max_tokens: 8192,
      reasoning: { effort: "low", exclude: true }, provider: { only: ["fireworks"], allow_fallbacks: false,
        require_parameters: true, data_collection: "deny", zdr: true, max_price: { prompt: 0.15, completion: 0.5 } },
    });
  });

  it("selects messages only, never the evaluator reference or envelope metadata", () => {
    const selected = selectApprovedCu01Messages({ evaluatorOnly: "PRIVATE REFERENCE", inputs: [
      { caseId: "CU01", arm: "sim", messages: fixture.messages, evaluatorOnly: "PRIVATE ANSWER" },
      { caseId: "CU01", arm: "baseline", messages: ["NOT SELECTED"] },
    ] });
    expect(selected).toEqual(fixture.messages);
    expect(JSON.stringify(selected)).not.toMatch(/PRIVATE|NOT SELECTED/);
    selected[0].content = "changed";
    expect(() => selectApprovedCu01Messages({ inputs: [{ caseId: "CU01", arm: "sim", messages: selected }] })).toThrow(/integrity/);
    expect(() => selectApprovedCu01Messages({ inputs: [] })).toThrow(/Exactly one/);
    expect(() => selectApprovedCu01Messages({ inputs: [1, 2].map(() => ({ caseId: "CU01", arm: "sim", messages: fixture.messages })) })).toThrow(/Exactly one/);
  });

  it("rejects oversize inputs without truncation and forbids extra message fields/roles", () => {
    expect(() => buildCu01WireRequest([{ role: "system", content: "é".repeat(32768) }, fixture.messages[1]])).toThrow(/byte bound/);
    expect(() => buildCu01WireRequest([{ ...fixture.messages[0], evaluatorOnly: "reference" }, fixture.messages[1]])).toThrow();
    expect(() => buildCu01WireRequest([...fixture.messages, { role: "assistant", content: "reference" }])).toThrow();
  });

  it("makes exactly one request, returns answer separately and still requires ledger reconciliation", async () => {
    const { runner, fetcher, claim } = setup();
    const result = await runner.run(input());
    expect(result).toMatchObject({ status: "response_received", answer: "Synthetic answer", requestId: "gen-synthetic",
      reconciliation: "provider_ledger_check_required", furtherRequestsAllowed: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({ method: "POST", redirect: "error",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }));
    expect(claim).toHaveBeenCalledWith({ bodySha256: buildCu01WireRequest(fixture.messages).bodySha256, attemptedAt: new Date(nowMs).toISOString() });
    expect(JSON.stringify(result)).not.toContain(apiKey);
    await expect(runner.run(input())).rejects.toThrow(/already consumed/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { keyLimitUsd: 0 }, { keyLimitUsd: 3.01 }, { keyRemainingUsd: 0.01 }, { keyRemainingUsd: 3, keyUsageUsd: 1 },
    { keyLimitReset: "monthly" }, { dedicatedOnlyConsumer: false }, { autoReload: true }, { byokDisabled: false },
    { promptLogging: true }, { dataSharing: true }, { broadcast: true }, { endpointEligible: false },
    { noTrainingOrPersistentContent: false }, { generatedTokenLimitIncludesReasoning: false }, { tokenBoundEvidenceRef: "" },
    { inputTokensIncludingTemplate: 32769 }, { contextTokens: 40959 }, { provider: "other" }, { model: "auto" },
    { keySha256: "a".repeat(64) }, { messagesSha256: "a".repeat(64) },
    { verifiedAt: new Date(nowMs - 300001).toISOString() }, { verifiedAt: new Date(nowMs + 1).toISOString() },
    { evidenceRef: "" }, { unexpected: true },
  ])("blocks failed/unknown account or token evidence before claiming or dispatch: %j", async (override) => {
    const { runner, fetcher, claim } = setup();
    expect(await runner.run(input(override))).toMatchObject({ status: "stopped", dispatched: false, reconciliation: "not_dispatched" });
    expect(claim).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects missing preflight and a changed approved packet", async () => {
    for (const candidate of [{ ...input(), preflight: {} }, { ...input(), messages: [{ ...fixture.messages[0], content: "altered" }, fixture.messages[1]] }]) {
      const { runner, fetcher } = setup();
      expect(await runner.run(candidate)).toMatchObject({ status: "stopped", dispatched: false });
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("reserves synchronously against concurrent calls", async () => {
    const { runner, fetcher } = setup();
    const first = runner.run(input());
    await expect(runner.run(input())).rejects.toThrow(/consumed/);
    await first; expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cannot swap credentials or transport after validating the capped key", async () => {
    const { fetcher } = setup();
    const replacement = vi.fn<typeof fetch>();
    let release!: () => void;
    const options = { fetcher, claim: () => new Promise<void>((resolve) => { release = resolve; }), now: () => nowMs };
    const runner = createCu01OneShot(options);
    const candidate = input();
    const work = runner.run(candidate);
    candidate.apiKey = "different-uncapped-synthetic-key";
    options.fetcher = replacement;
    release();
    expect(await work).toHaveProperty("status", "response_received");
    expect(fetcher.mock.calls[0]![1]!.headers).toEqual({ Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" });
    expect(replacement).not.toHaveBeenCalled();
  });

  it("retains an atomic disk claim across instances, even after a rejected request", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "cu01-one-shot-test-")); tempDirectories.push(directory);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("not eligible", { status: 400 }));
    const make = () => createCu01OneShot({ fetcher, claim: cu01FileClaim(directory), now: () => nowMs });
    const results = await Promise.all([make().run(input()), make().run(input())]);
    expect(results.filter((result) => result.status === "stopped" && result.dispatched)).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await make().run(input())).toMatchObject({ status: "stopped", dispatched: false });
    const filename = path.join(directory, "cu01-glm-5.3-flash-consumed.json");
    expect((await stat(filename)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(filename, "utf8"))).toEqual({ bodySha256: buildCu01WireRequest(fixture.messages).bodySha256, attemptedAt: new Date(nowMs).toISOString() });
  });

  it("does not dispatch if claim fails or evidence expires during claim", async () => {
    const { fetcher } = setup();
    let clock = nowMs;
    const runner = createCu01OneShot({ fetcher, now: () => clock, claim: async () => { clock += 300001; } });
    expect(await runner.run(input())).toMatchObject({ status: "stopped", dispatched: false });
    const failed = createCu01OneShot({ fetcher, now: () => nowMs, claim: async () => { throw new Error("disk full"); } });
    expect(await failed.run(input())).toMatchObject({ status: "stopped", dispatched: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("honors cancellation before claiming", async () => {
    const { runner, fetcher, claim } = setup(); const controller = new AbortController(); controller.abort();
    expect(await runner.run({ ...input(), signal: controller.signal })).toMatchObject({ status: "stopped", dispatched: false, reason: "cancelled_or_timed_out" });
    expect(claim).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["claim", "fetch", "body"])("times out at 120 seconds while %s ignores cancellation, with no retry", async (phase) => {
    vi.useFakeTimers();
    const stuck = new Promise<never>(() => {});
    const claim = vi.fn(async () => { if (phase === "claim") await stuck; });
    const fetcher = vi.fn<typeof fetch>(async () => {
      if (phase === "fetch") return stuck;
      return { ok: true, json: () => stuck } as unknown as Response;
    });
    const runner = createCu01OneShot({ fetcher, claim, now: () => nowMs });
    const work = runner.run(input());
    await vi.advanceTimersByTimeAsync(120000);
    expect(await work).toMatchObject({ status: "stopped", dispatched: phase !== "claim", reason: "cancelled_or_timed_out" });
    expect(fetcher).toHaveBeenCalledTimes(phase === "claim" ? 0 : 1);
    await expect(runner.run(input())).rejects.toThrow(/consumed/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels an in-flight ignoring fetch and ignores its late answer", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => { finish = resolve; }));
    const controller = new AbortController();
    const runner = createCu01OneShot({ fetcher, claim: async () => {}, now: () => nowMs });
    const work = runner.run({ ...input(), signal: controller.signal });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    controller.abort();
    const result = await work;
    expect(result).toMatchObject({ status: "stopped", dispatched: true, reconciliation: "provider_ledger_check_required" });
    finish(new Response(JSON.stringify(response())));
    await Promise.resolve(); expect(result).not.toHaveProperty("answer");
    await expect(runner.run(input())).rejects.toThrow(/consumed/);
  });

  it.each([400, 401, 429, 500])("never retries HTTP %i or includes error-body secrets", async (status) => {
    const { runner, fetcher } = setup(); fetcher.mockResolvedValue(new Response(apiKey, { status }));
    const result = await runner.run(input());
    expect(result).toMatchObject({ status: "stopped", dispatched: true, knownCostUsd: null });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(JSON.stringify(result)).not.toContain(apiKey);
  });

  it("returns sanitized 429 diagnostics without retrying or relaxing the route", async () => {
    const { runner, fetcher } = setup();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { code: 429, message: "Rate limit exceeded",
      metadata: { error_type: "rate_limit_exceeded", provider_code: "rate_limited", raw: apiKey } } }),
    { status: 429, headers: { "retry-after": "20", "x-request-id": "req-example" } }));
    expect(await runner.run(input())).toMatchObject({ status: "stopped", dispatched: true, requestId: null,
      httpFailure: { httpStatus: 429, requestId: "req-example", code: 429, providerCode: "rate_limited", retryAfter: "20" },
      furtherRequestsAllowed: false, reconciliation: "provider_ledger_check_required" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(runner.run(input())).rejects.toThrow(/consumed/);
  });

  it("bounds error-body reads by the original request timeout and retains safe headers", async () => {
    vi.useFakeTimers();
    try {
      const { runner, fetcher } = setup();
      fetcher.mockResolvedValue(new Response(new ReadableStream({ pull: () => new Promise(() => {}) }),
        { status: 429, headers: { "retry-after": "15" } }));
      const work = runner.run(input());
      await vi.advanceTimersByTimeAsync(120000);
      expect(await work).toMatchObject({ status: "stopped", reason: "cancelled_or_timed_out",
        httpFailure: { httpStatus: 429, retryAfter: "15", bodyStatus: "aborted" } });
      expect(fetcher).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it.each([
    ["missing cost", (r: ReturnType<typeof response>) => { Reflect.deleteProperty(r.usage, "cost"); }],
    ["zero cost", (r: ReturnType<typeof response>) => { r.usage.cost = 0; }],
    ["over budget", (r: ReturnType<typeof response>) => { r.usage.cost = 0.03; }],
    ["wrong model", (r: ReturnType<typeof response>) => { r.model = "other"; }],
    ["wrong provider", (r: ReturnType<typeof response>) => { r.provider = "other"; }],
    ["too many input tokens", (r: ReturnType<typeof response>) => { r.usage.prompt_tokens = 32769; }],
    ["too many generated tokens", (r: ReturnType<typeof response>) => { r.usage.completion_tokens = 8193; }],
    ["inconsistent reasoning", (r: ReturnType<typeof response>) => { r.usage.completion_tokens_details.reasoning_tokens = 81; }],
    ["unknown reasoning", (r: ReturnType<typeof response>) => { Reflect.deleteProperty(r.usage, "completion_tokens_details"); }],
    ["truncated answer", (r: ReturnType<typeof response>) => { r.choices[0]!.finish_reason = "length"; }],
    ["empty answer", (r: ReturnType<typeof response>) => { r.choices[0]!.message.content = " "; }],
    ["tool call", (r: ReturnType<typeof response>) => { Object.assign(r.choices[0]!.message, { tool_calls: [{ id: "tool" }] }); }],
    ["function call", (r: ReturnType<typeof response>) => { Object.assign(r.choices[0]!.message, { function_call: { name: "tool" } }); }],
    ["multiple choices", (r: ReturnType<typeof response>) => { r.choices.push(r.choices[0]!); }],
  ] as const)("stops on %s and requires external reconciliation, without exposing an answer", async (_label, mutate) => {
    const raw = response(); mutate(raw); const { runner, fetcher } = setup(raw);
    const result = await runner.run(input());
    expect(result).toMatchObject({ status: "stopped", dispatched: true, reconciliation: "provider_ledger_check_required", furtherRequestsAllowed: false });
    expect(result).not.toHaveProperty("answer"); expect(fetcher).toHaveBeenCalledTimes(1);
    if (_label === "over budget") expect(result).toHaveProperty("knownCostUsd", 0.03);
  });
});
