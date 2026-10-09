import { createHash, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serializeVentureReviewShareDraft } from "@paperclipai/shared";
import { VentureReviewExchange, type ReviewPrincipal } from "./venture-review-exchange.js";
import { createFixtureVentureReviewTransport, type VentureReviewTransport } from "./venture-review.js";
import { createMethodBoundReviewTransport } from "./venture-review-method.js";

const tenantId = randomUUID();
const founder: ReviewPrincipal = { tenantId, actorId: "founder", role: "board" };
const agent: ReviewPrincipal = { tenantId, actorId: "agent", role: "agent" };
const draft = { sources: [{ id: "note", kind: "founder_note", title: "Fictional note", capturedAt: "2026-09-21T10:00:00.000Z", sourceDate: "2026-09-21", excerpt: "No customers yet.", omitted: ["Names redacted locally"] }] };
const recipients = ["Local mock reviewer; no external model"];
const purpose = "Fictional local review";
const services: VentureReviewExchange[] = [];
function service(transport: VentureReviewTransport = createFixtureVentureReviewTransport(), extra = {}) {
  const svc = new VentureReviewExchange({ mode: "mock_only", transport, recipients, purpose, sessionTtlMs: 60_000, maxSessions: 10, reviewTimeoutMs: 1000,
    websitePolicy: { maxPages: 2, maxBytesPerPage: 4096, maxCharsPerPage: 1000, maxRedirects: 1, timeoutMs: 1000 },
    websiteNetwork: { lookup: async () => [{ address: "93.184.216.34" }], request: async () => ({ status: 200, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode("Website claim, not independently verified.") }) }, ...extra });
  services.push(svc); return svc;
}
function approve(svc: VentureReviewExchange, state: { reviewId: string; requestId: string }, value = draft) {
  return svc.approve(founder, state.reviewId, { requestId: state.requestId, draftSha256: createHash("sha256").update(serializeVentureReviewShareDraft(value)).digest("hex"), sourceIds: value.sources.map((source) => source.id), recipients, purpose });
}
afterEach(() => services.splice(0).forEach((svc) => svc.dispose()));

