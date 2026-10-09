import { createHash, randomUUID } from "node:crypto";
import {
  serializeVentureReviewShareDraft, ventureReviewApprovalSchema, ventureReviewStartSchema, ventureReviewSubmitSchema,
  type VentureReviewApproval, type VentureReviewResult,
} from "@paperclipai/shared";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { VentureReviewCoordinator, type VentureReviewTransport } from "./venture-review.js";
import { inspectPermittedWebsite, type WebsiteInspectionPolicy, type WebsiteNetwork } from "./safe-website-evidence.js";

export interface ReviewPrincipal { tenantId: string; actorId: string; role: "board" | "agent" }
type Phase = "awaiting_evidence" | "running" | "needs_evidence" | "complete" | "failed" | "cancelled";
type Approval = VentureReviewApproval & { id: string; approvedAt: string; used: boolean };
const CREDENTIAL_LIKE = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})|\b(?:api[_-]?key|password|authorization)\s*[:=]\s*\S+/i;
interface Session {
  tenantId: string; ownerId: string; reviewId: string; requestId: string;
  question: string; expiresAt: number; phase: Phase; followups: number;
  approval?: Approval; controller: AbortController; result?: VentureReviewResult;
  pending?: Promise<ReturnType<VentureReviewExchange["snapshot"]>>;
  coordinator: VentureReviewCoordinator; inspecting: boolean;
  expiryTimer?: ReturnType<typeof setTimeout>;
  evidenceDigests: Map<string, string>;
}

/** Local/mock-only service. Not durable storage and not a production retention
 * policy. Authenticated principals are supplied by the route, never request JSON. */
export class VentureReviewExchange {
  private readonly sessions = new Map<string, Session>();
  private transportRunning = false;
  private readonly transport: VentureReviewTransport;
  constructor(private readonly config: {
    mode: "mock_only" | "fresh";
    transport: VentureReviewTransport;
    recipients: string[];
    purpose: string;
    sessionTtlMs: number;
    maxSessions: number;
    reviewTimeoutMs: number;
    websitePolicy: Omit<WebsiteInspectionPolicy, "allowedUrls">;
    websiteNetwork: WebsiteNetwork;
    websiteMode?: "fixture" | "public_web";
    now?: () => number;
  }) {
    if (!["mock_only", "fresh"].includes(config.mode) ||
        (config.mode === "fresh") !== (config.transport.execution?.mode === "fresh") || !config.recipients.length || !config.purpose ||
        [config.sessionTtlMs, config.maxSessions, config.reviewTimeoutMs].some((n) => !Number.isSafeInteger(n) || n < 1)) throw new Error("Explicit mock session limits and disclosure are required");
    this.transport = { review: async (packet, signal) => {
      if (this.transportRunning) throw conflict("Review executor busy");
      this.transportRunning = true;
      try { return await config.transport.review(packet, signal); }
      finally { this.transportRunning = false; }
    } };
  }

