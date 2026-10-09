import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ventureReviewEvidencePacketSchema, ventureReviewResultSchema, ventureReviewShareDraftSchema } from "@paperclipai/shared";
import {
  VentureReviewCoordinator,
  createFixtureVentureReviewTransport,
  createRecordedVentureReviewTransport,
} from "./venture-review.js";

function packet(overrides: Record<string, unknown> = {}) {
  return {
    version: "sysdom_venture_review_evidence_v1",
    tenantId: randomUUID(),
    reviewId: randomUUID(),
    idempotencyKey: randomUUID(),
    founderApprovedAt: "2026-09-21T10:00:00.000Z",
    durableWriteApproved: false,
    sources: [{
      id: "founder-note-1",
      kind: "founder_note",
      title: "Current venture note",
      capturedAt: "2026-09-21T09:55:00.000Z",
      sourceDate: "2026-09-21",
      excerpt: "We keep adding features, but a new founder cannot explain the promised outcome or what happens after the first map.",
      omitted: ["customer names"],
      consent: {
        approved: true,
        purpose: "Prepare this Venture Review",
        recipients: ["Sysdom fixture transport"],
      },
    }],
    ...overrides,
  };
}

describe("VentureReviewCoordinator", () => {
  it("replays CU01 only for its exact question and evidence, never after redaction or source substitution", async () => {
    const raw = JSON.parse(readFileSync(new URL("../../../evals/fixtures/venture-review-cu01-demo.json", import.meta.url), "utf8"));
    const record = { question: raw.question, draft: ventureReviewShareDraftSchema.parse(raw.draft), result: ventureReviewResultSchema.parse(raw.result) };
    const transport = createRecordedVentureReviewTransport(record);
    const input = ventureReviewEvidencePacketSchema.parse(packet({ question: record.question, sources: record.draft.sources.map((source) => ({ ...source, consent: packet().sources[0]!.consent })) }));
    const result = await new VentureReviewCoordinator(transport).review(input);
    expect(result.engineFindings.customer[0]!.statement).toContain("8 settled");
    expect(result.omissions.join(" ")).toContain("Not a verbatim replay or a new model assessment");
    expect(result.reviewId).toBe(input.reviewId);
    const changes = [
      { ...input, question: "Another question" },
      { ...input, sources: input.sources.slice(1) },
      { ...input, sources: input.sources.map((source) => ({ ...source, excerpt: "Changed evidence" })) },
      { ...input, collectionOmissions: ["A source was withheld"] },
    ];
    for (const changed of changes) await expect(transport.review(changed)).rejects.toThrow(/does not match/);
    const controller = new AbortController(); controller.abort();
    await expect(transport.review(input, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("reserves concurrent identities, rejects changed packets and protects cached results", async () => {
    const input = packet();
    const transport = createFixtureVentureReviewTransport();
    const review = vi.spyOn(transport, "review");
    const coordinator = new VentureReviewCoordinator(transport);
    const [first, second] = await Promise.all([coordinator.review(input), coordinator.review(input)]);
    expect(review).toHaveBeenCalledTimes(1);
    first.unknowns.push("mutated");
    expect(second.unknowns).not.toContain("mutated");
    await expect(coordinator.review({ ...input, reviewId: randomUUID() })).rejects.toThrow(/conflict/);
    await expect(coordinator.review({ ...input, sources: [{ ...input.sources[0], excerpt: "changed" }] })).rejects.toThrow(/conflict/);
  });

  it("rejects duplicate source identities and unknown citations in every result section", async () => {
    const input = packet();
    const fixture = createFixtureVentureReviewTransport();
    await expect(new VentureReviewCoordinator(fixture).review({ ...input, sources: [input.sources[0], input.sources[0]] })).rejects.toThrow(/unique/);
    const mutations = [
      (result: Awaited<ReturnType<typeof fixture.review>>) => { result.engineFindings.customer = [{ statement: "unknown", basis: "hypothesis", confidence: "low", evidenceSourceIds: ["secret"] }]; },
      (result: Awaited<ReturnType<typeof fixture.review>>) => { result.interactions = [{ engines: ["cash", "skills"], statement: "unknown", evidenceSourceIds: ["secret"] }]; },
      (result: Awaited<ReturnType<typeof fixture.review>>) => { result.contradictions = [{ statement: "unknown", basis: "hypothesis", confidence: "low", evidenceSourceIds: ["secret"] }]; },
      (result: Awaited<ReturnType<typeof fixture.review>>) => { result.alternatives[0]!.evidenceAgainst = ["secret"]; },
    ];
    for (const mutate of mutations) {
      const coordinator = new VentureReviewCoordinator({ review: async (value) => { const result = await fixture.review(value); mutate(result); return result; } });
      await expect(coordinator.review(input)).rejects.toThrow(/unapproved/);
    }
  });

  it("cancels an ignoring transport promptly and does not retry or start a concurrent run", async () => {
    const input = packet();
    const fixture = createFixtureVentureReviewTransport();
    let finish!: () => void;
    const review = vi.fn(async (value) => { await new Promise<void>((resolve) => { finish = resolve; }); return fixture.review(value); });
    const coordinator = new VentureReviewCoordinator({ review });
    const controller = new AbortController();
    const work = coordinator.review(input, controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(work).rejects.toMatchObject({ name: "AbortError" });
    await expect(coordinator.review(input)).rejects.toMatchObject({ name: "AbortError" });
    await expect(coordinator.review(packet())).rejects.toThrow(/busy/);
    finish();
    expect(review).toHaveBeenCalledTimes(1);
  });

  it("times out without retry and accepts the full allowed 40-source packet", async () => {
    const stuck = new VentureReviewCoordinator({ review: () => new Promise(() => {}) }, { timeoutMs: 5, maxAttempts: 1 });
    await expect(stuck.review(packet())).rejects.toMatchObject({ name: "TimeoutError" });
    const input = packet();
    input.sources = Array.from({ length: 40 }, (_, i) => ({ ...input.sources[0]!, id: `source-${i}` }));
    await expect(new VentureReviewCoordinator(createFixtureVentureReviewTransport()).review(input)).resolves.toHaveProperty("status");
  });
  it("returns a versioned review without a durable write", async () => {
    const input = packet();
    const result = await new VentureReviewCoordinator(createFixtureVentureReviewTransport()).review(input);
    expect(result).toMatchObject({
      reviewId: input.reviewId,
      tenantId: input.tenantId,
      rubricVersion: "m1-draft-2026-09-21",
      durableWritePerformed: false,
    });
    expect(result.nextTest.owner).toBe("founder");
  });

  it("is idempotent inside one tenant", async () => {
    const input = packet();
    const transport = createFixtureVentureReviewTransport();
    const reviewSpy = vi.spyOn(transport, "review");
    const coordinator = new VentureReviewCoordinator(transport);
    await coordinator.review(input);
    await coordinator.review(input);
    expect(reviewSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects transport results for another tenant", async () => {
    const input = packet();
    const transport = createFixtureVentureReviewTransport();
    const original = transport.review.bind(transport);
    transport.review = async (value, signal) => ({
      ...(await original(value, signal)),
      tenantId: randomUUID(),
    });
    await expect(new VentureReviewCoordinator(transport).review(input)).rejects.toThrow(/tenant/);
  });

  it("honors cancellation before transport work", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new VentureReviewCoordinator(createFixtureVentureReviewTransport()).review(packet(), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
