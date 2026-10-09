import express from "express";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ventureReviewShareDraftSchema, ventureReviewResultSchema } from "@paperclipai/shared";
import { VentureReviewExchange } from "../services/venture-review-exchange.js";
import { createRecordedVentureReviewTransport } from "../services/venture-review.js";
import { ventureReviewRoutes } from "../routes/venture-review.js";
import { providerMockOptions } from "../services/venture-review-provider-mock.js";
import { createProviderVentureReviewTransport, reviewProviderFileControls, VENTURE_REVIEW_WORKING_ROUTE } from "../services/venture-review-provider.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const example = JSON.parse(await readFile(path.join(root, "evals/fixtures/venture-review-cu01-demo.json"), "utf8"));
example.draft = ventureReviewShareDraftSchema.parse(example.draft);
example.result = ventureReviewResultSchema.parse(example.result);
const transport = createRecordedVentureReviewTransport(example);
const review = vi.spyOn(transport, "review");
const audit = vi.fn(async () => {});
const exchange = new VentureReviewExchange({
  mode: "mock_only", transport, recipients: ["Local recorded fixture"], purpose: "Fictional host rehearsal",
  sessionTtlMs: 60_000, maxSessions: 30, reviewTimeoutMs: 1000,
  websitePolicy: { maxPages: 1, maxBytesPerPage: 1000, maxCharsPerPage: 1000, maxRedirects: 0, timeoutMs: 1000 },
  websiteNetwork: { lookup: async () => { throw new Error("No website requests"); }, request: async () => { throw new Error("No website requests"); } },
});
let server: Server;
let origin: string;
let temp: string;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function run(command: string, input: unknown, approval?: string, endpoint = origin, fresh = false) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(temp, "review.mjs"), command, "--origin", endpoint, "--fictional-only", ...(fresh ? ["--fresh-review"] : []), ...(approval ? ["--approve", approval] : [])], {
      cwd: temp, env: { PATH: path.dirname(process.execPath) }, timeout: 15_000,
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}
async function preview(draft = example.draft) {
  const output = await run("preview", { question: example.question, draft });
  expect(output.code, output.stderr).toBe(0);
  return JSON.parse(output.stdout);
}
beforeAll(async () => {
  temp = await mkdtemp(path.join(tmpdir(), "sysdom-host-test-"));
  await copyFile(path.join(root, "integrations/codex-plugins/sysdom-venture-review/scripts/review.mjs"), path.join(temp, "review.mjs"));
  const app = express();
  app.use(express.json({ limit: "600kb" }));
  app.use((req, _res, next) => {
    req.actor = { type: "board", userId: "fictional-founder", source: "session", companyIds: ["11111111-1111-4111-8111-111111111111"] };
    next();
  });
  app.use("/api", ventureReviewRoutes({ exchange, audit, maxRequestsPerMinute: 100 }));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local listener");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  exchange.dispose(); server?.closeAllConnections();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (temp) await rm(temp, { recursive: true, force: true });
});