  private now() { return this.config.now?.() ?? Date.now(); }
  private session(principal: ReviewPrincipal, reviewId: string) {
    const session = this.sessions.get(reviewId);
    if (!session || session.tenantId !== principal.tenantId || (session.ownerId !== principal.actorId && principal.role !== "board")) throw notFound("Review not found");
    if (this.now() >= session.expiresAt) {
      this.clear(session);
      throw conflict("Review session expired; no evidence retained by this session");
    }
    return session;
  }
  private clear(session: Session) {
    session.controller.abort();
    session.phase = "cancelled";
    session.approval = undefined;
    session.result = undefined;
    session.question = "";
    session.pending = undefined;
    session.evidenceDigests.clear();
    clearTimeout(session.expiryTimer);
    // Release cached output too; retain only a bounded identity tombstone.
    session.coordinator = new VentureReviewCoordinator(this.transport, { timeoutMs: this.config.reviewTimeoutMs, maxAttempts: 2 });
  }
  private assertCollecting(session: Session) {
    if (!["awaiting_evidence", "needs_evidence"].includes(session.phase) || session.inspecting) throw conflict("Review is not accepting evidence");
  }
  snapshot(session: Session) {
    return structuredClone({
      reviewId: session.reviewId, requestId: session.requestId, question: session.question,
      phase: session.phase, expiresAt: new Date(session.expiresAt).toISOString(),
      followupsUsed: session.followups, result: session.result ?? null, mockOnly: this.config.mode === "mock_only",
      ...(this.config.transport.execution ? { execution: this.config.transport.execution } : {}),
      disclosure: { recipients: this.config.recipients, purpose: this.config.purpose, storage: "Temporary process memory only; explicit export required. Not a production retention promise.", websiteLimits: this.config.websitePolicy, websiteMode: this.config.websiteMode ?? "fixture" },
    });
  }
  start(principal: ReviewPrincipal, raw: unknown) {
    const input = ventureReviewStartSchema.parse(raw);
    if (CREDENTIAL_LIKE.test(input.question)) throw badRequest("Possible credentials in question; redact before starting");
    if (this.sessions.size >= this.config.maxSessions) throw conflict("Local review session capacity reached");
    const session: Session = {
      tenantId: principal.tenantId, ownerId: principal.actorId, reviewId: randomUUID(), requestId: randomUUID(),
      question: input.question, expiresAt: this.now() + this.config.sessionTtlMs, phase: "awaiting_evidence", followups: 0,
      controller: new AbortController(), inspecting: false, evidenceDigests: new Map(),
      coordinator: new VentureReviewCoordinator(this.transport, { timeoutMs: this.config.reviewTimeoutMs, maxAttempts: 2 }),
    };
    this.sessions.set(session.reviewId, session);
    session.expiryTimer = setTimeout(() => this.clear(session), this.config.sessionTtlMs);
    session.expiryTimer.unref();
    return this.snapshot(session);
  }
  get(principal: ReviewPrincipal, reviewId: string) { return this.snapshot(this.session(principal, reviewId)); }

  approve(principal: ReviewPrincipal, reviewId: string, raw: unknown) {
    const session = this.session(principal, reviewId);
    if (principal.role !== "board") throw forbidden("Founder approval is required; agent evidence selection is not consent");
    this.assertCollecting(session);
    const input = ventureReviewApprovalSchema.parse(raw);
    if (input.requestId !== session.requestId || new Set(input.sourceIds).size !== input.sourceIds.length) throw conflict("Stale or invalid evidence approval");
    if (JSON.stringify(input.recipients) !== JSON.stringify(this.config.recipients) || input.purpose !== this.config.purpose) throw badRequest("Approval does not match the disclosed recipients and purpose");
    if (JSON.stringify(input.execution) !== JSON.stringify(this.config.transport.execution)) throw badRequest("Approval does not match the disclosed execution mode and model");
    session.approval = { ...input, id: randomUUID(), approvedAt: new Date(this.now()).toISOString(), used: false };
    return { approvalId: session.approval.id, requestId: session.requestId, draftSha256: input.draftSha256 };
  }

