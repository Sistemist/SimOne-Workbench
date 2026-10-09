import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { PUBLIC_REVIEW_CONSENT_VERSION, publicReviewInputSchema, publicReviewSourcesInputSchema, type PublicReviewSource, type PublicReviewCapability, type PublicReviewSnapshot, type VentureReviewResult } from "@paperclipai/shared";
import { inspectPermittedWebsite, validatePublicWebsiteUrl, type WebsiteNetwork } from "./safe-website-evidence.js";
import { HttpError } from "../errors.js";
import { VentureReviewCoordinator, ReviewValidationError, type ReviewFailureStage, type VentureReviewTransport } from "./venture-review.js";

const hash = (text: string) => createHash("sha256").update(text).digest();
const secretLike = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})|\b(?:api[_-]?key|password|authorization)\s*[:=]\s*\S+/i;
type Session = { tokenHash: Buffer; expiresAt: number; phase: PublicReviewSnapshot["phase"]; result: VentureReviewResult | null; controller: AbortController; timer: ReturnType<typeof setTimeout>; tenantId: string; sources: PublicReviewSource[]; inspecting: boolean; inspections: number; requestHash?: string };

/** Anonymous visitors get isolated, ephemeral capabilities, never a board/company identity. */
export class PublicVentureReview {
  private sessions = new Map<string, Session>();
  private running = 0;
  private metricsSince = new Date().toISOString();
  private counts = { started: 0, completed: 0, failed: 0, cancelled: 0 };
  private durations: number[] = [];
  private httpStatuses: Record<string, number> = {};
  recordHttpStatus(status: number) { this.httpStatuses[status] = (this.httpStatuses[status] ?? 0) + 1; }
  metrics() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const percentile = (p: number) => sorted.length ? sorted[Math.ceil(sorted.length * p) - 1]! : null;
    return { since: this.metricsSince, scope: "current_process", maxConcurrent: this.options.maxConcurrent, inFlight: this.running, queueDepth: 0, sessions: this.sessions.size, counts: { ...this.counts },
      latencyMs: { p50: percentile(0.5), p95: percentile(0.95), samples: sorted.length, window: "last_200_finished_attempts" }, httpStatuses: { ...this.httpStatuses } };
  }
  constructor(private options: {
    mode: "recorded" | "fresh"; methodVersion: string;
    transport: () => VentureReviewTransport;
    availability: () => Promise<"available" | "exhausted" | "paused" | "busy">;
    recipients: string[]; retention: string;
    now?: () => number; timeoutMs?: number; maxConcurrent: number; websiteNetwork: WebsiteNetwork;
  }) {
    if (!Number.isSafeInteger(options.maxConcurrent) || options.maxConcurrent < 1 || !options.methodVersion || !options.recipients.length || !options.retention || (options.timeoutMs ?? 120000) > 120000 || (options.timeoutMs ?? 120000) < 1) throw new Error("Bounded public review configuration required");
  }
  private now() { return this.options.now?.() ?? Date.now(); }
  async capability(): Promise<PublicReviewCapability> {
    return { state: this.running >= this.options.maxConcurrent ? "busy" : await this.options.availability(), mode: this.options.mode,
      consentVersion: `${PUBLIC_REVIEW_CONSENT_VERSION}:${this.options.methodVersion}:${this.options.mode}:${hash(JSON.stringify([this.options.recipients, this.options.retention])).toString("hex")}`,
      methodVersion: this.options.methodVersion, model: "openai/gpt-6.1-sol", reasoningEffort: "high",
      recipients: this.options.recipients, retention: this.options.retention, maxNoteChars: 8000, sessionMinutes: 15 };
  }
  async create() {
    if ((await this.capability()).state !== "available") throw new HttpError(503, "Review is unavailable. No evidence was sent to a model.");
    if (this.sessions.size >= 100) throw new HttpError(429, "Review capacity reached. Try later.");
    const reviewId = randomUUID(), token = randomBytes(32).toString("hex"), expiresAt = this.now() + 900000;
    const timer = setTimeout(() => { this.sessions.get(reviewId)?.controller.abort(); this.sessions.delete(reviewId); }, 900000); timer.unref();
    this.sessions.set(reviewId, { tokenHash: hash(token), expiresAt, phase: "ready", result: null, controller: new AbortController(), timer, tenantId: randomUUID(), sources: [], inspecting: false, inspections: 0 });
    return { ...this.get(reviewId, token), accessToken: token };
  }
  private session(id: string, token: string) {
    const session = this.sessions.get(id);
    if (!session || this.now() >= session.expiresAt || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(session.tokenHash, hash(token))) throw new HttpError(404, "Review unavailable or expired.");
    return session;
  }
  get(id: string, token: string): PublicReviewSnapshot {
    const s = this.session(id, token);
    return { reviewId: id, phase: s.phase, result: s.result ? structuredClone(s.result) : null, expiresAt: new Date(s.expiresAt).toISOString(), mode: this.options.mode };
  }
  async run(id: string, token: string, raw: unknown) {
    const s = this.session(id, token), input = publicReviewInputSchema.parse(raw);
    const fingerprint = hash(JSON.stringify(input)).toString("hex");
    if (s.requestHash === fingerprint) return this.get(id, token);
    const capability = await this.capability();
    if (s.requestHash === fingerprint) return this.get(id, token);
    if (s.phase !== "ready" || s.inspecting) throw new HttpError(409, "This review was already submitted. Check its status; do not resubmit.");
    if (capability.state !== "available") throw new HttpError(503, "Review temporarily unavailable. No new model call was made.");
    if (input.consentVersion !== capability.consentVersion) throw new HttpError(409, "Review terms changed. Preview and approve again.");
    if (new Set(input.selectedSourceIds).size !== input.selectedSourceIds.length || input.selectedSourceIds.some(id => !s.sources.some(x => x.id === id && input.sourceHashes[id] === x.sha256 && x.text && ["retrieved", "partial"].includes(x.status)))) throw new HttpError(400, "Choose only retrieved sources from this session.");
    const selected = s.sources.filter(x => input.selectedSourceIds.includes(x.id));
    if (secretLike.test([input.question, input.notes, ...selected.map(x => x.text)].join("\n"))) throw new HttpError(400, "Remove possible credentials before reviewing.");
    // No await between the global slot check and claim.
    if (this.running >= this.options.maxConcurrent) throw new HttpError(429, "All review slots are occupied. Try again shortly.");
    this.running++; this.counts.started++; const startedAt = this.now(); s.phase = "running"; s.requestHash = fingerprint;
    let transport: VentureReviewTransport | undefined;
    let failureStage: ReviewFailureStage = "route";
    try {
      transport = this.options.transport();
      if (this.options.mode === "recorded" && transport.execution?.mode === "fresh") throw new Error("Fresh transport cannot be labeled recorded");
      if (this.options.mode === "fresh" && (transport.execution?.mode !== "fresh" || transport.execution.model !== "openai/gpt-6.1-sol" || transport.execution.provider !== "openrouter/azure" || transport.execution.reasoningEffort !== "high")) throw new Error("Route changed");
      failureStage = "transport";
      const result = await new VentureReviewCoordinator(transport, { maxAttempts: 1, timeoutMs: this.options.timeoutMs ?? 120000 }).review({
        version: "sysdom_venture_review_evidence_v1", tenantId: s.tenantId, reviewId: id, idempotencyKey: input.requestId,
        founderApprovedAt: new Date(this.now()).toISOString(), durableWriteApproved: false, question: input.question,
        collectionOmissions: ["No private workspace, payment or customer records were retrieved. Public pages and README text do not establish traction, revenue or business quality.", ...s.sources.flatMap(x => input.selectedSourceIds.includes(x.id) ? x.omissions : ["One public source was excluded by the founder."])],
        sources: [{ id: "founder-note", kind: "founder_note", title: "Your approved venture note", capturedAt: new Date(this.now()).toISOString(), sourceDate: null,
          excerpt: input.notes, basis: "source_claim", omitted: [], consent: { approved: true, purpose: "Private Venture Review", recipients: capability.recipients } }, ...selected.map(x => ({ id: x.id, kind: "website_page", title: x.title, capturedAt: x.capturedAt, sourceDate: null, excerpt: x.text, basis: "website_text", omitted: x.omissions.slice(0, 20).map(t => t.slice(0, 300)), provenance: { sourceUri: x.url, excerptLocation: "Bounded static public text; no code execution or repository clone", contentSha256: createHash("sha256").update(x.text).digest("hex") }, consent: { approved: true, purpose: "Private Venture Review", recipients: capability.recipients } }))],
      }, s.controller.signal);
      s.controller.signal.throwIfAborted();
      if (this.now() >= s.expiresAt) throw new ReviewValidationError("expired");
      if (result.rubricVersion !== this.options.methodVersion) throw new ReviewValidationError("method_version");
      if (this.options.mode === "fresh" && (!result.businessUnderstanding || !result.strengths)) throw new ReviewValidationError("public_fields");
      // One public request only; the next observation is advice, not an automatic paid follow-up.
      s.result = { ...result, evidenceRequest: null }; s.phase = "complete";
    } catch (error) {
      s.phase = s.controller.signal.aborted ? "cancelled" : "failed"; s.result = null;
      failureStage = s.controller.signal.aborted ? "cancelled" : error instanceof ReviewValidationError ? error.stage :
        error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : failureStage;
    }
    finally {
      try { transport?.recordOutcome?.({ phase: s.phase as "complete" | "failed" | "cancelled", ...(s.phase === "complete" ? {} : { failureStage }) }); }
      catch { s.phase = "failed"; s.result = null; }
      this.running--;
      this.counts[s.phase === "complete" ? "completed" : s.phase === "cancelled" ? "cancelled" : "failed"]++;
      this.durations.push(Math.max(0, this.now() - startedAt)); if (this.durations.length > 200) this.durations.shift();
    }
    return this.get(id, token);
  }
  async inspect(id: string, token: string, raw: unknown) {
    const s = this.session(id, token), input = publicReviewSourcesInputSchema.parse(raw);
    if (s.phase !== "ready" || s.inspecting || s.inspections >= 2) throw new HttpError(409, "Public inspection limit reached or review already started.");
    const urls: string[] = [];
    try {
      if (input.website) urls.push(validatePublicWebsiteUrl(input.website).href);
      if (input.github) {
        const repo = new URL(input.github);
        if (repo.origin !== "https://github.com" || repo.username || repo.password || repo.search || repo.hash || !/^\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/?$/.test(repo.pathname)) throw new Error("Public repository URL required");
        const [owner, name] = repo.pathname.slice(1).replace(/\/$/, "").split("/");
        urls.push(`https://raw.githubusercontent.com/${owner}/${name!.replace(/\.git$/, "")}/HEAD/README.md`);
      }
      if (!urls.length || new Set(urls).size !== urls.length) throw new Error("Choose a source");
    } catch { throw new HttpError(400, "Use a public website URL and an optional https://github.com/owner/repository link. No private hosts, credentials or query strings."); }
    s.inspecting = true; s.inspections++;
    try {
      const receipts = await inspectPermittedWebsite(urls, { allowedUrls: urls, maxPages: 2, maxBytesPerPage: 64000, maxCharsPerPage: 4000, maxRedirects: 0, timeoutMs: 8000 }, s.controller.signal, this.options.websiteNetwork);
      s.controller.signal.throwIfAborted();
      s.sources = receipts.map((r, i) => ({ id: `public-${i}`, sha256: hash(JSON.stringify(r)).toString("hex"), url: r.finalUrl ?? r.sourceUrl, title: r.title.slice(0, 300) || (r.sourceUrl.includes("raw.githubusercontent.com") ? "Public repository README" : "Business website"), text: r.text, capturedAt: r.capturedAt, status: r.status, omissions: r.omissions, simulated: this.options.mode === "recorded" }));
      return structuredClone(s.sources);
    } finally { s.inspecting = false; }
  }
  cancel(id: string, token: string) {
    const s = this.session(id, token); s.controller.abort(); s.result = null; s.sources = []; s.phase = "cancelled";
    return this.get(id, token);
  }
  dispose() { for (const s of this.sessions.values()) { s.controller.abort(); clearTimeout(s.timer); } this.sessions.clear(); }
}
