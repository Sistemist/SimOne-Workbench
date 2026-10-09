import { z } from "zod";
import {
  serializeVentureReviewShareDraft, ventureReviewShareDraftSchema, ventureReviewSnapshotSchema,
  ventureReviewWebsiteReceiptSchema, type VentureReviewApproval, type VentureReviewShareDraft,
} from "./validators/venture-review-exchange.js";

/** Runs locally before sharing. Hash changes on any redaction/source/metadata edit. */
export async function prepareVentureReviewPreview(raw: unknown) {
  const draft = ventureReviewShareDraftSchema.parse(raw);
  const serialized = serializeVentureReviewShareDraft(draft);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return { draft, serialized, draftSha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""), sourceIds: draft.sources.map((source) => source.id) };
}

/** One explicit endpoint/transport shared by web and host-tool adapters. No
 * credential storage, host filesystem collection, automatic retries or defaults. */
export function createVentureReviewClient(options: { basePath: string; fetcher: typeof fetch }) {
  const base = options.basePath.replace(/\/$/, "");
  const fetcher = options.fetcher;
  async function call(path: string, body?: unknown) {
    const response = await fetcher(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Review request failed (${response.status}); no automatic retry. Your local preview is unchanged.`);
    return response.json();
  }
  const path = (reviewId: string) => `/${encodeURIComponent(z.string().uuid().parse(reviewId))}`;
  return {
    async start(question: string) { return ventureReviewSnapshotSchema.parse(await call("", { question })); },
    async get(reviewId: string) { return ventureReviewSnapshotSchema.parse(await call(path(reviewId))); },
    async approve(reviewId: string, approval: VentureReviewApproval) {
      return z.object({ approvalId: z.string().uuid(), requestId: z.string().uuid(), draftSha256: z.string() }).strict().parse(await call(`${path(reviewId)}/approve`, approval));
    },
    async submit(reviewId: string, approvalId: string, draft: VentureReviewShareDraft) {
      return ventureReviewSnapshotSchema.parse(await call(`${path(reviewId)}/submit`, { approvalId, draft }));
    },
    async inspect(reviewId: string, requestId: string, approvedUrls: string[]) {
      return z.object({ reviewId: z.string().uuid(), requestId: z.string().uuid(), receipts: z.array(ventureReviewWebsiteReceiptSchema), mockOnly: z.boolean() }).strict().parse(await call(`${path(reviewId)}/inspect`, { requestId, approvedUrls }));
    },
    async decline(reviewId: string) { return ventureReviewSnapshotSchema.parse(await call(`${path(reviewId)}/decline`, {})); },
    async cancel(reviewId: string) { return ventureReviewSnapshotSchema.parse(await call(`${path(reviewId)}/cancel`, {})); },
  };
}
export type VentureReviewClient = ReturnType<typeof createVentureReviewClient>;