describe("packaged local host command", () => {
  it("opts into fresh Sol High mode through the governed transport with all provider IO intercepted", async () => {
    const ps02 = JSON.parse(await readFile(path.join(root, "evals/fixtures/venture-review-ps02-oct08-demo.json"), "utf8"));
    const method = { version: "sim-aulet-local-2026-10-08", status: "provisional_local" as const,
      core: "PRIVATE COMPLETE CORE test sentinel", procedure: "PRIVATE COMPLETE PROCEDURE test sentinel", coreSha256: "a".repeat(64), procedureSha256: "b".repeat(64) };
    const mock = providerMockOptions(method, ps02), apiKey = "FICTIONAL-KEY-NOT-A-CREDENTIAL";
    const runDirectory = path.join(temp, "fresh-mode-intercepted");
    const controls = reviewProviderFileControls(runDirectory, "fictional-ps02-mock-only");
    const contract = { ...mock.contract, model: VENTURE_REVIEW_WORKING_ROUTE.model, reasoningEffort: VENTURE_REVIEW_WORKING_ROUTE.reasoningEffort,
      providerRouting: { ...mock.contract.providerRouting, maxInputUsdPerMillion: 2.5, maxOutputUsdPerMillion: 10 } };
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ model: contract.model, reasoning: { effort: "high", mode: "standard" }, max_completion_tokens: 8192,
        provider: { only: ["azure"], ignore: ["azure/us", "azure/eu"], allow_fallbacks: false, zdr: true, data_collection: "deny" } });
      expect(body).not.toHaveProperty("max_tokens");
      expect(body.messages[0].content).toContain(method.core); expect(body.messages[0].content).toContain(method.procedure);
      expect(body.messages[1].content).not.toContain(ps02.result.nextTest.action);
      const raw = await (await mock.fetcher("mock://venture-review/openrouter", { ...init, headers: {} })).json();
      // Exercise a response beyond the old helper's ten-second cutoff; no network call.
      await new Promise((resolve) => setTimeout(resolve, 10_100));
      return new Response(JSON.stringify({ ...raw, model: contract.model, provider: "Azure" }));
    });
    const provider = createProviderVentureReviewTransport({ ...mock, contract, mode: "fresh", apiKey, providerTag: "azure", providerName: "Azure",
      tokenParameter: "max_completion_tokens", maxRunCostCents: 60, timeoutMs: 120_000, fetcher, ...controls,
      preflight: async (bodySha256) => {
        const proof = await mock.preflight(bodySha256);
        return { ...proof, providerTag: "azure", model: contract.model, keySha256: createHash("sha256").update(apiKey).digest("hex"), providerRemainingCents: 60,
          policy: { ...proof.policy, model: contract.model, maxRunCostCents: 60, providerHardCapCents: 60 } };
      } });
    const freshExchange = new VentureReviewExchange({ mode: "fresh", transport: provider, recipients: ["Intercepted local test only; no provider called"], purpose: "Fictional fresh-mode wiring test",
      sessionTtlMs: 60_000, maxSessions: 5, reviewTimeoutMs: 120_000,
      websitePolicy: { maxPages: 1, maxBytesPerPage: 1000, maxCharsPerPage: 1000, maxRedirects: 0, timeoutMs: 1000 },
      websiteNetwork: { lookup: async () => { throw new Error("No IO"); }, request: async () => { throw new Error("No IO"); } } });
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.actor = { type: "board", userId: "fictional-founder", source: "session", companyIds: ["11111111-1111-4111-8111-111111111111"] }; next(); });
    app.use("/api", ventureReviewRoutes({ exchange: freshExchange, audit: async () => {}, maxRequestsPerMinute: 100 }));
    const local = createServer(app); await new Promise<void>((resolve) => local.listen(0, "127.0.0.1", resolve));
    const address = local.address(); if (!address || typeof address === "string") throw new Error("No listener");
    const endpoint = `http://127.0.0.1:${address.port}`;
    try {
      const input = { question: ps02.question, draft: ps02.draft };
      expect((await run("preview", input, undefined, endpoint)).code).toBe(1);
      const previewed = await run("preview", input, undefined, endpoint, true);
      expect(previewed.code, previewed.stderr).toBe(0);
      const packet = JSON.parse(previewed.stdout);
      expect(packet.preview.session).toMatchObject({ mockOnly: false, execution: { mode: "fresh", model: contract.model, reasoningEffort: "high" } });
      expect((await run("submit", packet, packet.approvalSha256, endpoint)).code).toBe(1);
      for (const edit of [{ model: "other/model" }, { reasoningEffort: "low" }]) {
        const changed = structuredClone(packet); Object.assign(changed.preview.session.execution, edit); changed.approvalSha256 = hash(changed.preview);
        expect((await run("submit", changed, changed.approvalSha256, endpoint, true)).code).toBe(1);
      }
      expect(fetcher).not.toHaveBeenCalled();
      const output = await run("submit", packet, packet.approvalSha256, endpoint, true);
      expect(output.code, output.stderr).toBe(0);
      const result = JSON.parse(output.stdout);
      expect(result.notice).toContain("BILLING RECONCILIATION REQUIRED");
      expect(result.session.result.rubricVersion).toBe("sim-aulet-local-2026-10-08");
      expect(result.session.result.omissions[0]).toContain("RECORDED ADAPTATION");
      expect(result.session.result.nextTest.action).toContain("30 minutes TOTAL");
      expect(result.approvedEvidence).toEqual(ps02.draft); expect(result.session.result.engineFindings).toEqual(ps02.result.engineFindings);
      expect(JSON.stringify(result)).not.toContain(method.core);
      expect((await run("submit", packet, packet.approvalSha256, endpoint, true)).code).toBe(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
      const receipt = JSON.parse(await readFile(path.join(runDirectory, "provider-receipt.json"), "utf8"));
      expect(receipt).toMatchObject({ reconciliation: "provider_ledger_check_required", furtherRequestsAllowed: false });
      expect(JSON.stringify(receipt)).not.toContain(apiKey);
      await expect(reviewProviderFileControls(runDirectory, "fictional-ps02-mock-only").claim("fictional-ps02-mock-only", receipt.bodySha256)).rejects.toThrow();
      expect(JSON.parse((await run("cancel", packet, undefined, endpoint)).stdout)).toMatchObject({ phase: "cancelled", result: null });
      expect(JSON.parse((await run("status", packet, undefined, endpoint)).stdout)).toMatchObject({ question: "", result: null });
    } finally { freshExchange.dispose(); local.closeAllConnections(); await new Promise<void>((resolve) => local.close(() => resolve())); }
  }, 20_000);
  it("runs outside the repo with no dependencies, returns exact evidence and recorded result, then cancels", async () => {
    const before = review.mock.calls.length;
    const packet = await preview();
    expect(review.mock.calls).toHaveLength(before);
    const output = await run("submit", packet, packet.approvalSha256);
    expect(output.code, output.stderr).toBe(0);
    const returned = JSON.parse(output.stdout);
    expect(returned.notice).toContain("NOT A NEW AI ASSESSMENT");
    expect(returned.session.phase).toBe("complete");
    expect(returned.approvedEvidence).toEqual(example.draft);
    expect(returned.session.result.engineFindings).toEqual(example.result.engineFindings);
    expect(review.mock.calls).toHaveLength(before + 1);
    expect((await run("submit", packet, packet.approvalSha256)).code).toBe(1);
    expect(review.mock.calls).toHaveLength(before + 1);
    const cancelled = await run("cancel", packet);
    expect(JSON.parse(cancelled.stdout)).toMatchObject({ phase: "cancelled", result: null });
    expect(JSON.parse((await run("status", packet)).stdout)).toMatchObject({ phase: "cancelled", result: null });
  });
  it("requires exact approval and detects changed evidence, recipients, question or endpoint before submission", async () => {
    const packet = await preview();
    const before = audit.mock.calls.length;
    expect((await run("submit", packet)).code).toBe(1);
    expect((await run("submit", packet, "0".repeat(64))).code).toBe(1);
    for (const mutate of [
      (p: typeof packet) => { p.preview.draft.sources[0].excerpt += " changed"; },
      (p: typeof packet) => { p.preview.session.disclosure.recipients = ["Someone else"]; },
      (p: typeof packet) => { p.preview.session.question = "A different question"; },
      (p: typeof packet) => { p.preview.origin = "http://127.0.0.1:1"; },
    ]) {
      const changed = structuredClone(packet); mutate(changed);
      expect((await run("submit", changed, packet.approvalSha256)).code).toBe(1);
    }
    expect(audit.mock.calls).toHaveLength(before);
    const changed = structuredClone(packet);
    changed.preview.session.disclosure.storage = "Changed retention";
    changed.approvalSha256 = hash(changed.preview);
    expect((await run("submit", changed, changed.approvalSha256)).code).toBe(1);
    expect(audit.mock.calls).toHaveLength(before);
    await run("cancel", packet);
  });
  it("does not give arbitrary approved evidence the recorded answer or retry failure", async () => {
    const changed = structuredClone(example.draft); changed.sources[0].excerpt += " Changed count.";
    const packet = await preview(changed);
    const before = review.mock.calls.length;
    const result = await run("submit", packet, packet.approvalSha256);
    expect(result.code).toBe(1); expect(result.stdout).toBe("");
    expect(result.stderr).toContain("no automatic retry");
    expect(review.mock.calls).toHaveLength(before + 1);
    expect(JSON.parse((await run("status", packet)).stdout)).toMatchObject({ phase: "failed", result: null });
    await run("cancel", packet);
  });
  it("rejects remote/ambiguous URLs and invalid/oversized input without echoing contents", async () => {
    const before = audit.mock.calls.length;
    for (const endpoint of ["https://example.com", "http://localhost:1234", origin + "/", origin + "?private=1", "http://user:password@127.0.0.1:1234"]) {
      const output = await run("preview", {}, undefined, endpoint);
      expect(output.code).toBe(1); expect(output.stdout).toBe("");
      expect(output.stderr).not.toContain("password");
    }
    const invalid = await run("preview", { question: "PRIVATE-SENTINEL", draft: { bad: "PRIVATE-SENTINEL" } });
    expect(invalid.code).toBe(1); expect(invalid.stderr).not.toContain("PRIVATE-SENTINEL");
    expect((await run("preview", "x".repeat(600_001))).code).toBe(1);
    expect(audit.mock.calls).toHaveLength(before);
  });
  it("refuses HTTP redirects instead of forwarding the fictional question to another recipient", async () => {
    let requests = 0;
    const redirect = createServer((_req, res) => { requests++; res.writeHead(307, { Location: origin }); res.end(); });
    await new Promise<void>((resolve) => redirect.listen(0, "127.0.0.1", resolve));
    try {
      const address = redirect.address();
      if (!address || typeof address === "string") throw new Error("No listener");
      const before = audit.mock.calls.length;
      const output = await run("preview", { question: example.question, draft: example.draft }, undefined, `http://127.0.0.1:${address.port}`);
      expect(output.code).toBe(1); expect(requests).toBe(1); expect(audit.mock.calls).toHaveLength(before);
    } finally { redirect.closeAllConnections(); await new Promise<void>((resolve) => redirect.close(() => resolve())); }
  });
});
