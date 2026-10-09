import { afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { PublicVentureReview } from "./public-venture-review.js";
import { createFixtureVentureReviewTransport, type VentureReviewTransport } from "./venture-review.js";
import { loadPublicReviewLaunch } from "./public-review-launch.js";
import { publicVentureReviewRoutes } from "../routes/public-venture-review.js";
import { publicReviewPage, publicReviewHtml } from "../public-review-page.js";

const services: PublicVentureReview[] = [], directories: string[] = [];
const note = "We offer a weekly service; demand increased but delivery capacity is unknown.";
function service(overrides: Partial<ConstructorParameters<typeof PublicVentureReview>[0]> = {}) {
  const t = createFixtureVentureReviewTransport(), review = vi.spyOn(t, "review");
  const network = { lookup: vi.fn(async () => [{ address: "93.184.216.34" }]), request: vi.fn(async (_input: { url: URL }) => ({ status: 200, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode("Public offer claim, not verified revenue.") })) };
  const s = new PublicVentureReview({ mode: "recorded", maxConcurrent: 1, methodVersion: "m1-draft-2026-09-21", transport: () => t, availability: async () => "available", recipients: ["Local fixture"], retention: "15 minutes", websiteNetwork: network, ...overrides });
  services.push(s); return { s, review, network };
}
async function input(s: PublicVentureReview, extra = {}) { return { question: "Should we expand?", notes: note, consent: true, consentVersion: (await s.capability()).consentVersion, requestId: randomUUID(), ...extra }; }
afterEach(async () => { services.splice(0).forEach(s => s.dispose()); await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
it("is inert without explicit launch configuration and never touches fetch", async () => {
  const fetcher = vi.fn(); expect(await loadPublicReviewLaunch({}, fetcher)).toBeUndefined(); expect(fetcher).not.toHaveBeenCalled();
});
it("binds terms and denies missing consent, other tokens, injected identities and unread sources", async () => {
  const { s, review } = service(), a = await s.create(), b = await s.create();
  expect(() => s.get(a.reviewId, b.accessToken)).toThrow();
  for (const extra of [{ consent: false }, { consentVersion: "old" }, { tenantId: randomUUID() }, { selectedSourceIds: ["public-0"] }]) {
    await expect(s.run(a.reviewId, a.accessToken, await input(s, extra))).rejects.toThrow();
  }
  expect(review).not.toHaveBeenCalled();
});
it("reads bounded optional public sources, excludes content, and preserves selected provenance", async () => {
  const { s, review, network } = service(), a = await s.create();
  const sources = await s.inspect(a.reviewId, a.accessToken, { website: "https://example.com/", github: "https://github.com/example/project" });
  expect(review).not.toHaveBeenCalled(); expect(sources).toHaveLength(2);
  expect(network.request.mock.calls[1]?.[0]).toMatchObject({ url: new URL("https://raw.githubusercontent.com/example/project/HEAD/README.md") });
  expect((await s.run(a.reviewId, a.accessToken, await input(s, { selectedSourceIds: ["public-1"], sourceHashes: { "public-1": sources[1]!.sha256 } }))).phase).toBe("complete");
  const packet = review.mock.calls[0]![0];
  expect(packet.sources.map(x => x.id)).toEqual(["founder-note", "public-1"]);
  expect(packet.sources[1]?.provenance?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(packet)).not.toContain("https://example.com");
});
it("rejects private destinations, query credentials and repository traversal before retrieval", async () => {
  const { s, network } = service(), a = await s.create();
  for (const bad of [{ website: "http://127.0.0.1/" }, { website: "https://example.com/?secret=x" }, { github: "https://github.com/a/b/blob/main/file" }]) await expect(s.inspect(a.reviewId, a.accessToken, bad)).rejects.toThrow();
  expect(network.request).not.toHaveBeenCalled();
});
it("enforces the configured one-slot capacity, cancels immediately, and never retries an unresponsive transport", async () => {
  const review = vi.fn(() => new Promise<never>(() => {}));
  const recordOutcome = vi.fn();
  const { s } = service({ transport: () => ({ review, recordOutcome }) });
  const a = await s.create(), b = await s.create();
  const run = s.run(a.reviewId, a.accessToken, await input(s));
  await vi.waitFor(() => expect(review).toHaveBeenCalledOnce());
  await expect(s.run(b.reviewId, b.accessToken, await input(s))).rejects.toThrow();
  s.cancel(a.reviewId, a.accessToken);
  expect((await run).phase).toBe("cancelled"); expect(review).toHaveBeenCalledOnce();
  expect(recordOutcome).toHaveBeenCalledWith({ phase: "cancelled", failureStage: "cancelled" });
  await expect(s.run(a.reviewId, a.accessToken, await input(s))).rejects.toThrow();
});
it("times out without a fallback and rejects expired capabilities", async () => {
  let now = Date.now(); const review = vi.fn(() => new Promise<never>(() => {}));
  const recordOutcome = vi.fn();
  const { s } = service({ timeoutMs: 10, now: () => now, transport: () => ({ review, recordOutcome }) });
  const a = await s.create(); expect((await s.run(a.reviewId, a.accessToken, await input(s))).phase).toBe("failed"); expect(review).toHaveBeenCalledOnce();
  expect(recordOutcome).toHaveBeenCalledWith({ phase: "failed", failureStage: "timeout" });
  now += 900001; expect(() => s.get(a.reviewId, a.accessToken)).toThrow();
});
it("rejects fresh route drift before dispatch and never labels fresh output recorded", async () => {
  const review = vi.fn(); const transport = { review, execution: { mode: "fresh", provider: "openrouter/azure", model: "openai/gpt-6.1-sol", reasoningEffort: "high" } } as VentureReviewTransport;
  const { s } = service({ transport: () => transport }); const a = await s.create();
  expect((await s.run(a.reviewId, a.accessToken, await input(s))).phase).toBe("failed"); expect(review).not.toHaveBeenCalled();
  const { s: fresh } = service({ mode: "fresh", transport: () => ({ review }) }); const b = await fresh.create();
  expect((await fresh.run(b.reviewId, b.accessToken, await input(fresh))).phase).toBe("failed"); expect(review).not.toHaveBeenCalled();
});
it("fails closed on global availability and suspected credentials", async () => {
  const { s } = service({ availability: async () => "exhausted" }); await expect(s.create()).rejects.toThrow();
  const { s: other, review } = service(); const a = await other.create();
  await expect(other.run(a.reviewId, a.accessToken, await input(other, { notes: note + " password=do-not-send" }))).rejects.toThrow();
  expect(review).not.toHaveBeenCalled();
});
it("serves anonymous capabilities with origin, size and token guards, and cancellation survives throttling", async () => {
  const { s } = service(), app = express(); app.use(express.json({ limit: "32kb" })); app.use("/api", publicVentureReviewRoutes({ service: s, publicOrigin: "https://app.sysdom.ai" }));
  const base = "/api/public/venture-review";
  expect((await request(app).post(base + "/sessions").send({})).status).toBe(403);
  const created = await request(app).post(base + "/sessions").set("Origin", "https://app.sysdom.ai").send({});
  expect(created.status).toBe(201); const id = created.body.reviewId, token = created.body.accessToken;
  expect((await request(app).get(base + "/sessions/" + id)).status).toBe(404);
  expect((await request(app).get(base + "/capability?token=x")).status).toBe(400);
  for (let i = 0; i < 181; i++) await request(app).get(base + "/capability");
  const cancelled = await request(app).post(base + "/sessions/" + id + "/cancel").set("Origin", "https://app.sysdom.ai").auth(token, { type: "bearer" }).send({});
  expect(cancelled.status).toBe(200); expect(cancelled.body.phase).toBe("cancelled"); expect(cancelled.headers["cache-control"]).toBe("no-store");
  expect(s.metrics().httpStatuses[429]).toBeGreaterThan(0);
  expect(s.metrics().httpStatuses[403]).toBe(1);
});
it("redirects legacy URLs in one permanent hop without losing queries or exposing them in metadata", async () => {
  const app = express(); app.use(publicReviewPage); app.get("/venture-review", (req, res) => res.send(publicReviewHtml("<head><title>Old</title></head>", req.originalUrl)));
  const query = "?scan=private%2Fid&utm_source=linkedin&x=a%20b";
  const r = await request(app).get("/scanner" + query); expect(r.status).toBe(308); expect(r.headers.location).toBe("/venture-review" + query);
  const legacyHost = await request(app).get("/scanner" + query).set("Host", "sim.sysdom.org");
  expect(legacyHost.headers.location).toBe("https://app.sysdom.ai/venture-review" + query);
  const page = await request(app).get(r.headers.location);
  expect(page.headers["x-robots-tag"]).toBe("noindex, nofollow"); expect(page.text).toContain('href="https://app.sysdom.ai/venture-review"'); expect(page.text).not.toContain("private%2Fid");
});

it("rejects a stale source preview after a second retrieval", async () => {
  const { s, network, review } = service(), a = await s.create();
  const first = await s.inspect(a.reviewId, a.accessToken, { website: "https://example.com/" });
  network.request.mockResolvedValueOnce({ status: 200, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode("Changed text, not approved.") });
  await s.inspect(a.reviewId, a.accessToken, { website: "https://example.com/" });
  await expect(s.run(a.reviewId, a.accessToken, await input(s, { selectedSourceIds: ["public-0"], sourceHashes: { "public-0": first[0]!.sha256 } }))).rejects.toThrow();
  expect(review).not.toHaveBeenCalled();
});
it("does not put review URLs or API responses into the offline cache", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  vm.runInNewContext(await readFile(new URL("../../../ui/public/sw.js", import.meta.url), "utf8"), { URL, self: { addEventListener: (key: string, handler: (event: any) => void) => { handlers[key] = handler; } } });
  for (const url of ["https://app.sysdom.ai/venture-review?scan=private", "https://app.sysdom.ai/scanner", "https://app.sysdom.ai/api/public/venture-review/sessions/id"]) {
    const respondWith = vi.fn(); handlers.fetch!({ request: { method: "GET", url }, respondWith }); expect(respondWith).not.toHaveBeenCalled();
  }
});

it("isolates ten simultaneous anonymous reviews and makes duplicate submissions idempotent", async () => {
  const fixture = createFixtureVentureReviewTransport();
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  const review = vi.fn(async (packet: Parameters<typeof fixture.review>[0], signal?: AbortSignal) => { await gate; return fixture.review(packet, signal); });
  const { s } = service({ maxConcurrent: 10, transport: () => ({ review }) });
  const sessions = await Promise.all(Array.from({ length: 11 }, () => s.create()));
  const inputs = await Promise.all(sessions.map((_, i) => input(s, { notes: note + " Venture " + i })));
  const runs = sessions.slice(0, 10).map((a, i) => s.run(a.reviewId, a.accessToken, inputs[i]));
  await vi.waitFor(() => expect(review).toHaveBeenCalledTimes(10));
  expect((await s.run(sessions[0]!.reviewId, sessions[0]!.accessToken, inputs[0])).phase).toBe("running");
  await expect(s.run(sessions[10]!.reviewId, sessions[10]!.accessToken, inputs[10])).rejects.toThrow();
  release(); const results = await Promise.all(runs);
  expect(results.every(r => r.phase === "complete")).toBe(true);
  expect(new Set(results.map(r => r.result!.tenantId)).size).toBe(10);
  expect((await s.run(sessions[0]!.reviewId, sessions[0]!.accessToken, inputs[0])).phase).toBe("complete");
  expect(review).toHaveBeenCalledTimes(10);
});
it("accepts shared-office bursts but ignores spoofed forwarded IPs unless the socket is an exact trusted proxy", async () => {
  const base = "/api/public/venture-review";
  for (const trusted of [false, true]) {
    const { s } = service({ maxConcurrent: 10 }), app = express();
    // Even an overly broad global Express setting must not make this route trust spoofed IPs.
    app.set("trust proxy", true); app.use(express.json());
    app.use("/api", publicVentureReviewRoutes({ service: s, publicOrigin: "https://app.sysdom.ai", trustedProxyAddresses: trusted ? ["127.0.0.1", "::1"] : [] }));
    for (let i = 0; i < 30; i++) expect((await request(app).post(base + "/sessions").set("Origin", "https://app.sysdom.ai").set("X-Real-IP", "198.51.100.1").send({})).status).toBe(201);
    const r = await request(app).post(base + "/sessions").set("Origin", "https://app.sysdom.ai").set("X-Real-IP", "198.51.100.2").set("X-Forwarded-For", "198.51.100.3").send({});
    expect(r.status).toBe(trusted ? 201 : 429);
  }
});
