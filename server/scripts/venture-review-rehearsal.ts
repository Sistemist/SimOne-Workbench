/** Explicit loopback-only fictional rehearsal. No DB, credentials, providers,
 * production auth decisions. Public website requests require --public-web and
 * explicit per-session scope approval. No model calls. Never deployed. */
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { PublicVentureReview } from "../src/services/public-venture-review.js";
import { publicVentureReviewRoutes } from "../src/routes/public-venture-review.js";
import { publicReviewPage, publicReviewHtml } from "../src/public-review-page.js";
import { VentureReviewExchange } from "../src/services/venture-review-exchange.js";
import { createRecordedVentureReviewTransport } from "../src/services/venture-review.js";
import { createEarlyAccessRequestSchema, createPublicFunnelEventSchema, ventureReviewShareDraftSchema, ventureReviewResultSchema } from "@paperclipai/shared";
import { publicWebsiteNetwork } from "../src/services/safe-website-evidence.js";
import { createMethodBoundReviewTransport, loadPrivateReviewMethod } from "../src/services/venture-review-method.js";
import { ventureReviewRoutes } from "../src/routes/venture-review.js";
import { createPS02ProviderMock } from "../src/services/venture-review-provider-mock.js";

const methodDir = process.argv[2];
if (!methodDir || process.argv[3] !== "--fictional-only" || process.argv.slice(4).some((arg) => !["--public-web", "--provider-mock", "--ps02-recorded", "--public-entry"].includes(arg))) throw new Error("Supply an explicit private M1 directory and --fictional-only; use --ps02-recorded or --provider-mock for the current local journey");
const publicWeb = process.argv.includes("--public-web");
const providerMock = process.argv.includes("--provider-mock");
const ps02Recorded = process.argv.includes("--ps02-recorded");
if (providerMock && ps02Recorded) throw new Error("Choose recorded replay or provider mock");
const publicEntry = process.argv.includes("--public-entry");
if (publicEntry && (providerMock || publicWeb)) throw new Error("Public entry rehearsal is recorded and offline only");
const currentMethod = providerMock || ps02Recorded || publicEntry;
if (currentMethod && publicWeb) throw new Error("PS02 rehearsal forbids public website requests");
const example = JSON.parse(await readFile(new URL(currentMethod ? "../../evals/fixtures/venture-review-ps02-oct08-demo.json" : "../../evals/fixtures/venture-review-cu01-demo.json", import.meta.url), "utf8"));
example.draft = ventureReviewShareDraftSchema.parse(example.draft);
example.result = ventureReviewResultSchema.parse(example.result);
const manifest = JSON.parse(await readFile(path.join(methodDir, currentMethod ? "runtime-2026-10-08/manifest.json" : "verification.json"), "utf8")) as { version: string; artifacts: Array<{ file: string; sha256: string }> };
const hash = (name: string) => {
  const entry = manifest.artifacts.find((item) => item.file === name);
  if (!entry) throw new Error("Private method manifest entry missing");
  return entry.sha256;
};
const procedureFile = currentMethod ? "runtime-2026-10-08/procedure.md" : "02-review-procedure.md";
const version = currentMethod ? "sim-aulet-local-2026-10-08" : "m1-draft-2026-09-21";
if (currentMethod && manifest.version !== version) throw new Error("Unexpected local method version");
const method = await loadPrivateReviewMethod({ version, status: currentMethod ? "provisional_local" : "authored_draft_not_accepted", corePath: path.join(methodDir, "01-sim-core.md"), procedurePath: path.join(methodDir, procedureFile), coreSha256: hash("01-sim-core.md"), procedureSha256: hash(procedureFile) });
if (example.result.rubricVersion !== method.version) throw new Error("Example and private method version differ");
const fixture = createRecordedVentureReviewTransport(example);
const exchange = new VentureReviewExchange({
  mode: "mock_only", transport: providerMock ? createPS02ProviderMock(method, example) : createMethodBoundReviewTransport(method, ({ evidence }, signal) => fixture.review(evidence, signal)),
  recipients: [providerMock ? "Local Sysdom process and in-process Sol 6.1 High/Azure mock; no external model provider" : ps02Recorded ? "Local Sysdom process; October PS02 recorded adaptation with authored refinements; no external model provider" : "Local Sysdom rehearsal process; recorded CU01 fixture; no external model provider"],
  purpose: "Verify the fictional preview-to-review flow", sessionTtlMs: 15 * 60_000, maxSessions: 30, reviewTimeoutMs: 5000,
  websitePolicy: { maxPages: 2, maxBytesPerPage: 64_000, maxCharsPerPage: 4000, maxRedirects: 1, timeoutMs: 8000 },
  websiteMode: publicWeb ? "public_web" : "fixture",
  websiteNetwork: publicWeb ? publicWebsiteNetwork : {
    lookup: async () => [{ address: "93.184.216.34" }],
    request: async ({ url }) => ({ status: url.pathname === "/" ? 200 : 403, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode(url.pathname === "/" ? "Fictional venture homepage: we offer a weekly planning service. No customer behavior or cash evidence is established by this page." : "") }),
  },
});
const publicNote = example.draft.sources.map((s: { title: string; excerpt: string }) => s.title + "\n" + s.excerpt).join("\n\n");
const publicResult = structuredClone(example.result);
for (const f of [...Object.values(publicResult.engineFindings).flat() as any[], ...publicResult.interactions, ...publicResult.contradictions]) f.evidenceSourceIds = ["founder-note"];
for (const a of publicResult.alternatives) { a.evidenceFor = a.evidenceFor.length ? ["founder-note"] : []; a.evidenceAgainst = a.evidenceAgainst.length ? ["founder-note"] : []; }
publicResult.businessUnderstanding = { statement: "This fictional service business is considering more acquisition while order volume, late delivery and support demand have risen. Its exact offer and customer segment are not supplied.", evidenceSourceIds: ["founder-note"], confidence: "medium", basis: "source_claim" };
publicResult.strengths = [];
const publicService = new PublicVentureReview({ mode: "recorded", methodVersion: method.version, maxConcurrent: 10,
  recipients: ["Local recorded example only; no external AI service"], retention: "Local process memory for up to 15 minutes. No account, paid request or database write.",
  availability: async () => "available", timeoutMs: 5000,
  transport: () => createMethodBoundReviewTransport(method, async ({ evidence }) => {
    if (evidence.question !== example.question || evidence.sources.length !== 1 || evidence.sources[0]?.excerpt !== publicNote) throw new Error("Only the exact fictional example can be replayed");
    return { ...structuredClone(publicResult), reviewId: evidence.reviewId, tenantId: evidence.tenantId };
  }),
  websiteNetwork: { lookup: async () => [{ address: "93.184.216.34" }], request: async () => ({ status: 200, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode("SIMULATED public source. Exclude this source before replaying the recorded example. It is not part of its historical evidence.") }) },
});
const app = express();
const server = createServer(app);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../ui");
const vite = await createViteServer({ root, configFile: path.join(root, "vite.config.ts"), server: { middlewareMode: true, hmr: { server }, proxy: {}, fs: { deny: ["**/doc/**", "**/ARCHITECTURE.md", "**/.env*", "**/*.{crt,pem}", "**/.git/**"] } }, appType: "custom" });
// Loopback is not consent: reject cross-site browser writes and DNS rebinding.
app.use((req, res, next) => {
  const expectedHost = `127.0.0.1:${req.socket.localPort}`;
  if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`) ||
      (req.method === "POST" && !req.is("application/json"))) {
    res.status(403).json({ error: "Same-origin local JSON requests only" }); return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "600kb" }));
app.get("/api/venture-review-example", (_req, res) => res.json({ question: example.question, draft: example.draft, notes: publicNote }));
if (publicEntry) {
  app.use(publicReviewPage);
  app.post("/api/public/funnel-events", (req, res) => {
    const event = createPublicFunnelEventSchema.parse(req.body);
    if (!event.isTest) { res.status(400).json({ error: "Fictional analytics only" }); return; }
    res.status(202).json({ accepted: true });
  });
  app.post("/api/public/early-access/requests", (req, res) => {
    const input = createEarlyAccessRequestSchema.parse(req.body);
    if (!input.email.endsWith("@example.test") || input.scan) { res.status(400).json({ error: "Use a fictional @example.test address; no real request is stored" }); return; }
    res.status(202).json({ accepted: true, id: input.requestKey, status: "pending", scanRetained: false });
  });
  app.use("/api", publicVentureReviewRoutes({ service: publicService, publicOrigin: () => { const a = server.address(); return typeof a === "object" && a ? `http://127.0.0.1:${a.port}` : ""; } }));
}
app.use((req, _res, next) => { req.actor = { type: "board", userId: "fictional-rehearsal-founder", source: "session", companyIds: ["11111111-1111-4111-8111-111111111111"] }; next(); });
app.use("/api", ventureReviewRoutes({ exchange, maxRequestsPerMinute: 100, audit: async () => {} }));
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: "Invalid local request; content is not echoed" });
});
app.get(publicEntry ? "/venture-review" : "/scanner", async (req, res) => res.type("html").send(publicReviewHtml(await vite.transformIndexHtml(req.path, '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Fictional Venture Review rehearsal</title></head><body><div id="root"></div><script type="module" src="/src/rehearsal/REHEARSAL_ENTRY.tsx"></script></body></html>'.replace("REHEARSAL_ENTRY", publicEntry ? "public-review-entry" : "venture-review-entry")), req.originalUrl)));
app.use(vite.middlewares);
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address === "object") console.log(`Fictional-only rehearsal: http://127.0.0.1:${address.port}/${publicEntry ? "venture-review" : "scanner"}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { exchange.dispose(); publicService.dispose(); server.closeAllConnections(); server.close(); void vite.close().then(() => process.exit(0)); });