describe("approved evidence exchange", () => {
  it("binds exact preview, server identity, recipients and one approved follow-up", async () => {
    const transport = createFixtureVentureReviewTransport();
    const review = vi.spyOn(transport, "review");
    const svc = service(transport);
    const start = svc.start(agent, { question: "What should this fictional venture test?" });
    expect(() => svc.approve(agent, start.reviewId, {})).toThrow(/Founder/);
    const approval = approve(svc, start);
    const changed = { sources: [{ ...draft.sources[0]!, excerpt: "Not the preview" }] };
    await expect(svc.submit(agent, start.reviewId, { approvalId: approval.approvalId, draft: changed })).rejects.toThrow(/preview/);
    const [first, duplicate] = await Promise.all([svc.submit(agent, start.reviewId, { approvalId: approval.approvalId, draft }), svc.submit(agent, start.reviewId, { approvalId: approval.approvalId, draft })]);
    expect(first).toEqual(duplicate);
    expect(first.phase).toBe("needs_evidence");
    expect(review).toHaveBeenCalledTimes(1);
    expect(review.mock.calls[0]![0]).toMatchObject({ tenantId, reviewId: start.reviewId, question: start.question, durableWriteApproved: false });
    const secondApproval = approve(svc, first);
    await expect(svc.submit(agent, start.reviewId, { approvalId: approval.approvalId, draft })).rejects.toThrow(/stale/);
    const second = await svc.submit(agent, start.reviewId, { approvalId: secondApproval.approvalId, draft });
    expect(second.phase).toBe("complete");
    expect(second.result!.status).toBe("needs_evidence");
    expect(second.result!.evidenceRequest).toBeNull();
    expect(() => approve(svc, second)).toThrow(/not accepting/);
    expect(review).toHaveBeenCalledTimes(2);
  });

  it("prevents cross-tenant/other-agent access and stale or changed recipient approvals", async () => {
    const svc = service(); const state = svc.start(agent, { question: "Review?" });
    for (const actor of [{ ...founder, tenantId: randomUUID() }, { ...agent, actorId: "other" }]) {
      expect(() => svc.get(actor, state.reviewId)).toThrow(/not found/);
      expect(() => svc.cancel(actor, state.reviewId)).toThrow(/not found/);
    }
    expect(() => svc.approve(founder, state.reviewId, { requestId: randomUUID(), draftSha256: "a".repeat(64), sourceIds: ["note"], recipients, purpose })).toThrow(/Stale/);
    expect(() => svc.approve(founder, state.reviewId, { requestId: state.requestId, draftSha256: "a".repeat(64), sourceIds: ["note"], recipients: ["another processor"], purpose })).toThrow(/recipients/);
    const old = approve(svc, state); approve(svc, state);
    await expect(svc.submit(agent, state.reviewId, { approvalId: old.approvalId, draft })).rejects.toThrow(/stale/);
  });

  it("requires founder-scoped website permission and returns inspection receipts", async () => {
    const svc = service(); const state = svc.start(agent, { question: "Review?" });
    await expect(svc.inspectWebsite(agent, state.reviewId, state.requestId, ["https://example.com/"])).rejects.toThrow(/Founder/);
    const inspection = await svc.inspectWebsite(founder, state.reviewId, state.requestId, ["https://example.com/"]);
    expect(inspection.receipts[0]).toMatchObject({ status: "retrieved", text: "Website claim, not independently verified.", untrustedContent: true });
    expect(svc.get(founder, state.reviewId).result).toBeNull(); // collection alone does not call reviewer
  });

  it("allows decline and clears results/approvals on cancellation and expiry", async () => {
    let now = Date.now(); const svc = service(undefined, { now: () => now });
    const state = svc.start(agent, { question: "Review?" }); const approval = approve(svc, state);
    await svc.submit(agent, state.reviewId, { approvalId: approval.approvalId, draft });
    expect(svc.decline(founder, state.reviewId)).toMatchObject({ phase: "complete", result: { status: "needs_evidence", evidenceRequest: null } });
    expect(svc.cancel(founder, state.reviewId)).toMatchObject({ phase: "cancelled", result: null, question: "" });
    await expect(svc.submit(agent, state.reviewId, { approvalId: approval.approvalId, draft })).rejects.toThrow(/stale/);
    const expiring = svc.start(founder, { question: "Temporary question" }); now += 60_001;
    expect(() => svc.get(founder, expiring.reviewId)).toThrow(/expired/);
  });

  it("cancels an in-flight review without late resurrection or duplicate execution", async () => {
    let finish!: () => void;
    const fixture = createFixtureVentureReviewTransport();
    const svc = service({ review: async (packet) => { await new Promise<void>((resolve) => { finish = resolve; }); return fixture.review(packet); } });
    const state = svc.start(agent, { question: "Review?" }); const approval = approve(svc, state);
    const pending = svc.submit(agent, state.reviewId, { approvalId: approval.approvalId, draft });
    await Promise.resolve(); svc.cancel(founder, state.reviewId);
    await expect(pending).rejects.toThrow(/cancelled/);
    finish(); await Promise.resolve();
    expect(svc.get(founder, state.reviewId)).toMatchObject({ phase: "cancelled", result: null });
  });

  it("blocks credential-like content without echoing it or invoking transport", async () => {
    const transport = createFixtureVentureReviewTransport(); const spy = vi.spyOn(transport, "review");
    const svc = service(transport); const state = svc.start(agent, { question: "Review?" });
    const secretDraft = { sources: [{ ...draft.sources[0]!, excerpt: "api_key=fictional-do-not-share" }] };
    const approval = approve(svc, state, secretDraft);
    await expect(svc.submit(agent, state.reviewId, { approvalId: approval.approvalId, draft: secretDraft })).rejects.toThrow("Possible credentials in evidence; redact locally and approve a new preview");
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects expanded follow-up source kinds and enforces one shared transport slot", async () => {
    const svc = service(); const state = svc.start(agent, { question: "Review?" }); const approval = approve(svc, state);
    const reviewed = await svc.submit(agent, state.reviewId, { approvalId: approval.approvalId, draft });
    const expanded = { sources: [{ ...draft.sources[0]!, kind: "conversation_excerpt", excerpt: "A new conversation outside the requested kinds" }] };
    const next = approve(svc, reviewed, expanded);
    await expect(svc.submit(agent, state.reviewId, { approvalId: next.approvalId, draft: expanded })).rejects.toThrow(/bounded follow-up/);
    let finish!: () => void;
    const fixture = createFixtureVentureReviewTransport();
    const busy = service({ review: async (packet) => { await new Promise<void>((resolve) => { finish = resolve; }); return fixture.review(packet); } });
    const first = busy.start(agent, { question: "Review one?" }); const firstApproval = approve(busy, first);
    const pending = busy.submit(agent, first.reviewId, { approvalId: firstApproval.approvalId, draft });
    await Promise.resolve();
    const second = busy.start(agent, { question: "Review two?" }); const secondApproval = approve(busy, second);
    await expect(busy.submit(agent, second.reviewId, { approvalId: secondApproval.approvalId, draft })).rejects.toThrow(/no automatic retry/);
    finish(); await pending;
  });

  it("supplies the full private method on each run and rejects mismatched versions", async () => {
    const fixture = createFixtureVentureReviewTransport();
    const execute = vi.fn(async ({ evidence }) => fixture.review(evidence));
    const method = { version: "m1-draft-2026-09-21", status: "authored_draft_not_accepted" as const, core: "FULL CORE fixture", procedure: "FULL PROCEDURE fixture", coreSha256: "a".repeat(64), procedureSha256: "b".repeat(64) };
    const svc = service(createMethodBoundReviewTransport(method, execute));
    const state = svc.start(founder, { question: "Review?" }); const approval = approve(svc, state);
    await svc.submit(founder, state.reviewId, { approvalId: approval.approvalId, draft });
    expect(execute.mock.calls[0]![0]).toMatchObject({ method, evidenceIsUntrusted: true });
    expect(execute.mock.calls[0]![0].evidenceReviewRules).toContain("justify each extra field");
    expect(execute.mock.calls[0]![0].evidenceReviewRules).toContain("later events cannot change a historical claim");
    expect(JSON.stringify(svc.get(founder, state.reviewId))).not.toContain("FULL CORE");
  });
});