  async submit(principal: ReviewPrincipal, reviewId: string, raw: unknown) {
    const session = this.session(principal, reviewId);
    const input = ventureReviewSubmitSchema.parse(raw);
    const approval = session.approval;
    const serialized = serializeVentureReviewShareDraft(input.draft);
    const hash = createHash("sha256").update(serialized).digest("hex");
    if (!approval || approval.id !== input.approvalId || approval.draftSha256 !== hash ||
        JSON.stringify(approval.execution) !== JSON.stringify(this.config.transport.execution) ||
        JSON.stringify(approval.sourceIds) !== JSON.stringify(input.draft.sources.map((source) => source.id))) throw conflict("Evidence differs from the approved preview or approval is stale");
    if (approval.used) {
      if (session.pending) return session.pending;
      throw conflict("Approval has already been consumed");
    }
    this.assertCollecting(session);
    // Defense in depth, not a guarantee of secret detection. Errors never echo content.
    if (session.phase === "needs_evidence") {
      const kinds = session.result?.evidenceRequest?.requestedSourceKinds ?? [];
      if (input.draft.sources.some((source) => !kinds.includes(source.kind) &&
          session.evidenceDigests.get(source.id) !== createHash("sha256").update(JSON.stringify(source)).digest("hex"))) throw badRequest("New evidence is outside the bounded follow-up request");
    }
    if (CREDENTIAL_LIKE.test(serialized)) throw badRequest("Possible credentials in evidence; redact locally and approve a new preview");
    approval.used = true;
    session.evidenceDigests = new Map(input.draft.sources.map((source) => [source.id, createHash("sha256").update(JSON.stringify(source)).digest("hex")]));
    session.phase = "running";
    const packet = {
      version: "sysdom_venture_review_evidence_v1", tenantId: session.tenantId, reviewId,
      idempotencyKey: approval.id, founderApprovedAt: approval.approvedAt, durableWriteApproved: false,
      question: session.question,
      collectionOmissions: input.draft.collectionOmissions,
      sources: input.draft.sources.map((source) => ({ ...source, consent: { approved: true, purpose: approval.purpose, recipients: approval.recipients } })),
    };
    session.pending = session.coordinator.review(packet, session.controller.signal).then((result) => {
      session.controller.signal.throwIfAborted();
      if (this.now() >= session.expiresAt) { this.clear(session); throw conflict("Review expired during execution"); }
      if (result.status === "cancelled") { this.clear(session); return this.snapshot(session); }
      session.result = result;
      if (result.status === "needs_evidence" && result.evidenceRequest && session.followups === 0) {
        session.phase = "needs_evidence";
        session.followups = 1;
        session.requestId = randomUUID();
      } else {
        // A second missing-evidence response remains honest, but cannot ask for a third run.
        if (result.evidenceRequest) result.evidenceRequest = null;
        session.phase = "complete";
      }
      return this.snapshot(session);
    }).catch(() => {
      if (session.phase !== "cancelled") session.phase = "failed";
      throw conflict(session.phase === "cancelled" ? "Review cancelled" : "Review could not complete; no automatic retry was made");
    });
    return session.pending;
  }

  decline(principal: ReviewPrincipal, reviewId: string) {
    const session = this.session(principal, reviewId);
    if (session.phase !== "needs_evidence" || !session.result) throw conflict("No evidence follow-up is pending");
    session.result.evidenceRequest = null;
    session.phase = "complete";
    session.approval = undefined;
    return this.snapshot(session);
  }
  cancel(principal: ReviewPrincipal, reviewId: string) {
    const session = this.session(principal, reviewId);
    this.clear(session);
    return this.snapshot(session);
  }
  dispose() {
    for (const session of this.sessions.values()) this.clear(session);
    this.sessions.clear();
  }
  async inspectWebsite(principal: ReviewPrincipal, reviewId: string, requestId: string, approvedUrls: string[]) {
    const session = this.session(principal, reviewId);
    if (principal.role !== "board") throw forbidden("Founder approval of website scope is required");
    this.assertCollecting(session);
    if (requestId !== session.requestId) throw conflict("Stale website request");
    session.inspecting = true;
    try {
      const receipts = await inspectPermittedWebsite(approvedUrls, { ...this.config.websitePolicy, allowedUrls: approvedUrls }, session.controller.signal, this.config.websiteNetwork);
      session.controller.signal.throwIfAborted();
      if (this.now() >= session.expiresAt) { this.clear(session); throw conflict("Review expired during inspection"); }
      return { reviewId, requestId, receipts, mockOnly: this.config.mode === "mock_only" };
    } finally { session.inspecting = false; }
  }
}
