import { createHash } from "node:crypto";
import {
  ventureReviewEvidencePacketSchema,
  ventureReviewResultSchema,
  serializeVentureReviewShareDraft,
  type VentureReviewShareDraft,
  type VentureReviewEvidencePacket,
  type VentureReviewResult,
  type VentureReviewSnapshot,
} from "@paperclipai/shared";

export const SIM_REVIEW_RUBRIC_VERSION = "m1-draft-2026-09-21";

export interface VentureReviewTransport {
  readonly execution?: VentureReviewSnapshot["execution"];
  review(packet: VentureReviewEvidencePacket, signal?: AbortSignal): Promise<VentureReviewResult>;
}

export class VentureReviewCoordinator {
  // Instance-local only. Never evict identities and accidentally permit a duplicate run.
  private readonly attempts = new Map<string, { fingerprint: string; result: Promise<VentureReviewResult> }>();
  private active = 0;

  constructor(
    private readonly transport: VentureReviewTransport,
    private readonly limits = { timeoutMs: 30_000, maxAttempts: 100 },
  ) {
    if (!Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs < 1 ||
        !Number.isSafeInteger(limits.maxAttempts) || limits.maxAttempts < 1) {
      throw new Error("Review execution limits must be positive integers");
    }
  }

  async review(rawPacket: unknown, signal?: AbortSignal) {
    const packet = ventureReviewEvidencePacketSchema.parse(rawPacket);
    signal?.throwIfAborted();
    const cacheKey = `${packet.tenantId}:${packet.idempotencyKey}`;
    const fingerprint = createHash("sha256").update(JSON.stringify(packet)).digest("hex");
    const previous = this.attempts.get(cacheKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error("Review idempotency conflict: packet changed");
      return structuredClone(await abortable(previous.result, signal));
    }
    if (this.active !== 0) throw new Error("Review executor busy; no concurrent transport runs permitted");
    if (this.attempts.size >= this.limits.maxAttempts) throw new Error("Review session capacity reached");
    const controller = new AbortController();
    const abort = () => controller.abort(new DOMException("Venture Review cancelled", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("Venture Review timed out", "TimeoutError")), this.limits.timeoutMs);
    this.active++;
    // Defer invocation until the identity reservation has been installed.
    const work = Promise.resolve().then(() => {
      controller.signal.throwIfAborted();
      return this.transport.review(structuredClone(packet), controller.signal);
    }).finally(() => { this.active--; });
    const result = abortable(work, controller.signal).then((raw) => {
      controller.signal.throwIfAborted();
      return this.validateResult(packet, raw);
    }).finally(() => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    });
    // Failed/cancelled attempts are tombstones too: no implicit retry.
    this.attempts.set(cacheKey, { fingerprint, result });
    return structuredClone(await result);
  }

  private validateResult(packet: VentureReviewEvidencePacket, raw: unknown) {
    const result = ventureReviewResultSchema.parse(raw);
    if (result.tenantId !== packet.tenantId || result.reviewId !== packet.reviewId) {
      throw new Error("Venture Review transport crossed the requested tenant or review boundary");
    }
    if (result.durableWritePerformed) {
      throw new Error("Venture Review v1 does not permit transport-owned durable writes");
    }
    const approved = new Set(packet.sources.map((source) => source.id));
    const cited = [
      ...(result.businessUnderstanding?.evidenceSourceIds ?? []),
      ...(result.strengths ?? []).flatMap(finding => finding.evidenceSourceIds),
      ...Object.values(result.engineFindings).flatMap((findings) => findings.flatMap((finding) => finding.evidenceSourceIds)),
      ...result.interactions.flatMap((finding) => finding.evidenceSourceIds),
      ...result.contradictions.flatMap((finding) => finding.evidenceSourceIds),
      ...result.alternatives.flatMap((finding) => [...finding.evidenceFor, ...finding.evidenceAgainst]),
    ];
    if (cited.some((id) => !approved.has(id))) throw new Error("Review cited an unapproved evidence source");
    return result;
  }
}

/** Stops waiting immediately even if a replaceable transport ignores cancellation. */
export function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

export function createFixtureVentureReviewTransport(): VentureReviewTransport {
  return {
    async review(packet, signal) {
      if (signal?.aborted) throw new DOMException("Venture Review cancelled", "AbortError");
      const sourceIds = packet.sources.slice(0, 12).map((source) => source.id);
      const omissions = [...new Set(packet.sources.flatMap((source) => source.omitted))];
      for (const omission of packet.collectionOmissions) {
        omissions.push(omission.length <= 500 ? omission : "An additional collection omission is recorded in full in the approved packet.");
      }
      const sparse = packet.sources.every((source) => source.excerpt.trim().length < 120);
      return ventureReviewResultSchema.parse({
        version: "sysdom_venture_review_result_v1",
        reviewId: packet.reviewId,
        tenantId: packet.tenantId,
        rubricVersion: SIM_REVIEW_RUBRIC_VERSION,
        status: sparse ? "needs_evidence" : "complete",
        engineFindings: {
          product_service: [{ statement: "The offer needs a testable promise before more scope is added.", evidenceSourceIds: sourceIds, confidence: sparse ? "low" : "medium" }],
          customer: [],
          cash: [],
          skills: [],
        },
        interactions: [],
        contradictions: [],
        unknowns: ["Customer behavior and cash consequences are not established by the supplied evidence."],
        alternatives: [{ explanation: "The visible product symptom may be downstream of a customer follow-up gap.", evidenceFor: [], evidenceAgainst: [] }],
        nextTest: {
          question: "Can one intended user explain the promised outcome and take the next step?",
          action: "Run one founder-observed walkthrough and record the first point of confusion.",
          successSignal: "The user can state the promise and complete the next step without prompting.",
          owner: "founder",
        },
        evidenceRequest: sparse ? {
          purpose: "Distinguish a product-promise gap from a customer follow-up gap.",
          requestedSourceKinds: ["founder_note", "structured_record"],
          limits: "One recent walkthrough note and one dated conversion or follow-up record; redact names and secrets.",
        } : null,
        omissions: omissions.length <= 20 ? omissions : [...omissions.slice(0, 19), `${omissions.length - 19} additional source omissions remain in the approved evidence packet.`],
        durableWritePerformed: false,
      });
    },
  };
}

/** Offline replay only. Never apply a recorded answer to changed evidence. */
export function createRecordedVentureReviewTransport(record: {
  question: string;
  draft: VentureReviewShareDraft;
  result: VentureReviewResult;
}): VentureReviewTransport {
  const expected = serializeVentureReviewShareDraft(record.draft);
  const question = record.question;
  const result = ventureReviewResultSchema.parse(record.result);
  return { async review(packet, signal) {
    signal?.throwIfAborted();
    const actual = serializeVentureReviewShareDraft({
      sources: packet.sources.map(({ consent: _consent, ...source }) => source),
      collectionOmissions: packet.collectionOmissions,
    });
    if (packet.question !== question || actual !== expected) throw new Error("Recorded example does not match this evidence; no fresh assessment is configured");
    return { ...structuredClone(result), reviewId: packet.reviewId, tenantId: packet.tenantId };
  } };
}
