import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadPublicReviewLaunch } from "./public-review-launch.js";
import { createFixtureVentureReviewTransport } from "./venture-review.js";
const dirs: string[] = [], services: { dispose(): void }[] = [];
afterEach(async () => { services.splice(0).forEach(s => s.dispose()); await Promise.all(dirs.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function harness({ delayed = false, cost = 0.01, completionGate, monthlyCents = 300, balanceSnapshot }: { delayed?: boolean; cost?: number; completionGate?: Promise<void>; monthlyCents?: number; balanceSnapshot?: unknown } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "public-launch-test-")); dirs.push(dir);
  const methodDirectory = path.join(dir, "method"); await mkdir(path.join(methodDirectory, "runtime-2026-10-08"), { recursive: true });
  const version = "sim-aulet-local-2026-10-08", core = "FULL TEST CORE", procedure = "FULL TEST PROCEDURE";
  const artifacts = [];
  for (const [file, content] of [["01-sim-core.md", core], ["runtime-2026-10-08/procedure.md", procedure]]) {
    await writeFile(path.join(methodDirectory, file!), content!); artifacts.push({ file, sha256: createHash("sha256").update(content!).digest("hex") });
  }
  await writeFile(path.join(methodDirectory, "runtime-2026-10-08/manifest.json"), JSON.stringify({ version, artifacts }));
  const fakeKey = "local-mock-value-" + randomUUID(), now = Date.now(), file = path.join(dir, "launch.json");
  const config = { authorizationId: "deterministic-test-only", approvedAt: new Date(now - 1000).toISOString(), publicOrigin: "https://app.sysdom.ai", methodDirectory, budgetDirectory: path.join(dir, "budget"), monthlyCents, runCents: 30, maxConcurrent: 10, trustedProxyAddresses: [], keySha256: createHash("sha256").update(fakeKey).digest("hex"), accountPrivacyVerifiedAt: new Date(now - 1000).toISOString(), noPromptLoggingOrTrainingOrBroadcast: true, automaticReloadDisabled: true, singleReplicaDedicatedKey: true };
  await writeFile(file, JSON.stringify(config));
  const balanceFile = path.join(dir, "account-balance.json");
  if (balanceSnapshot) await writeFile(balanceFile, JSON.stringify(balanceSnapshot));
  const env = { SYSDOM_PUBLIC_REVIEW_LAUNCH_FILE: file, SYSDOM_PUBLIC_REVIEW_API_KEY: fakeKey, ...(balanceSnapshot ? { SYSDOM_PUBLIC_REVIEW_BALANCE_SNAPSHOT_FILE: balanceFile } : {}) };
  let usage = 0;
  const endpoint = { tag: "azure", model_id: "openai/gpt-6.1-sol", provider_name: "Azure", name: "Azure | openai/gpt-6.1-sol-20260929", status: 0, max_prompt_tokens: 65536, max_completion_tokens: 8192, context_length: 131072, supported_parameters: ["reasoning", "max_completion_tokens"], pricing: { prompt: "0.0000025", input_cache_write: "0.0000025", completion: "0.00001" } };
  const posts: any[] = [];
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/endpoints")) return Response.json({ data: { endpoints: [endpoint] } });
    if (u.endsWith("/zdr")) return Response.json({ data: [endpoint] });
    if (u.endsWith("/key")) return Response.json({ data: { limit: monthlyCents / 100, limit_remaining: monthlyCents / 100 - (delayed ? 0 : usage), usage_monthly: delayed ? 0 : usage, limit_reset: "monthly", byok_usage: 0, is_management_key: false, expires_at: null } });
    expect(u).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init?.body)); posts.push(body);
    await completionGate;
    const packet = JSON.parse(body.messages[1].content).evidence;
    const result = await createFixtureVentureReviewTransport().review(packet);
    const summary = { statement: "The founder describes a service business.", evidenceSourceIds: ["founder-note"], confidence: "low", basis: "source_claim" };
    usage += cost;
    return Response.json({ id: "gen-test-only", model: "openai/gpt-6.1-sol", provider: "Azure", choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ...result, rubricVersion: version, businessUnderstanding: summary, strengths: [] }) } }], usage: { prompt_tokens: 3000, completion_tokens: 1000, completion_tokens_details: { reasoning_tokens: 200 }, cost } });
  }) as typeof fetch;
  const launch = await loadPublicReviewLaunch(env, fetcher); services.push(launch!.service);
  async function run() { const s = launch!.service, a = await s.create(); return s.run(a.reviewId, a.accessToken, { question: "Should our service expand?", notes: "We serve weekly customers, but delivery capacity is not established.", consent: true, consentVersion: (await s.capability()).consentVersion, requestId: randomUUID() }); }
  return { posts, run, launch: launch!, config, file, env, fetcher };
}
it("sends full method and approved evidence through the exact bounded route, settles from response cost without blocking other visitors", async () => {
  const h = await harness(); expect((await h.run()).phase).toBe("complete"); expect((await h.run()).phase).toBe("complete");
  expect(h.posts).toHaveLength(2);
  expect(h.posts[0]).toMatchObject({ model: "openai/gpt-6.1-sol", max_completion_tokens: 8192, reasoning: { effort: "high", mode: "standard" }, provider: { only: ["azure"], order: ["azure"], ignore: ["azure/us", "azure/eu"], allow_fallbacks: false, data_collection: "deny", zdr: true } });
  expect(h.posts[0].messages[0].content).toContain("FULL TEST CORE"); expect(h.posts[0].messages[0].content).toContain("FULL TEST PROCEDURE");
  const db = new DatabaseSync(path.join(h.config.budgetDirectory, "service-budget.sqlite"), { readOnly: true });
  const receipt = JSON.stringify(db.prepare("SELECT * FROM attempts").all()); db.close();
  expect(receipt).not.toContain("weekly customers"); expect(receipt).not.toContain(h.env.SYSDOM_PUBLIC_REVIEW_API_KEY);
});
it("serves the next visitor when asynchronous provider totals are delayed", async () => {
  const h = await harness({ delayed: true }); expect((await h.run()).phase).toBe("complete"); expect((await h.run()).phase).toBe("complete"); expect(h.posts).toHaveLength(2);
});
it("retains unknown cost reservations without pausing all other visitors", async () => {
  const h = await harness({ cost: 0 }); expect((await h.run()).phase).toBe("failed"); expect((await h.launch.service.capability()).state).toBe("available"); expect(h.posts).toHaveLength(1);
});
it("rejects future authorization and the old evaluation fingerprint without a provider call", async () => {
  const h = await harness();
  await writeFile(h.file, JSON.stringify({ ...h.config, approvedAt: new Date(Date.now() + 60000).toISOString() }));
  await expect(loadPublicReviewLaunch(h.env, h.fetcher)).rejects.toThrow();
  await writeFile(h.file, JSON.stringify({ ...h.config, keySha256: "a7a424df24ea6de658ccbbe84df7dbe4eafba4a0875a6f4bf1707b56cf51e632" }));
  await expect(loadPublicReviewLaunch(h.env, h.fetcher)).rejects.toThrow(); expect(h.fetcher).not.toHaveBeenCalled();
});

it("runs ten isolated public reviews through the launch transport and reuses refunded capacity", async () => {
  let finish!: () => void;
  const completionGate = new Promise<void>(resolve => { finish = resolve; });
  const h = await harness({ delayed: true, completionGate });
  const pending = Array.from({ length: 10 }, () => h.run());
  await vi.waitFor(() => expect(h.posts).toHaveLength(10));
  expect((await h.launch.service.capability()).state).toBe("busy");
  await expect(h.run()).rejects.toThrow("unavailable");
  expect(new Set(h.posts.map(body => JSON.parse(body.messages[1].content).evidence.tenantId)).size).toBe(10);
  finish();
  expect((await Promise.all(pending)).every(result => result.phase === "complete")).toBe(true);
  expect((await h.launch.service.capability()).state).toBe("available");
  expect((await h.run()).phase).toBe("complete");
  expect(h.posts).toHaveLength(11);
  const metrics = await h.launch.getOperations();
  expect(metrics.service).toMatchObject({ inFlight: 0, queueDepth: 0, counts: { started: 11, completed: 11, failed: 0, cancelled: 0 }, latencyMs: { samples: 11 } });
  expect(metrics.service.latencyMs.p95).toBeGreaterThanOrEqual(metrics.service.latencyMs.p50!);
});

it("exposes safe read-only operations with settled budget thresholds and separately sourced actual credit balance", async () => {
  const h = await harness({ monthlyCents: 10000, balanceSnapshot: { source: "openrouter_account", balanceUsd: 2, observedAt: new Date().toISOString() } });
  const db = new DatabaseSync(path.join(h.config.budgetDirectory, "service-budget.sqlite"));
  const insert = db.prepare("INSERT INTO attempts(id,body_sha256,started,lease_until,state,cost_nanos,charge_month,receipt) VALUES(?,?,?,?,'settled',250000000,?,?)");
  let n = 0;
  for (const threshold of [50, 75, 90]) {
    for (; n < threshold * 4; n++) insert.run(randomUUID(), "a".repeat(64), Date.now(), Date.now(), new Date().toISOString().slice(0, 7), JSON.stringify({ dispatched: true, httpStatus: 200 }));
    const metrics = await h.launch.getOperations();
    expect(metrics.budget).toMatchObject({ monthlyLimitUsd: 100, actualResponseCostUsd: threshold, reservedMaximumUsd: 0 });
    expect(metrics.alerts).toContainEqual({ code: `model_budget_${threshold}`, thresholdUsd: threshold });
    expect(metrics.alerts).toContainEqual({ code: "account_balance_low", thresholdUsd: 5 });
    expect(JSON.stringify(metrics)).not.toMatch(/body_sha256|gen-test|weekly customers/);
    expect(JSON.stringify(metrics)).not.toContain(h.env.SYSDOM_PUBLIC_REVIEW_API_KEY);
  }
  db.close();
  await writeFile(h.env.SYSDOM_PUBLIC_REVIEW_BALANCE_SNAPSHOT_FILE!, JSON.stringify({ source: "openrouter_account", balanceUsd: 80, observedAt: new Date(Date.now() - 2 * 86400000).toISOString() }));
  expect((await h.launch.getOperations()).alerts).toContainEqual({ code: "account_balance_stale" });
  expect(vi.mocked(h.fetcher).mock.calls.every(([url, init]) => String(url).endsWith("/key") && init?.method === "GET")).toBe(true);
  expect(h.posts).toHaveLength(0);
});
it("does not mistake an absent credit balance for the monthly allowance", async () => {
  const h = await harness({ monthlyCents: 10000 });
  expect((await h.launch.getOperations()).accountBalance).toEqual({ state: "unavailable", balanceUsd: null, observedAt: null });
  expect(vi.mocked(h.fetcher).mock.calls.every(([url, init]) => String(url).endsWith("/key") && init?.method === "GET")).toBe(true);
  expect(h.posts).toHaveLength(0);
});
